require "rails_helper"

RSpec.describe Session do
  let(:user) { create(:user) }

  it "stores only a digest and finds the session by raw token" do
    session, token = described_class.start!(user: user, ip_address: "127.0.0.1")
    expect(session.token_digest).not_to eq(token)
    expect(described_class.find_by_token(token)).to eq(session)
  end

  it "ignores expired and unknown tokens" do
    session, token = described_class.start!(user: user)
    expect(described_class.find_by_token("nope")).to be_nil
    session.update!(expires_at: 1.minute.ago)
    expect(described_class.find_by_token(token)).to be_nil
  end

  it "truncates long user agents" do
    session, _token = described_class.start!(user: user, user_agent: "x" * 500)
    expect(session.user_agent.length).to eq(255)
  end
end
