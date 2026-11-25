require "rails_helper"

RSpec.describe Authentication do
  controller(ApplicationController) do
    def update
      Person.find(params[:id]).update!(preferred_name: params[:preferred_name])
      head :no_content
    end
  end

  let(:hr) { create(:user, :hr) }
  let(:person) { create(:person) }

  before { routes.draw { patch "anonymous/:id" => "anonymous#update" } }

  it "records the signed-in user and IP in the audit trail" do
    _session, token = Session.start!(user: hr)
    request.headers["Authorization"] = "Bearer #{token}"

    patch :update, params: { id: person.id, preferred_name: "Anu" }

    expect(response).to have_http_status(:no_content)
    expect(person.versions.last).to have_attributes(whodunnit: hr.id, event: "update", ip: "0.0.0.0")
  end

  it "blocks the action without a token" do
    patch :update, params: { id: person.id, preferred_name: "Anu" }

    expect(response).to have_http_status(:unauthorized)
    expect(person.reload.preferred_name).to be_nil
  end
end
