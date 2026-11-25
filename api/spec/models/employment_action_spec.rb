require "rails_helper"

RSpec.describe EmploymentAction do
  let(:employment) { create(:employment, hire_date: Date.new(2026, 1, 5)) }

  it "only allows known action types" do
    expect(build(:employment_action, employment: employment, action_type: "bonus")).not_to be_valid
  end

  it "cannot be effective before the hire date" do
    expect(build(:employment_action, employment: employment, effective_date: Date.new(2026, 1, 4))).not_to be_valid
  end

  it "reports a missing employment instead of failing the date check" do
    action = build(:employment_action, employment: nil, effective_date: Date.new(2026, 1, 1))
    expect(action).not_to be_valid
    expect(action.errors[:employment]).to be_present
  end

  it "requires a reviewer when a review decision is recorded" do
    action = build(:employment_action, employment: employment, review_decision: "approved")
    expect(action).not_to be_valid
    action.reviewed_by_user = create(:user, :hr)
    expect(action).to be_valid
  end

  it "knows whether it is the employment's latest action" do
    hire = create(:employment_action, employment: employment)
    promotion = create(:employment_action, employment: employment, action_type: "promotion", effective_date: Date.new(2026, 4, 1))
    expect(hire.latest_for_employment?).to be(false)
    expect(promotion.latest_for_employment?).to be(true)
  end
end
