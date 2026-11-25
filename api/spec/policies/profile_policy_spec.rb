require "rails_helper"

RSpec.describe ProfilePolicy do
  let(:employee) { create(:user) }
  let(:hr) { create(:user, :hr) }
  let(:someone_else) { create(:person) }

  it "lets employees see and edit only their own profile" do
    expect(described_class.new(employee, employee.person).update?).to be(true)
    expect(described_class.new(employee, someone_else).show?).to be(false)
  end

  it "lets HR see and edit everyone" do
    expect(described_class.new(hr, someone_else).update?).to be(true)
  end

  it "gives HR the legal name, date of birth and gender on top of self-service fields" do
    expect(described_class.new(employee, employee.person).permitted_attributes)
      .to contain_exactly("preferred_name", "phone_number", "email", "addresses", "emergency_contacts")
    expect(described_class.new(hr, someone_else).permitted_attributes).to include("first_name", "last_name", "dob", "gender")
  end

  it "denies anonymous users" do
    expect(described_class.new(nil, someone_else).show?).to be(false)
  end
end
