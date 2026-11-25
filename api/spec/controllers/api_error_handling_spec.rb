require "rails_helper"

RSpec.describe ApiErrorHandling, type: :controller do
  controller(ApplicationController) do
    def index
      case params[:raise]
      when "not_found" then raise ActiveRecord::RecordNotFound.new("x", "Person")
      when "stale"     then raise ActiveRecord::StaleObjectError
      when "missing"   then params.require(:person)
      when "forbidden" then raise Pundit::NotAuthorizedError
      end
    end
  end

  {
    "not_found" => [ 404, "not_found" ],
    "stale"     => [ 409, "stale_object" ],
    "missing"   => [ 400, "bad_request" ],
    "forbidden" => [ 403, "forbidden" ]
  }.each do |trigger, (status, code)|
    it "renders #{code} with status #{status}" do
      get :index, params: { raise: trigger }
      expect(response).to have_http_status(status)
      expect(json["error"]).to include("code" => code, "message" => be_a(String), "details" => {})
    end
  end
end
