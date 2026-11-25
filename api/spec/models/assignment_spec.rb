require "rails_helper"

RSpec.describe Assignment do
  let(:employment) { create(:employment, hire_date: Date.new(2026, 1, 1)) }

  it "requires the position to belong to the employment's legal entity" do
    foreign_position = create(:position, legal_entity: create(:legal_entity, country_code: "US"))
    assignment = build(:assignment, employment: employment, position: foreign_position)
    expect(assignment).not_to be_valid
    expect(assignment.errors[:position]).to be_present
  end

  it "requires the grade to be within the job's range" do
    assignment = build(:assignment, employment: employment)
    assignment.grade = create(:grade, rank: assignment.position.job.max_grade.rank + 1)
    expect(assignment).not_to be_valid
    expect(assignment.errors[:grade]).to be_present
  end

  it "cannot start before the hire date" do
    expect(build(:assignment, employment: employment, effective_from: Date.new(2025, 12, 31))).not_to be_valid
  end

  it "requires the position to be active on the start date" do
    position = create(:position, legal_entity: employment.legal_entity, effective_from: Date.new(2026, 3, 1))
    assignment = build(:assignment, employment: employment, position: position, effective_from: Date.new(2026, 1, 1))
    expect(assignment).not_to be_valid
    expect(assignment.errors[:position]).to include("is not active on 2026-01-01")
  end

  it "cannot report to a separated employment" do
    manager = create(:employment, status: "separated", last_working_date: Date.new(2026, 6, 30))
    expect(build(:assignment, employment: employment, reports_to_employment: manager)).not_to be_valid
  end

  it "cannot report to the same employment" do
    expect(build(:assignment, employment: employment, reports_to_employment: employment)).not_to be_valid
  end

  describe "effective dating" do
    let!(:first) do
      create(:assignment, employment: employment, effective_from: Date.new(2026, 1, 1), effective_to: Date.new(2026, 4, 1))
    end

    it "allows back-to-back primary rows (half-open ranges)" do
      second = create(:assignment, employment: employment, effective_from: Date.new(2026, 4, 1))
      expect(described_class.active_on(Date.new(2026, 3, 31))).to eq([ first ])
      expect(described_class.active_on(Date.new(2026, 4, 1))).to eq([ second ])
    end

    it "rejects overlapping primary rows in the database" do
      expect {
        create(:assignment, employment: employment, effective_from: Date.new(2026, 3, 1))
      }.to raise_error(ActiveRecord::ExclusionViolation)
    end

    it "allows an overlapping non-primary assignment" do
      expect(create(:assignment, employment: employment, is_primary: false, effective_from: Date.new(2026, 3, 1))).to be_persisted
    end
  end
end
