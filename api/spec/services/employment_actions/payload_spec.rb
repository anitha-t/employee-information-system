require "rails_helper"

RSpec.describe EmploymentActions::Payload do
  def errors_for(params)
    described_class.new(params).validate!
    {}
  rescue ValidationError => e
    e.details
  end

  it "rejects unknown action types" do
    expect(errors_for(action_type: "bonus")).to have_key("action_type")
  end

  it "requires exactly one of person and person_id for a hire" do
    expect(errors_for(action_type: "hire")).to include("person" => [ "or person_id is required" ])
    expect(errors_for(action_type: "hire", person: { first_name: "A" }, person_id: "x"))
      .to include("person" => [ "and person_id cannot both be given" ])
  end

  it "requires employment_id for changes and forbids it for hires" do
    expect(errors_for(action_type: "salary_change")).to have_key("employment_id")
    expect(errors_for(action_type: "hire", employment_id: "x")).to have_key("employment_id")
  end

  it "rejects sections and assignment fields the action type doesn't allow" do
    errors = errors_for(action_type: "regrade", employment_id: "x", effective_date: "2026-04-01",
                        assignment: { grade_id: "g", position_id: "p" }, separation: {})
    expect(errors).to include("assignment.position_id" => [ "cannot be set by regrade" ],
                              "separation" => [ "is not allowed for regrade" ])
  end

  it "requires a promotion to change position or grade" do
    errors = errors_for(action_type: "promotion", employment_id: "x", effective_date: "2026-04-01",
                        assignment: { reports_to_employment_id: "m" })
    expect(errors).to include("assignment" => [ "must change position_id or grade_id" ])
  end

  it "allows manager_change to clear the manager with null" do
    payload = described_class.new(action_type: "manager_change", employment_id: "x", effective_date: "2026-04-01",
                                  assignment: { reports_to_employment_id: nil }).validate!
    expect(payload.section(:assignment)).to eq("reports_to_employment_id" => nil)
  end

  it "validates the salary amount and currency" do
    base = { action_type: "salary_change", employment_id: "x", effective_date: "2026-04-01" }
    expect(errors_for(base.merge(compensation: { annual_salary: "100" }))).to have_key("compensation.annual_salary")
    expect(errors_for(base.merge(compensation: { annual_salary: { amount: "-5", currency: "INR" } })))
      .to have_key("compensation.annual_salary.amount")
    expect(errors_for(base.merge(compensation: { annual_salary: { amount: "5", currency: "XXX" } })))
      .to have_key("compensation.annual_salary.currency")
  end

  it "parses the salary as Money" do
    payload = described_class.new(action_type: "salary_change", employment_id: "x", effective_date: "2026-04-01",
                                  compensation: { annual_salary: { amount: "2200000.50", currency: "INR" } }).validate!
    expect(payload.compensation[:annual_salary]).to eq(Money.from_amount(BigDecimal("2200000.50"), "INR"))
  end

  it "validates dates" do
    expect(errors_for(action_type: "salary_change", employment_id: "x", effective_date: "01/04/2026",
                      compensation: { annual_salary: { amount: "1", currency: "INR" } }))
      .to include("effective_date" => [ "must be an ISO-8601 date" ])
  end

  it "takes a separation's effective date from the last working date" do
    base = { action_type: "separation", employment_id: "x" }
    expect(described_class.new(base.merge(separation: { last_working_date: "2026-06-30" })).validate!.effective_date)
      .to eq(Date.new(2026, 6, 30))
    expect(errors_for(base.merge(effective_date: "2026-06-01", separation: { last_working_date: "2026-06-30" })))
      .to include("effective_date" => [ "must equal separation.last_working_date" ])
    expect(errors_for(base.merge(separation: {}))).to include("separation.last_working_date" => [ "is required" ])
  end
end
