require "rails_helper"

RSpec.describe SalaryBandPolicy do
  it "lets only HR list salary bands" do
    expect(described_class.new(create(:user, :hr), SalaryBand).index?).to be(true)
    expect(described_class.new(create(:user), SalaryBand).index?).to be(false)
  end
end
