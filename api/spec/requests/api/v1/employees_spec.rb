require "rails_helper"

RSpec.describe "Employees" do
  include_context "with an Indian org"

  before { travel_to(Date.new(2026, 6, 1)) }
  after { travel_back }

  let!(:priya) { hire!(person: { first_name: "Priya", last_name: "Sharma", email: "priya@example.com" }) }
  let!(:john) do
    hire!(person: { first_name: "John", last_name: "Smith", email: "john@example.com", preferred_name: "Johnny" },
          employment: { work_email: "jsmith@acme.example" },
          assignment: { position_id: senior_position.id, grade_id: mid.id, reports_to_employment_id: priya.id },
          compensation: { annual_salary: { amount: "2500000", currency: "INR" } })
  end

  def list(**query)
    get "/api/v1/employees", params: query, headers: auth_headers(hr)
  end

  def names = json["data"].map { |e| e.dig("person", "full_name") }

  describe "GET /api/v1/employees" do
    it "lists employees by name with their current job, team, grade, manager and salary" do
      list

      expect(response).to have_http_status(:ok)
      expect(names).to eq([ "John Smith", "Priya Sharma" ])
      expect(json["data"].first).to include(
        "employee_number" => john.employee_number, "status" => "active", "work_email" => "jsmith@acme.example",
        "person" => include("display_name" => "Johnny"), "country" => include("iso_code" => "IN", "currency" => "INR"),
        "job" => include("title" => "Software Engineer"), "grade" => include("id" => mid.id),
        "manager" => { "employment_id" => priya.id, "display_name" => "Priya Sharma" },
        "annual_salary" => { "amount" => "2500000.00", "currency" => "INR" }
      )
      expect(json["meta"]).to eq("page" => 1, "per_page" => 50, "total_count" => 2, "as_of" => "2026-06-01")
    end

    it "searches by name prefix, typo, employee number and work email" do
      { "pri" => [ "Priya Sharma" ], "smth" => [ "John Smith" ], "jon smith" => [ "John Smith" ], "xyz" => [],
        priya.employee_number.downcase => [ "Priya Sharma" ], "jsmith@" => [ "John Smith" ] }.each do |q, expected|
        list(q: q)
        expect(names).to eq(expected), "q=#{q.inspect} returned #{names.inspect}"
      end
    end

    it "ranks closer matches first" do
      hire!(person: { first_name: "Priyanka", last_name: "Rao", email: "priyanka@example.com" },
            employment: { work_email: "priyanka@acme.example" })

      list(q: "priya sharma")

      expect(names.first).to eq("Priya Sharma")
    end

    it "handles a search with no letters or digits" do
      list(q: "@@")

      expect(response).to have_http_status(:ok)
      expect(names).to be_empty
    end

    it "ignores tsquery operators in the search text" do
      list(q: "priya & | ! :* (")

      expect(response).to have_http_status(:ok)
      expect(names).to eq([ "Priya Sharma" ])
    end

    it "filters by country, team, job, grade, legal entity and employment type" do
      list(country: "in", grade_id: mid.id, job_id: job.id, team_id: senior_position.team_id,
           legal_entity_id: entity.id, employment_type: "full_time")
      expect(names).to eq([ "John Smith" ])

      list(country: "US")
      expect(names).to be_empty
    end

    it "hides leavers unless asked" do
      post_action(action_type: "separation", employment_id: priya.id, separation: { last_working_date: "2026-05-15" })

      list
      expect(names).to eq([ "John Smith" ])
      list(status: "separated")
      expect(json["data"].map { |e| [ e.dig("person", "full_name"), e["job"]["title"] ] }).to eq([ [ "Priya Sharma", "Software Engineer" ] ])
      list(status: "all")
      expect(names.size).to eq(2)
    end

    it "shows the job and salary on an as_of date" do
      post_action(action_type: "salary_change", employment_id: priya.id, effective_date: "2026-04-01",
                  compensation: { annual_salary: { amount: "2000000", currency: "INR" } })

      list(as_of: "2026-03-31", q: "priya")
      expect(json["data"].first["annual_salary"]["amount"]).to eq("1850000.00")
      list(q: "priya")
      expect(json["data"].first["annual_salary"]["amount"]).to eq("2000000.00")
    end

    it "shows upcoming hires with their first job" do
      hire!(effective_date: "2026-07-01", person: { first_name: "Zara", email: "zara@example.com" },
            employment: { work_email: "zara@acme.example" })

      list(q: "zara")

      expect(json["data"].first).to include("hire_date" => "2026-07-01", "job" => include("title" => "Software Engineer"))
    end

    it "paginates" do
      list(per_page: 1, page: 2)

      expect(names).to eq([ "Priya Sharma" ])
      expect(json["meta"]).to include("page" => 2, "per_page" => 1, "total_count" => 2)
    end

    it "rejects malformed dates" do
      list(as_of: "yesterday")
      expect(json.dig("error", "details")).to eq("as_of" => [ "must be an ISO-8601 date" ])
    end

    it "is HR-only" do
      get "/api/v1/employees", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/employees/:employment_id" do
    it "returns the employee with employment details" do
      get "/api/v1/employees/#{john.id}", headers: auth_headers(hr)

      expect(response).to have_http_status(:ok)
      expect(json).to include("employment_id" => john.id, "person" => include("full_name" => "John Smith"))
      expect(json["employment"]).to include("lock_version" => 0, "notice_period_days" => nil,
                                            "assignment_effective_from" => "2026-01-05")
    end

    it "does not reveal whether an id exists to non-HR users" do
      get "/api/v1/employees/#{SecureRandom.uuid}", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 404 for unknown ids" do
      get "/api/v1/employees/#{SecureRandom.uuid}", headers: auth_headers(hr)
      expect(response).to have_http_status(:not_found)
    end
  end
end
