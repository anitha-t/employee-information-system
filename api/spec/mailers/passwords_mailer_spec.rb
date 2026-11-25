require "rails_helper"

RSpec.describe PasswordsMailer do
  it "sends a reset link to the web app" do
    user = create(:user, email_address: "priya@acme.example")
    mail = described_class.reset(user)

    expect(mail.to).to eq([ "priya@acme.example" ])
    expect(mail.subject).to eq("Reset your password")
    expect(mail.body.encoded).to match(%r{http://localhost:5173/reset-password/\S+})
  end
end
