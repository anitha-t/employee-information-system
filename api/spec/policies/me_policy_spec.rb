require "rails_helper"

RSpec.describe MePolicy do
  let(:user) { create(:user) }

  it "lets users see only themselves" do
    expect(described_class.new(user, user).show?).to be(true)
    expect(described_class.new(user, create(:user)).show?).to be(false)
  end
end
