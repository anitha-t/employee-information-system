require "rails_helper"

RSpec.describe ReferenceDataPolicy do
  it "lets any signed-in user list reference data" do
    expect(described_class.new(create(:user), Job).index?).to be(true)
    expect(described_class.new(create(:user, :hr), Job).index?).to be(true)
    expect(described_class.new(nil, Job).index?).to be(false)
  end
end
