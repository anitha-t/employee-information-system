require "rails_helper"

RSpec.describe "Salary reports" do
  include_context "with an Indian org"

  before { travel_to(Date.new(2026, 6, 1)) }
  after { travel_back }

  let(:us_entity) { create(:legal_entity, country_code: "US") }

  def hire_in_india(number, amount, **overrides)
    hire!(**{ person: { first_name: "P#{number}", email: "p#{number}@example.com" },
              employment: { work_email: "p#{number}@acme.example" },
              compensation: { annual_salary: { amount: amount.to_s, currency: "INR" } } }.deep_merge(overrides))
  end

  def report(path, **query)
    get "/api/v1/reports/#{path}", params: query, headers: auth_headers(hr)
  end

  def inr(amount) = { "amount" => format("%.2f", amount), "currency" => "INR" }

  describe "(a) GET /reports/salary_stats" do
    before do
      [ 1_000_000, 1_200_000, 1_400_000, 1_600_000, 2_000_000 ].each_with_index { |amount, i| hire_in_india(i, amount) }
      leaver = hire_in_india(10, 9_000_000)
      post_action(action_type: "separation", employment_id: leaver.id, separation: { last_working_date: "2026-05-15" })
      hire_in_india(11, 9_000_000, effective_date: "2026-07-01") # future joiner
    end

    it "returns min, max, average and median for people paid on the date" do
      report("salary_stats", country: "in")

      expect(response).to have_http_status(:ok)
      expect(json).to eq("as_of" => "2026-06-01", "data" => [ {
        "country" => "IN", "currency" => "INR", "headcount" => 5,
        "min" => inr(1_000_000), "max" => inr(2_000_000), "average" => inr(1_440_000), "median" => inr(1_400_000)
      } ])
    end

    it "includes the leaver on a date before their last day" do
      report("salary_stats", country: "IN", as_of: "2026-05-15")

      expect(json["data"].first).to include("headcount" => 6, "max" => inr(9_000_000))
    end

    it "lists every country, with zero headcount where nobody is paid" do
      create(:country, :us)
      create(:country, :australia)

      report("salary_stats")

      expect(json["data"].map { |row| [ row["country"], row["headcount"], row["median"] ] })
        .to eq([ [ "AU", 0, nil ], [ "IN", 5, inr(1_400_000) ], [ "US", 0, nil ] ])
    end

    it "filters by employment type" do
      report("salary_stats", country: "IN", employment_type: "contractor")
      expect(json["data"].first["headcount"]).to eq(0)
    end

    it "rejects unknown countries" do
      report("salary_stats", country: "XX")
      expect(json.dig("error", "details")).to eq("country" => [ "is not a known country code" ])
    end
  end

  describe "(b) GET /reports/salary_by_job" do
    before do
      [ 1_000_000, 1_200_000, 1_400_000, 1_600_000, 2_000_000 ].each_with_index { |amount, i| hire_in_india(i, amount) }
      us_position = create(:position, job: create(:job, title: "Designer"), legal_entity: us_entity)
      hire!(person: { first_name: "Sam", email: "sam@example.com" },
            employment: { legal_entity_id: us_entity.id, work_email: "sam@acme.example" },
            assignment: { position_id: us_position.id, grade_id: us_position.job.min_grade_id },
            compensation: { annual_salary: { amount: "100000", currency: "USD" } })
    end

    it "groups by country and job title and hides groups under 5 people" do
      report("salary_by_job")

      expect(json).to include("as_of" => "2026-06-01", "min_group_size" => 5, "suppressed_groups" => 1)
      expect(json["data"]).to eq([ {
        "country" => "IN", "currency" => "INR", "job_title" => "Software Engineer", "headcount" => 5,
        "min" => inr(1_000_000), "max" => inr(2_000_000), "average" => inr(1_440_000), "median" => inr(1_400_000)
      } ])
    end

    it "filters by job title, case-insensitively" do
      report("salary_by_job", country: "IN", job_title: "software engineer")
      expect(json["data"].map { |row| row["job_title"] }).to eq([ "Software Engineer" ])

      report("salary_by_job", country: "IN", job_title: "Designer")
      expect(json["data"]).to be_empty
    end
  end

  describe "(c) GET /reports/salary_spend" do
    # 2025 has 365 days, so 3,650,000 a year is exactly 10,000 a day.
    before do
      joiner = hire_in_india(1, 3_650_000, effective_date: "2025-07-01")
      post_action(action_type: "salary_change", employment_id: joiner.id, effective_date: "2025-10-01",
                  compensation: { annual_salary: { amount: "7300000", currency: "INR" } })
      leaver = hire_in_india(2, 3_650_000, effective_date: "2024-01-01")
      post_action(action_type: "separation", employment_id: leaver.id, separation: { last_working_date: "2025-03-31" })
    end

    it "prorates each salary by the days it was paid in the year" do
      report("salary_spend", country: "IN", year: 2025, breakdown: "month")

      expect(json).to include("year" => 2025, "from" => "2025-01-01", "to" => "2025-12-31", "partial" => false)
      row = json["data"].sole
      # leaver: Jan–Mar = 90 days x 10,000; joiner: 92 days x 10,000 + 92 days x 20,000
      expect(row).to include("country" => "IN", "employee_count" => 2, "total_spend" => inr(3_660_000))
      expect(row["breakdown"].map { |m| [ m["month"], m["spend"]["amount"] ] }).to eq([
        [ "2025-01", "310000.00" ], [ "2025-02", "280000.00" ], [ "2025-03", "310000.00" ],
        [ "2025-07", "310000.00" ], [ "2025-08", "310000.00" ], [ "2025-09", "300000.00" ],
        [ "2025-10", "620000.00" ], [ "2025-11", "600000.00" ], [ "2025-12", "620000.00" ]
      ])
    end

    it "counts the current year up to today" do
      report("salary_spend", country: "IN", year: 2026)

      # 7,300,000 / 365 = 20,000 a day for 152 days (1 Jan – 1 Jun)
      expect(json).to include("from" => "2026-01-01", "to" => "2026-06-01", "partial" => true)
      expect(json["data"].sole).to include("employee_count" => 1, "total_spend" => inr(3_040_000))
      expect(json["data"].sole).not_to have_key("breakdown")
    end

    it "returns zero for a future year" do
      report("salary_spend", country: "IN", year: 2027)

      expect(json).to include("to" => nil, "partial" => true)
      expect(json["data"].sole).to include("employee_count" => 0, "total_spend" => inr(0))
    end

    it "defaults to the current year and validates the year" do
      report("salary_spend", country: "IN")
      expect(json["year"]).to eq(2026)

      report("salary_spend", year: "twenty")
      expect(json.dig("error", "details")).to eq("year" => [ "must be a year between 2000 and 2100" ])
    end
  end

  it "validates as_of" do
    report("salary_stats", as_of: "June")
    expect(json.dig("error", "details")).to eq("as_of" => [ "must be an ISO-8601 date" ])
  end

  it "is HR-only" do
    get "/api/v1/reports/salary_stats", headers: auth_headers(create(:user))
    expect(response).to have_http_status(:forbidden)
  end
end
