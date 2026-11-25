require "rails_helper"

RSpec.describe "Reference data" do
  let(:employee) { create(:user) }
  let(:hr) { create(:user, :hr) }
  let(:india) { create(:country, :india) }
  let(:us) { create(:country, :us) }

  def fetch(path, user: employee, **query)
    get "/api/v1/#{path}", params: query, headers: auth_headers(user)
  end

  def data = json["data"]

  %w[countries locations legal_entities teams grades jobs positions].each do |path|
    it "requires sign-in for /#{path} and lets any signed-in user read it" do
      get "/api/v1/#{path}"
      expect(response).to have_http_status(:unauthorized)

      fetch(path)
      expect(response).to have_http_status(:ok)
      expect(data).to eq([])
    end
  end

  it "rejects an unknown country code" do
    fetch("locations", country: "XX")

    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("error", "details")).to eq("country" => [ "is not a known country code" ])
  end

  it "rejects a boolean flag that is not true or false" do
    fetch("grades", include_inactive: "yes")

    expect(json.dig("error", "details")).to eq("include_inactive" => [ "must be true or false" ])
  end

  describe "GET /api/v1/countries" do
    it "lists countries by name with their currency" do
      india
      us

      fetch("countries")

      expect(data).to eq([
        { "id" => india.id, "iso_code" => "IN", "name" => "India", "currency" => "INR" },
        { "id" => us.id, "iso_code" => "US", "name" => "United States", "currency" => "USD" }
      ])
    end
  end

  describe "GET /api/v1/locations" do
    let!(:bengaluru) { create(:location, country: india, city: "Bengaluru", state: "KA") }

    before do
      create(:location, country: us, city: "Austin")
      create(:location, country: india, city: "Agra", is_active: false)
    end

    it "lists active locations by city, filtered by country (case-insensitive)" do
      fetch("locations", country: "in")

      expect(data).to eq([ { "id" => bengaluru.id, "city" => "Bengaluru", "state" => "KA", "is_active" => true,
                             "country" => { "id" => india.id, "iso_code" => "IN", "name" => "India" } } ])
    end

    it "includes inactive locations on request" do
      fetch("locations", include_inactive: "true")

      expect(data.pluck("city")).to eq(%w[Agra Austin Bengaluru])
    end
  end

  describe "GET /api/v1/legal_entities" do
    let!(:entity) { create(:legal_entity, name: "Acme India", country_code: "IN") }

    before do
      entity.addresses.create!(address_type: "registered", line1: "100 MG Road", city: "Bengaluru", postal_code: "560001", country: india)
      create(:legal_entity, name: "Acme Inc", country_code: "US")
      create(:legal_entity, name: "Old Acme", country_code: "IN", is_active: false)
    end

    it "lists entities with their country, currency and registered address" do
      fetch("legal_entities", country: "IN")

      expect(data.size).to eq(1)
      expect(data.first).to include(
        "id" => entity.id, "name" => "Acme India", "is_active" => true, "effective_from" => "2020-01-01",
        "location" => include("id" => entity.location_id),
        "country" => { "id" => india.id, "iso_code" => "IN", "name" => "India", "currency" => "INR" }
      )
      expect(data.first["addresses"]).to contain_exactly(include("address_type" => "registered", "line1" => "100 MG Road",
                                                                 "country" => include("iso_code" => "IN")))
    end

    it "lists every country's entities by name, inactive ones on request" do
      fetch("legal_entities")
      expect(data.pluck("name")).to eq([ "Acme Inc", "Acme India" ])

      fetch("legal_entities", include_inactive: "1")
      expect(data.pluck("name")).to eq([ "Acme Inc", "Acme India", "Old Acme" ])
    end
  end

  describe "GET /api/v1/teams" do
    let!(:engineering) { create(:team, name: "Engineering") }
    let!(:platform) { create(:team, name: "Platform", parent: engineering) }
    let!(:sales) { create(:team, name: "Sales") }

    before { create(:team, name: "Archived", parent: sales, is_active: false) }

    it "lists active teams flat, with parent ids" do
      fetch("teams")

      expect(data).to eq([
        { "id" => engineering.id, "name" => "Engineering", "parent_id" => nil, "is_active" => true },
        { "id" => platform.id, "name" => "Platform", "parent_id" => engineering.id, "is_active" => true },
        { "id" => sales.id, "name" => "Sales", "parent_id" => nil, "is_active" => true }
      ])
    end

    it "nests sub-teams with tree=true" do
      fetch("teams", tree: "true")

      expect(data.pluck("name")).to eq(%w[Engineering Sales])
      expect(data.first["children"].pluck("name", "children")).to eq([ [ "Platform", [] ] ])
      expect(data.last["children"]).to eq([])
    end

    it "shows a team whose parent is inactive at the top of the tree" do
      engineering.update!(is_active: false)

      fetch("teams", tree: "true")

      expect(data.pluck("name")).to eq(%w[Platform Sales])
    end
  end

  describe "GET /api/v1/grades" do
    it "lists active grades by rank" do
      high = create(:grade, rank: 20, code: "G20")
      low = create(:grade, rank: 10, code: "G10")
      create(:grade, rank: 30, code: "G30", is_active: false)

      fetch("grades")

      expect(data).to eq([
        { "id" => low.id, "code" => "G10", "name" => "Grade 10", "rank" => 10, "is_active" => true },
        { "id" => high.id, "code" => "G20", "name" => "Grade 20", "rank" => 20, "is_active" => true }
      ])
    end
  end

  describe "GET /api/v1/jobs" do
    let(:low) { create(:grade) }
    let(:high) { create(:grade) }
    let!(:engineer) do
      create(:job, code: "SWE", title: "Software Engineer", min_grade: low, max_grade: high, description: "Builds things",
                   countries: [ india, us ])
    end

    before do
      create(:job, code: "SALES", title: "Sales Executive", min_grade: low, max_grade: high, countries: [ us ])
      create(:job, code: "OLD", title: "Typist", min_grade: low, max_grade: high, is_active: false)
    end

    it "lists active jobs by title with grade range and countries" do
      fetch("jobs")

      expect(data.pluck("title")).to eq([ "Sales Executive", "Software Engineer" ])
      expect(data.last).to eq(
        "id" => engineer.id, "code" => "SWE", "title" => "Software Engineer", "level" => "L3", "description" => "Builds things",
        "is_active" => true, "min_grade" => { "id" => low.id, "code" => low.code, "rank" => low.rank },
        "max_grade" => { "id" => high.id, "code" => high.code, "rank" => high.rank }, "countries" => %w[IN US]
      )
    end

    it "filters by country, keeping every country in the result" do
      fetch("jobs", country: "IN")

      expect(data.pluck("code", "countries")).to eq([ [ "SWE", %w[IN US] ] ])
    end

    it "searches title and code, treating % and _ literally" do
      { "engineer" => [ "SWE" ], "sales" => [ "SALES" ], "%" => [], "_" => [] }.each do |q, codes|
        fetch("jobs", q: q)
        expect(data.pluck("code")).to eq(codes), "q=#{q.inspect}"
      end
    end
  end

  describe "GET /api/v1/positions" do
    include_context "with an Indian org"

    let(:other_team) { create(:team) }

    before do
      travel_to(Date.new(2026, 6, 1))
      create(:position, :remote, code: "IN-REMOTE", job: job, legal_entity: entity, team: other_team, required_head_count: 2)
      position.update!(code: "IN-A", required_head_count: 1)
      senior_position.update!(code: "IN-B", required_head_count: 3)
      hire!(assignment: { position_id: position.id, grade_id: low.id })
      create(:position, code: "IN-CLOSED", job: job, legal_entity: entity, effective_to: Date.new(2026, 1, 1))
      create(:position, code: "US-A", legal_entity: create(:legal_entity, country_code: "US"))
    end

    after { travel_back }

    it "lists positions open today, with head counts and vacancies" do
      fetch("positions")

      expect(data.pluck("code")).to eq(%w[IN-A IN-B IN-REMOTE US-A])
      expect(data.first).to include(
        "id" => position.id, "is_remote" => false, "required_head_count" => 1, "filled_head_count" => 1, "vacancies" => 0,
        "job" => { "id" => job.id, "code" => job.code, "title" => "Software Engineer" },
        "team" => { "id" => position.team_id, "name" => position.team.name },
        "legal_entity" => { "id" => entity.id, "name" => entity.name },
        "country" => { "id" => india.id, "iso_code" => "IN", "currency" => "INR" },
        "location" => include("id" => entity.location_id)
      )
      expect(data.third).to include("code" => "IN-REMOTE", "is_remote" => true, "location" => nil, "vacancies" => 2)
      expect(json["meta"]).to eq("page" => 1, "per_page" => 50, "total_count" => 4, "as_of" => "2026-06-01")
    end

    it "filters by entity, team, job, country, search text and vacancy" do
      {
        { legal_entity_id: entity.id } => %w[IN-A IN-B IN-REMOTE],
        { team_id: other_team.id } => %w[IN-REMOTE],
        { job_id: job.id, vacant: "true" } => %w[IN-B IN-REMOTE],
        { country: "US" } => %w[US-A],
        { q: "remote" } => %w[IN-REMOTE],
        { vacant: "false" } => %w[IN-A IN-B IN-REMOTE US-A]
      }.each do |query, codes|
        fetch("positions", **query)
        expect(data.pluck("code")).to eq(codes), query.inspect
      end
    end

    it "uses as_of for which positions are open and who fills them" do
      fetch("positions", as_of: "2025-12-01", legal_entity_id: entity.id)

      expect(data.pluck("code", "filled_head_count")).to eq([ [ "IN-A", 0 ], [ "IN-B", 0 ], [ "IN-CLOSED", 0 ], [ "IN-REMOTE", 0 ] ])
    end

    it "paginates" do
      fetch("positions", per_page: "2", page: "2")

      expect(data.pluck("code")).to eq(%w[IN-REMOTE US-A])
      expect(json["meta"]).to include("page" => 2, "per_page" => 2, "total_count" => 4)
    end
  end

  describe "GET /api/v1/salary_bands" do
    let(:junior) { create(:grade, rank: 1, code: "G1") }
    let(:senior) { create(:grade, rank: 2, code: "G2") }

    before do
      create(:salary_band, grade: senior, country: india, min_cents: 1_500_000_00, max_cents: 2_500_000_00)
      create(:salary_band, grade: junior, country: india, min_cents: 600_000_00, max_cents: 1_000_000_00,
                           effective_from: Date.new(2026, 1, 1), effective_to: Date.new(2027, 1, 1))
      create(:salary_band, grade: junior, country: india, min_cents: 700_000_00, max_cents: 1_100_000_00, effective_from: Date.new(2027, 1, 1))
      create(:salary_band, grade: junior, country: us, currency: "USD", min_cents: 60_000_00, max_cents: 85_000_00)
    end

    it "is HR-only" do
      fetch("salary_bands")

      expect(response).to have_http_status(:forbidden)
    end

    it "lists bands in effect on as_of by country then grade" do
      travel_to(Date.new(2026, 6, 1)) { fetch("salary_bands", user: hr) }

      expect(data.map { |b| [ b.dig("country", "iso_code"), b.dig("grade", "code"), b.dig("min", "amount") ] })
        .to eq([ %w[IN G1 600000.00], %w[IN G2 1500000.00], %w[US G1 60000.00] ])
      expect(data.first).to include("currency" => "INR", "effective_from" => "2026-01-01", "effective_to" => "2027-01-01",
                                    "max" => { "amount" => "1000000.00", "currency" => "INR" })
    end

    it "filters by country, grade and date" do
      fetch("salary_bands", user: hr, country: "IN", grade_id: junior.id, as_of: "2027-03-01")

      expect(data.map { |b| b.dig("min", "amount") }).to eq([ "700000.00" ])
    end
  end
end
