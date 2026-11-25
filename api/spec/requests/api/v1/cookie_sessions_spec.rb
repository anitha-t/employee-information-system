require "rails_helper"

# The web app signs in with an httpOnly cookie instead of a bearer token.
# Request specs keep cookies between requests, like a browser.
RSpec.describe "Cookie sessions" do
  let!(:user) { create(:user, email_address: "emp@acme.example", password: "correct-horse-battery") }
  let(:xhr) { { "X-Requested-With" => "XMLHttpRequest" } }

  def sign_in
    post "/api/v1/session", params: { email_address: "emp@acme.example", password: "correct-horse-battery" },
                            headers: xhr, as: :json
  end

  it "sets a signed, httpOnly, SameSite=Lax cookie that authenticates later requests" do
    sign_in

    set_cookie = response.headers["Set-Cookie"].to_s
    expect(set_cookie).to include("session_token=", "httponly", "samesite=lax", "expires=")
    expect(set_cookie).not_to include(json["token"])

    get "/api/v1/me"
    expect(response).to have_http_status(:ok)
    expect(json.dig("user", "id")).to eq(user.id)
  end

  it "requires the X-Requested-With header for cookie-authenticated writes" do
    sign_in

    patch "/api/v1/me/profile", params: { lock_version: user.person.lock_version, preferred_name: "Anu" }, as: :json
    expect(response).to have_http_status(:forbidden)
    expect(json.dig("error", "code")).to eq("csrf_failed")
    expect(user.person.reload.preferred_name).to be_nil

    patch "/api/v1/me/profile", params: { lock_version: user.person.lock_version, preferred_name: "Anu" }, headers: xhr, as: :json
    expect(response).to have_http_status(:ok)
  end

  it "does not require the header for bearer-token writes" do
    patch "/api/v1/me/profile", params: { lock_version: user.person.lock_version, preferred_name: "Anu" },
                                headers: auth_headers(user), as: :json

    expect(response).to have_http_status(:ok)
  end

  it "signs out by revoking the session and clearing the cookie" do
    sign_in

    expect { delete "/api/v1/session", headers: xhr }.to change(Session, :count).by(-1)
    expect(response).to have_http_status(:no_content)
    expect(response.headers["Set-Cookie"].to_s).to match(/session_token=;.*max-age=0/i)

    get "/api/v1/me"
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects and clears a cookie whose session has expired" do
    sign_in
    Session.update_all(expires_at: 1.minute.ago)

    get "/api/v1/me"

    expect(response).to have_http_status(:unauthorized)
    expect(json.dig("error", "code")).to eq("unauthenticated")
    expect(response.headers["Set-Cookie"].to_s).to include('session_token=;')
  end

  it "ignores a tampered cookie" do
    cookies[:session_token] = "forged"

    get "/api/v1/me"

    expect(response).to have_http_status(:unauthorized)
  end
end
