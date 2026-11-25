require "rails_helper"

RSpec.describe EmploymentActions::Create do
  it "reports when there is no row to supersede on the effective date" do
    employment = create(:employment) # created directly, without a hire action or rows
    params = { action_type: "salary_change", employment_id: employment.id, effective_date: "2026-04-01",
               compensation: { annual_salary: { amount: "100", currency: "INR" } } }

    expect { described_class.new(params: params, user: create(:user, :hr)).call }
      .to raise_error(ValidationError) { |e| expect(e.details).to eq("compensation" => [ "has no row active on 2026-04-01" ]) }
  end
end
