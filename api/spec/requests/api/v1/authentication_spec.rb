require "rails_helper"

RSpec.describe "Authentication" do
  let(:user) { create(:user) }

  it "requires a bearer token" do
    get "/api/v1/me"
    expect(response).to have_http_status(:unauthorized)
    expect(json["error"]).to include("code" => "unauthenticated")
  end

  it "rejects unknown and malformed tokens" do
    get "/api/v1/me", headers: { "Authorization" => "Bearer not-a-real-token" }
    expect(response).to have_http_status(:unauthorized)

    get "/api/v1/me", headers: { "Authorization" => "Basic abc" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects expired tokens" do
    headers = auth_headers(user)
    travel Session::TTL + 1.minute do
      get "/api/v1/me", headers: headers
    end
    expect(response).to have_http_status(:unauthorized)
  end
end
