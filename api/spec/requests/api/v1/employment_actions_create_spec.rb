require "rails_helper"

RSpec.describe "POST /api/v1/employment_actions" do
  include_context "with an Indian org"

  before { travel_to(Date.new(2026, 6, 1)) }
  after { travel_back }

  describe "hire" do
    it "creates the person, employment, first assignment and compensation" do
      post_action(hire_payload)

      expect(json).to include("action_type" => "hire", "effective_date" => "2026-01-05", "reason" => "Backfill",
                              "created_by" => include("id" => hr.id))
      expect(json["employment"]).to include("employee_number" => match(/\AE\d{6}\z/), "status" => "active",
                                            "person" => include("display_name" => "Priya Sharma"))
      expect(json["assignment"]).to include("effective_from" => "2026-01-05", "effective_to" => nil,
                                            "job" => include("title" => "Software Engineer"), "grade" => include("id" => low.id))
      expect(json["compensation"]).to include("annual_salary" => { "amount" => "1850000.00", "currency" => "INR" },
                                              "pay_frequency" => "monthly")
    end

    it "sets the hire date and records HR as the author in the audit trail" do
      employment = hire!

      expect(employment.hire_date).to eq(Date.new(2026, 1, 5))
      expect(employment.compensations.first.versions.last.whodunnit).to eq(hr.id)
    end

    it "rehires a separated person by person_id" do
      person = create(:person)
      create(:employment, person: person, legal_entity: entity, status: "separated", last_working_date: Date.new(2025, 12, 31),
                          hire_date: Date.new(2024, 1, 1))

      post_action(hire_payload(person: nil).except(:person).merge(person_id: person.id))

      expect(response).to have_http_status(:created)
      expect(person.employments.count).to eq(2)
    end

    it "refuses to hire someone who already has an active employment" do
      person = hire!.person

      post_action(hire_payload.except(:person).merge(person_id: person.id,
                                                     employment: { legal_entity_id: entity.id, employment_type: "full_time" }))

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("person" => [ "already has an active employment" ])
    end

    it "lists every missing section" do
      post_action({ action_type: "hire", effective_date: "2026-01-05" })

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details").keys).to include("person", "employment", "assignment", "compensation")
    end

    it "requires the legal entity's currency" do
      post_action(hire_payload(compensation: { annual_salary: { amount: "100000", currency: "USD" } }))

      expect(json.dig("error", "details")).to eq("compensation.annual_salary.currency" => [ "must be INR for #{entity.name}" ])
      expect(Person.where(email: "priya@example.com")).to be_none
    end

    it "prefixes model errors with the payload section and saves nothing" do
      foreign_position = create(:position, job: job, legal_entity: create(:legal_entity, country_code: "US"))

      post_action(hire_payload(assignment: { position_id: foreign_position.id }))

      expect(json.dig("error", "details")).to include("assignment.position" => [ "must belong to the employment's legal entity" ])
      expect([ Person.where(email: "priya@example.com").count, Employment.count, EmploymentAction.count ]).to eq([ 0, 0, 0 ])
    end

    it "warns, without failing, when the salary is outside the grade's band" do
      create(:salary_band, grade: low, country: entity.country, min_cents: 1_000_000_00, max_cents: 1_500_000_00,
                           effective_from: Date.new(2026, 1, 1))

      post_action(hire_payload)

      expect(response).to have_http_status(:created)
      expect(json["warnings"]).to eq([ "annual_salary 1850000.00 is outside the #{low.code} band for IN (1000000.0–1500000.0 INR)" ])
    end
  end

  describe "changes to an existing employment" do
    let!(:employment) { hire! }

    it "promotes: closes the current rows and opens new ones, copying unchanged fields" do
      manager = create(:employment, legal_entity: entity)
      employment.assignments.first.update!(reports_to_employment: manager)

      post_action(action_type: "promotion", employment_id: employment.id, effective_date: "2026-04-01",
                  assignment: { position_id: senior_position.id, grade_id: mid.id },
                  compensation: { annual_salary: { amount: "2200000", currency: "INR" } })

      expect(response).to have_http_status(:created)
      old_row, new_row = employment.assignments.order(:effective_from).to_a
      expect(old_row.effective_to).to eq(Date.new(2026, 4, 1))
      expect(new_row).to have_attributes(position: senior_position, grade: mid, reports_to_employment: manager, effective_to: nil)
      expect(employment.compensations.order(:effective_from).map { |c| [ c.annual_salary.to_d, c.effective_to, c.pay_frequency ] })
        .to eq([ [ 1_850_000, Date.new(2026, 4, 1), "monthly" ], [ 2_200_000, nil, "monthly" ] ])
    end

    it "changes only the salary" do
      post_action(action_type: "salary_change", employment_id: employment.id, effective_date: "2026-04-01",
                  compensation: { annual_salary: { amount: "2000000", currency: "INR" } })

      expect(response).to have_http_status(:created)
      expect(json["assignment"]).to be_nil
      expect(employment.current_compensation(on: Date.new(2026, 4, 1)).annual_salary).to eq(Money.from_amount(2_000_000, "INR"))
    end

    it "removes the manager with a manager_change to null" do
      employment.assignments.first.update!(reports_to_employment: create(:employment, legal_entity: entity))

      post_action(action_type: "manager_change", employment_id: employment.id, effective_date: "2026-03-01",
                  assignment: { reports_to_employment_id: nil })

      expect(response).to have_http_status(:created)
      expect(employment.current_assignment(on: Date.new(2026, 3, 1)).reports_to_employment).to be_nil
    end

    it "requires changes to be made in date order" do
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-04-01", assignment: { grade_id: mid.id })
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-03-01", assignment: { grade_id: high.id })

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("effective_date" => [ "must be after the latest assignment change (2026-04-01)" ])
    end

    it "rejects a change dated before the hire date" do
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2025-12-01", assignment: { grade_id: mid.id })

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to eq("effective_date" => [ "cannot be before the hire date" ])
    end

    it "rejects a grade outside the job's range" do
      outside = create(:grade)

      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-04-01", assignment: { grade_id: outside.id })

      expect(json.dig("error", "details")).to have_key("assignment.grade")
    end

    it "requires the reviewer to be an HR user" do
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-04-01",
                  assignment: { grade_id: mid.id }, reviewed_by_user_id: create(:user).id, review_decision: "approved")

      expect(json.dig("error", "details")).to eq("reviewed_by_user" => [ "must be an HR user" ])
    end

    it "records an HR reviewer and the review time" do
      reviewer = create(:user, :hr)

      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-04-01",
                  assignment: { grade_id: mid.id }, reviewed_by_user_id: reviewer.id, review_decision: "approved")

      expect(json).to include("reviewed_by" => include("id" => reviewer.id), "review_decision" => "approved", "reviewed_at" => be_present)
    end
  end

  describe "separation" do
    let!(:employment) { hire! }
    let(:employee_user) { create(:user, person: employment.person) }

    def separate(last_working_date)
      post_action(action_type: "separation", employment_id: employment.id,
                  separation: { resignation_date: "2026-05-01", last_working_date: last_working_date,
                                separation_type: "voluntary", separation_reason: "Higher studies", eligible_for_rehire: true })
    end

    it "puts a future leaver on notice and closes rows the day after the last working day" do
      separate("2026-06-30")

      expect(response).to have_http_status(:created)
      expect(json).to include("effective_date" => "2026-06-30",
                              "separation" => include("last_working_date" => "2026-06-30", "separation_type" => "voluntary"))
      expect(employment.reload.status).to eq("on_notice")
      expect([ employment.assignments.sole.effective_to, employment.compensations.sole.effective_to ]).to all(eq(Date.new(2026, 7, 1)))
    end

    it "separates a past leaver immediately and signs them out" do
      headers = auth_headers(employee_user)

      separate("2026-05-15")

      expect(employment.reload.status).to eq("separated")
      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "blocks further changes once someone is on notice" do
      separate("2026-06-30")

      post_action(action_type: "salary_change", employment_id: employment.id, effective_date: "2026-06-15",
                  compensation: { annual_salary: { amount: "1", currency: "INR" } })

      expect(json.dig("error", "details")).to eq("employment_id" => [ "is on notice; no further changes can be made" ])
    end

    it "cannot end before a later change" do
      post_action(action_type: "regrade", employment_id: employment.id, effective_date: "2026-05-01", assignment: { grade_id: mid.id })

      separate("2026-04-15")

      expect(json.dig("error", "details")).to eq("separation.last_working_date" => [ "is before a later change; correct that change first" ])
    end
  end

  describe "access" do
    it "is HR-only" do
      post_action(hire_payload, user: create(:user))
      expect(response).to have_http_status(:forbidden)
    end

    it "requires authentication" do
      post "/api/v1/employment_actions", params: hire_payload, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
