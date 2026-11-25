require "rails_helper"

RSpec.describe Compensation do
  let(:employment) { create(:employment, legal_entity: create(:legal_entity, country_code: "IN")) }

  it "exposes annual_salary as Money in the row's currency" do
    compensation = create(:compensation, employment: employment, annual_salary_cents: 1_850_000_00)
    expect(compensation.annual_salary).to eq(Money.new(1_850_000_00, "INR"))
  end

  it "requires the legal entity's currency" do
    compensation = build(:compensation, employment: employment, currency: "USD")
    expect(compensation).not_to be_valid
    expect(compensation.errors[:currency]).to include(/must be INR/)
  end

  it "cannot start before the hire date" do
    expect(build(:compensation, employment: employment, effective_from: employment.hire_date - 1)).not_to be_valid
  end

  it "requires effective_to to be after effective_from" do
    compensation = build(:compensation, employment: employment, effective_to: employment.hire_date)
    expect(compensation).not_to be_valid
    expect(compensation.errors[:effective_to]).to include("must be after effective_from")
  end

  it "knows whether it is active on a date" do
    compensation = build(:compensation, employment: employment, effective_from: Date.new(2026, 2, 1), effective_to: Date.new(2026, 3, 1))
    expect(compensation.active_on?(Date.new(2026, 2, 28))).to be(true)
    expect(compensation.active_on?(Date.new(2026, 3, 1))).to be(false)
  end

  it "requires a positive salary" do
    expect(build(:compensation, employment: employment, annual_salary_cents: 0)).not_to be_valid
  end

  it "rejects overlapping rows for the same employment" do
    create(:compensation, employment: employment, effective_from: Date.new(2026, 1, 5))
    expect {
      create(:compensation, employment: employment, effective_from: Date.new(2026, 4, 1))
    }.to raise_error(ActiveRecord::ExclusionViolation)
  end

  it "records who made the change in the audit trail" do
    hr = create(:user, :hr)
    compensation = PaperTrail.request(whodunnit: hr.id) { create(:compensation, employment: employment) }
    expect(compensation.versions.last.whodunnit).to eq(hr.id)
  end
end
