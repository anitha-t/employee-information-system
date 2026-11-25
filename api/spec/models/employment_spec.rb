require "rails_helper"

RSpec.describe Employment do
  it "gets a sequential employee number from the database" do
    first = create(:employment)
    second = create(:employment)
    expect(first.employee_number).to match(/\AE\d{6}\z/)
    expect(second.employee_number.delete("E").to_i).to eq(first.employee_number.delete("E").to_i + 1)
  end

  it "never changes legal entity" do
    employment = create(:employment)
    expect { employment.update(legal_entity: create(:legal_entity)) }.to raise_error(ActiveRecord::ReadonlyAttributeError)
  end

  it "cannot have a last working date before the hire date" do
    expect(build(:employment, hire_date: Date.new(2026, 1, 5), last_working_date: Date.new(2026, 1, 4))).not_to be_valid
  end

  it "takes country and currency from the legal entity" do
    employment = create(:employment, legal_entity: create(:legal_entity, country_code: "US"))
    expect(employment.currency).to eq("USD")
  end

  it "lets a rehired person reuse a work email once the old stint is separated" do
    old = create(:employment, work_email: "priya@acme.example")
    expect(build(:employment, work_email: "priya@acme.example")).not_to be_valid

    old.update!(status: "separated", last_working_date: Date.new(2026, 6, 30))
    expect(create(:employment, person: old.person, work_email: "priya@acme.example")).to be_persisted
  end

  it "returns the current assignment and compensation" do
    employment = create(:employment)
    assignment = create(:assignment, employment: employment)
    compensation = create(:compensation, employment: employment)
    expect(employment.current_assignment).to eq(assignment)
    expect(employment.current_compensation).to eq(compensation)
  end
end
