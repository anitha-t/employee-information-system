require "rails_helper"

RSpec.describe "Passwords" do
  let!(:user) { create(:user, email_address: "priya@acme.example", password: "old-password-123") }

  describe "POST /api/v1/passwords" do
    it "emails a reset link to a known user" do
      expect {
        post "/api/v1/passwords", params: { email_address: "Priya@acme.example" }, as: :json
      }.to have_enqueued_mail(PasswordsMailer, :reset).with(user)
      expect(response).to have_http_status(:accepted)
    end

    it "rate-limits repeated requests" do
      6.times { post "/api/v1/passwords", params: { email_address: "nobody@acme.example" }, as: :json }

      expect(response).to have_http_status(:too_many_requests)
    end

    it "responds the same for unknown emails and sends nothing" do
      expect {
        post "/api/v1/passwords", params: { email_address: "nobody@acme.example" }, as: :json
      }.not_to have_enqueued_mail
      expect(response).to have_http_status(:accepted)
    end
  end

  describe "PUT /api/v1/passwords/:token" do
    it "sets the new password and signs the user out everywhere" do
      old_headers = auth_headers(user)

      put "/api/v1/passwords/#{user.password_reset_token}", params: { password: "new-password-456" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(user.reload.authenticate("new-password-456")).to eq(user)
      get "/api/v1/me", headers: old_headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects invalid or already-used tokens" do
      token = user.password_reset_token
      put "/api/v1/passwords/#{token}", params: { password: "new-password-456" }, as: :json
      put "/api/v1/passwords/#{token}", params: { password: "another-password-789" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "code")).to eq("invalid_token")
    end

    it "validates the new password" do
      put "/api/v1/passwords/#{user.password_reset_token}", params: { password: "short" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details", "password")).to be_present
    end
  end
end
