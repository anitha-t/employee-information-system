require "rails_helper"

RSpec.describe Person do
  it { is_expected.to validate_presence_of(:first_name) }

  it "generates full_name in the database" do
    expect(create(:person, first_name: "Priya", last_name: "Sharma").reload.full_name).to eq("Priya Sharma")
    expect(create(:person, first_name: "Madonna", last_name: nil).reload.full_name).to eq("Madonna")
  end

  it "normalizes email and enforces uniqueness case-insensitively" do
    create(:person, email: "Priya@Example.com")
    duplicate = build(:person, email: " priya@example.com ")
    expect(duplicate).not_to be_valid
    expect(duplicate.email).to eq("priya@example.com")
  end

  it "displays the preferred name when present" do
    expect(build(:person, first_name: "Anitha", preferred_name: "Anu").display_name).to eq("Anu")
    expect(build(:person, first_name: "Anitha", last_name: "T").display_name).to eq("Anitha T")
  end

  it "requires E.164 phone numbers" do
    expect(build(:person, phone_number: "98000 00000")).not_to be_valid
    expect(build(:person, phone_number: "+61400000000")).to be_valid
  end

  it "allows gender to be blank but not arbitrary" do
    expect(build(:person, gender: nil)).to be_valid
    expect { build(:person, gender: "unknown") }.not_to raise_error
    expect(build(:person, gender: "unknown")).not_to be_valid
  end

  describe ".search" do
    let!(:priya) { create(:person, first_name: "Priya", last_name: "Sharma", preferred_name: "Pri") }
    let!(:other) { create(:person, first_name: "John", last_name: "Smith") }

    it "matches name prefixes" do
      expect(described_class.search("priy")).to contain_exactly(priya)
    end

    it "tolerates typos via trigram similarity" do
      expect(described_class.search("prya sharma")).to include(priya)
      expect(described_class.search("prya sharma")).not_to include(other)
    end
  end

  describe "nested addresses and emergency contacts (single profile API)" do
    let(:person) { create(:person) }
    let(:country) { create(:country) }

    it "creates, updates and destroys in one save" do
      keep = create(:address, addressable: person, line1: "Old")
      drop = create(:address, addressable: person)
      contact = create(:emergency_contact, person: person)

      person.reload.update!(
        addresses_attributes: [
          { id: keep.id, line1: "New" },
          { id: drop.id, _destroy: true },
          { address_type: "mailing", line1: "PO Box 1", city: "Pune", country_id: country.id }
        ],
        emergency_contacts_attributes: [ { id: contact.id, _destroy: true }, { name: "Ravi", phone_number: "+919811111111" } ]
      )

      expect(person.addresses.reload.map(&:line1)).to contain_exactly("New", "PO Box 1")
      expect(person.emergency_contacts.reload.map(&:name)).to eq([ "Ravi" ])
    end

    it "rejects more than one primary emergency contact" do
      person.assign_attributes(emergency_contacts_attributes: [
        { name: "A", phone_number: "+919811111111", is_primary: true },
        { name: "B", phone_number: "+919822222222", is_primary: true }
      ])
      expect(person).not_to be_valid
      expect(person.errors[:emergency_contacts]).to include("can have only one primary contact")
    end

    it "does not let one person's update touch another person's address" do
      foreign = create(:address)
      expect {
        person.update(addresses_attributes: [ { id: foreign.id, line1: "Hijack" } ])
      }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
