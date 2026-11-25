require "rails_helper"

# Regression guard: SQL in any user-supplied value is treated as data.
# Each request must succeed or fail with a clean 4xx, never a 500, and the
# tables must survive.
RSpec.describe "SQL injection attempts" do
  include_context "with an Indian org"

  before { hire! }

  # (tsquery operators like "priya:* | !" are covered in employees_spec.rb:
  # they are stripped and the text is searched normally.)
  payloads = [
    "'; DROP TABLE people; --",
    "' OR '1'='1",
    "IN' OR 1=1 --",
    "%' OR employee_number LIKE '%",
    "1); DELETE FROM employments; --",
    "\\'; SELECT pg_sleep(5); --"
  ]

  def get_as_hr(path, query)
    get path, params: query, headers: auth_headers(hr)
    expect(response.status).to be < 500, "#{path} #{query.inspect} -> #{response.status}: #{response.body}"
  end

  payloads.each do |payload|
    it "treats #{payload.inspect} as data" do
      get_as_hr("/api/v1/employees", q: payload)
      expect(json["data"]).to be_empty
      get_as_hr("/api/v1/employees", country: payload, status: payload, employment_type: payload, team_id: payload)
      get_as_hr("/api/v1/employment_actions", country: payload, action_type: payload, employment_id: payload,
                                              created_by: payload, effective_from: payload)
      get_as_hr("/api/v1/reports/salary_stats", country: payload)
      get_as_hr("/api/v1/reports/salary_by_job", job_title: payload, employment_type: payload)
      get_as_hr("/api/v1/reports/salary_spend", country: payload, year: payload)
      get_as_hr("/api/v1/employees/#{CGI.escape(payload)}", {})

      expect([ Person.count, Employment.count ]).to eq([ 2, 1 ]) # HR's person + the hire; nothing dropped or deleted
    end
  end

  it "escapes LIKE wildcards in employee number and work email search" do
    get_as_hr("/api/v1/employees", q: "%")
    expect(json["data"]).to be_empty
    get_as_hr("/api/v1/employees", q: "_")
    expect(json["data"]).to be_empty
  end
end
