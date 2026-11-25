require "rails_helper"

RSpec.describe Address do
  it "allows only home and mailing addresses for people" do
    expect(build(:address, address_type: "mailing")).to be_valid
    expect(build(:address, address_type: "registered")).not_to be_valid
  end

  it "allows only a registered address for legal entities" do
    entity = create(:legal_entity)
    expect(build(:address, addressable: entity, address_type: "registered")).to be_valid
    expect(build(:address, addressable: entity, address_type: "home")).not_to be_valid
  end
end
