require "rails_helper"

# Rails parses ?x[]=1 as an Array and ?x[a]=1 as a hash. Every query
# parameter must answer 422 for those, never 500.
RSpec.describe "Malformed query parameters" do
  let(:hr) { create(:user, :hr) }

  {
    "/api/v1/employees" => %i[q country status legal_entity_id team_id job_id grade_id employment_type as_of page per_page],
    "/api/v1/employment_actions" => %i[employment_id action_type created_by reviewed_by country effective_from effective_to page per_page],
    "/api/v1/reports/salary_stats" => %i[country as_of employment_type],
    "/api/v1/reports/salary_by_job" => %i[country job_title as_of employment_type],
    "/api/v1/reports/salary_spend" => %i[country year breakdown]
  }.each do |path, keys|
    keys.each do |key|
      it "#{path} rejects #{key} as a list or object" do
        [ "#{key}[]=IN&#{key}[]=US", "#{key}[a]=1" ].each do |query|
          get "#{path}?#{query}", headers: auth_headers(hr)

          expect(response).to have_http_status(:unprocessable_content), "#{query} -> #{response.status}: #{response.body}"
          expect(json.dig("error", "details")).to eq(key.to_s => [ "must be a single value" ])
        end
      end
    end
  end

  it "rejects non-numeric page numbers" do
    get "/api/v1/employees?page=two", headers: auth_headers(hr)
    expect(json.dig("error", "details")).to eq("page" => [ "must be a whole number" ])
  end

  it "rejects malformed date filters on employment actions" do
    get "/api/v1/employment_actions?effective_from=yesterday", headers: auth_headers(hr)
    expect(json.dig("error", "details")).to eq("effective_from" => [ "must be an ISO-8601 date" ])
  end
end
