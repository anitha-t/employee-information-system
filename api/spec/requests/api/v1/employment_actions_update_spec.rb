require "rails_helper"

RSpec.describe "PATCH /api/v1/employment_actions/:id" do
  include_context "with an Indian org"

  before { travel_to(Date.new(2026, 6, 1)) }
  after { travel_back }

  let!(:employment) { hire! }
  let(:hire_action) { employment.employment_actions.hire.sole }

  def promote!(date = "2026-04-01")
    post_action(action_type: "promotion", employment_id: employment.id, effective_date: date,
                assignment: { grade_id: mid.id }, compensation: { annual_salary: { amount: "2200000", currency: "INR" } })
    EmploymentAction.find(json["id"])
  end

  it "corrects the salary in place and keeps the old value in the audit trail" do
    patch_action(hire_action.id, lock_version: 0, reason: "Typo in offer",
                                 compensation: { annual_salary: { amount: "1900000", currency: "INR" } })

    expect(response).to have_http_status(:ok)
    expect(json).to include("lock_version" => 1, "reason" => "Typo in offer",
                            "compensation" => include("annual_salary" => { "amount" => "1900000.00", "currency" => "INR" }))
    compensation = hire_action.compensation.reload
    expect(compensation.versions.where(event: "update").sole.object_changes["annual_salary_cents"]).to eq([ 1_850_000_00, 1_900_000_00 ])
  end

  it "changes only pay frequency without resending the salary" do
    patch_action(hire_action.id, lock_version: 0, compensation: { pay_frequency: "bi_weekly" })

    expect(json["compensation"]).to include("pay_frequency" => "bi_weekly", "annual_salary" => include("amount" => "1850000.00"))
  end

  it "rejects a stale lock_version and saves nothing" do
    patch_action(hire_action.id, lock_version: 0, reason: "first")
    patch_action(hire_action.id, lock_version: 0, compensation: { annual_salary: { amount: "1", currency: "INR" } })

    expect(response).to have_http_status(:conflict)
    expect(hire_action.compensation.reload.annual_salary.to_d).to eq(1_850_000)
  end

  it "requires lock_version" do
    patch_action(hire_action.id, reason: "x")
    expect(response).to have_http_status(:bad_request)
  end

  it "records and clears the review" do
    reviewer = create(:user, :hr)

    patch_action(hire_action.id, lock_version: 0, reviewed_by_user_id: reviewer.id, review_decision: "rejected")
    expect(json).to include("review_decision" => "rejected", "reviewed_at" => be_present)

    patch_action(hire_action.id, lock_version: 1, review_decision: nil)
    expect(json).to include("review_decision" => nil, "reviewed_at" => nil)
  end

  describe "moving the effective date" do
    it "moves the latest action later and earlier, keeping rows contiguous" do
      promotion = promote!

      patch_action(promotion.id, lock_version: 0, effective_date: "2026-05-01")
      expect(response).to have_http_status(:ok)
      expect(employment.compensations.order(:effective_from).map { |c| [ c.effective_from, c.effective_to ] })
        .to eq([ [ Date.new(2026, 1, 5), Date.new(2026, 5, 1) ], [ Date.new(2026, 5, 1), nil ] ])

      patch_action(promotion.id, lock_version: 1, effective_date: "2026-02-01")
      expect(employment.assignments.order(:effective_from).map { |a| [ a.effective_from, a.effective_to ] })
        .to eq([ [ Date.new(2026, 1, 5), Date.new(2026, 2, 1) ], [ Date.new(2026, 2, 1), nil ] ])
    end

    it "moves the hire date when the hire is the only action" do
      patch_action(hire_action.id, lock_version: 0, effective_date: "2026-01-12")

      expect(employment.reload.hire_date).to eq(Date.new(2026, 1, 12))
      expect([ employment.assignments.sole.effective_from, employment.compensations.sole.effective_from ]).to all(eq(Date.new(2026, 1, 12)))
    end

    it "accepts an unchanged effective date on an older action (e.g. a resubmitted form)" do
      promote!

      patch_action(hire_action.id, lock_version: 0, effective_date: "2026-01-05", reason: "Clarified")

      expect(response).to have_http_status(:ok)
      expect(json["reason"]).to eq("Clarified")
    end

    it "only allows the latest action to move" do
      promote!

      patch_action(hire_action.id, lock_version: 0, effective_date: "2026-01-12")

      expect(json.dig("error", "details")).to eq("effective_date" => [ "can only be changed on the employment's latest action" ])
    end

    it "cannot move a change onto or before the previous row's start" do
      promotion = promote!

      patch_action(promotion.id, lock_version: 0, effective_date: "2026-01-05")

      expect(json.dig("error", "details")).to eq("effective_date" => [ "must be after 2026-01-05, when the previous assignment started" ])
    end

    it "rejects malformed dates" do
      patch_action(hire_action.id, lock_version: 0, effective_date: "next week")
      expect(json.dig("error", "details")).to eq("effective_date" => [ "must be an ISO-8601 date" ])
    end
  end

  describe "separation corrections" do
    let(:separation) do
      post_action(action_type: "separation", employment_id: employment.id,
                  separation: { last_working_date: "2026-06-30", separation_type: "voluntary" })
      EmploymentAction.find(json["id"])
    end

    it "moves the last working day and re-closes the rows" do
      patch_action(separation.id, lock_version: 0, separation: { last_working_date: "2026-07-15", separation_reason: "Relocation" })

      expect(response).to have_http_status(:ok)
      expect(json).to include("effective_date" => "2026-07-15",
                              "separation" => include("last_working_date" => "2026-07-15", "separation_reason" => "Relocation"))
      expect(employment.compensations.sole.effective_to).to eq(Date.new(2026, 7, 16))
      expect(employment.reload.status).to eq("on_notice")
    end

    it "separates immediately when the corrected last day is in the past" do
      patch_action(separation.id, lock_version: 0, separation: { last_working_date: "2026-05-20" })

      expect(employment.reload.status).to eq("separated")
    end

    it "cannot move the last day before a later change" do
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-05-01", assignment: { grade_id: mid.id })
      action = separation

      patch_action(action.id, lock_version: 0, separation: { last_working_date: "2026-04-15" })

      expect(json.dig("error", "details")).to eq("separation.last_working_date" => [ "is before a later change; correct that change first" ])
    end

    it "requires a last working day" do
      patch_action(separation.id, lock_version: 0, separation: { last_working_date: nil })
      expect(json.dig("error", "details")).to eq("separation.last_working_date" => [ "is required" ])
    end
  end

  it "rejects sections the action doesn't have" do
    post_action(action_type: "manager_change", employment_id: employment.id, effective_date: "2026-04-01",
                assignment: { reports_to_employment_id: nil })
    manager_change = EmploymentAction.find(json["id"])

    patch_action(manager_change.id, lock_version: 0, compensation: { pay_frequency: "weekly" },
                                    assignment: { grade_id: mid.id }, separation: { last_working_date: "2026-07-01" })

    expect(json.dig("error", "details")).to eq(
      "compensation" => [ "this action has no compensation change" ],
      "assignment.grade_id" => [ "cannot be set by manager_change" ],
      "separation" => [ "is only allowed for a separation" ]
    )
  end

  it "reports a missing assignment row" do
    post_action(action_type: "salary_change", employment_id: employment.id, effective_date: "2026-04-01",
                compensation: { annual_salary: { amount: "2000000", currency: "INR" } })

    patch_action(json["id"], lock_version: 0, assignment: {})

    expect(json.dig("error", "details")).to include("assignment" => [ "this action has no assignment change" ])
  end

  it "prefixes model errors when correcting an assignment" do
    patch_action(hire_action.id, lock_version: 0, assignment: { grade_id: create(:grade).id })

    expect(json.dig("error", "details")).to have_key("assignment.grade")
  end

  it "is HR-only" do
    patch_action(hire_action.id, { lock_version: 0, reason: "x" }, user: create(:user))
    expect(response).to have_http_status(:forbidden)
  end
end
