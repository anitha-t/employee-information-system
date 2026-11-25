require "rails_helper"

RSpec.describe "GET /api/v1/employment_actions" do
  include_context "with an Indian org"

  before { travel_to(Date.new(2026, 6, 1)) }
  after { travel_back }

  let!(:employment) { hire! }
  let!(:promotion) do
    post_action(action_type: "promotion", employment_id: employment.id, effective_date: "2026-04-01",
                assignment: { position_id: senior_position.id, grade_id: mid.id },
                compensation: { annual_salary: { amount: "2200000", currency: "INR" } })
    EmploymentAction.find(json["id"])
  end
  let!(:us_employment) do
    us_entity = create(:legal_entity, country_code: "US")
    hire!(person: { email: "sam@example.com" },
          employment: { legal_entity_id: us_entity.id, work_email: "sam@acme.example" },
          assignment: { position_id: create(:position, job: job, legal_entity: us_entity).id },
          compensation: { annual_salary: { amount: "150000", currency: "USD" } })
  end

  def list(**query)
    get "/api/v1/employment_actions", params: query, headers: auth_headers(hr)
  end

  it "lists newest first with pagination meta" do
    list(per_page: 2)

    expect(response).to have_http_status(:ok)
    expect(json["data"].map { |a| a["action_type"] }).to eq(%w[promotion hire])
    expect(json["meta"]).to eq("page" => 1, "per_page" => 2, "total_count" => 3)
  end

  it "filters by country, type, employment, dates, author and reviewer" do
    list(country: "us")
    expect(json["data"].map { |a| a.dig("employment", "id") }).to eq([ us_employment.id ])

    list(action_type: "promotion", employment_id: employment.id, effective_from: "2026-03-01", effective_to: "2026-04-30",
         created_by: hr.id)
    expect(json["data"].map { |a| a["id"] }).to eq([ promotion.id ])

    list(reviewed_by: hr.id)
    expect(json["data"]).to be_empty
  end

  it "shows one action with the values before it" do
    get "/api/v1/employment_actions/#{promotion.id}", headers: auth_headers(hr)

    expect(json["previous"]["assignment"]).to include("position" => include("id" => position.id), "grade" => include("id" => low.id))
    expect(json["previous"]["compensation"]["annual_salary"]).to eq("amount" => "1850000.00", "currency" => "INR")
    expect(json["assignment"]["position"]["id"]).to eq(senior_position.id)
  end

  it "shows no previous values for a hire" do
    get "/api/v1/employment_actions/#{employment.employment_actions.hire.sole.id}", headers: auth_headers(hr)

    expect(json["previous"]).to eq("assignment" => nil, "compensation" => nil)
  end

  it "is HR-only" do
    get "/api/v1/employment_actions", headers: auth_headers(create(:user))
    expect(response).to have_http_status(:forbidden)
  end
end
