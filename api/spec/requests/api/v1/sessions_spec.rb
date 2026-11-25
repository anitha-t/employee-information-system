require "rails_helper"

RSpec.describe "Sessions" do
  let!(:user) { create(:user, email_address: "hr@acme.example", password: "correct-horse-battery", role: "hr") }

  describe "POST /api/v1/session" do
    it "returns a bearer token for valid credentials" do
      post "/api/v1/session", params: { email_address: " HR@acme.example ", password: "correct-horse-battery" }, as: :json

      expect(response).to have_http_status(:created)
      expect(json).to include("token" => be_present, "expires_at" => be_present)
      expect(json["user"]).to eq("id" => user.id, "email_address" => "hr@acme.example", "role" => "hr")
      expect(Session.find_by_token(json["token"]).user).to eq(user)
    end

    it "rejects a wrong password without revealing whether the email exists" do
      post "/api/v1/session", params: { email_address: "hr@acme.example", password: "wrong-password" }, as: :json
      wrong_password = json

      post "/api/v1/session", params: { email_address: "nobody@acme.example", password: "wrong-password" }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(json).to eq(wrong_password)
      expect(json.dig("error", "code")).to eq("invalid_credentials")
    end

    it "rejects people whose employments are all separated" do
      create(:employment, person: user.person, status: "separated", last_working_date: Date.new(2026, 6, 30))

      post "/api/v1/session", params: { email_address: "hr@acme.example", password: "correct-horse-battery" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "rate-limits repeated attempts" do
      11.times { post "/api/v1/session", params: { email_address: "hr@acme.example", password: "wrong" }, as: :json }

      expect(response).to have_http_status(:too_many_requests)
      expect(json.dig("error", "code")).to eq("rate_limited")
    end

    it "returns 400 when a field is missing" do
      post "/api/v1/session", params: { email_address: "hr@acme.example" }, as: :json
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "DELETE /api/v1/session" do
    it "revokes only the current token" do
      headers = auth_headers(user)
      other_headers = auth_headers(user)

      delete "/api/v1/session", headers: headers
      expect(response).to have_http_status(:no_content)

      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
      get "/api/v1/me", headers: other_headers
      expect(response).to have_http_status(:ok)
    end
  end
end
