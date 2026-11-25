require "rails_helper"

RSpec.describe "GET /api/v1/me" do
  let(:person) { create(:person, first_name: "Anitha", last_name: "T", preferred_name: "Anu") }
  let(:user) { create(:user, person: person) }

  it "returns the user and person without an employment" do
    get "/api/v1/me", headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    expect(json["user"]).to include("id" => user.id, "role" => "employee")
    expect(json["person"]).to include("full_name" => "Anitha T", "display_name" => "Anu")
    expect(json["employment"]).to be_nil
  end

  it "includes the current employment, job, team and manager" do
    employment = create(:employment, person: person, legal_entity: create(:legal_entity, country_code: "AU"))
    manager = create(:employment, legal_entity: employment.legal_entity, person: create(:person, first_name: "Maya", preferred_name: nil))
    assignment = create(:assignment, employment: employment, reports_to_employment: manager)

    get "/api/v1/me", headers: auth_headers(user)

    expect(json["employment"]).to include(
      "employee_number" => employment.employee_number, "country" => "AU",
      "job_title" => assignment.job.title, "team" => assignment.team.name, "manager" => "Maya #{manager.person.last_name}"
    )
  end

  it "returns nulls for job, team and manager when there is no current assignment" do
    create(:employment, person: person)

    get "/api/v1/me", headers: auth_headers(user)

    expect(json["employment"]).to include("job_title" => nil, "team" => nil, "manager" => nil)
  end

  it "returns null manager when the assignment has none" do
    employment = create(:employment, person: person)
    create(:assignment, employment: employment)

    get "/api/v1/me", headers: auth_headers(user)

    expect(json["employment"]["manager"]).to be_nil
  end
end
