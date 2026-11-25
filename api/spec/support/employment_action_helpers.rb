# Shared setup for employment action request specs: an Indian legal entity
# with one job (grades low..high), two positions, and an HR user.
RSpec.shared_context "with an Indian org" do
  let(:entity) { create(:legal_entity, country_code: "IN") }
  # Created together, in order, so ranks are low < mid < high.
  let(:grades) { create_list(:grade, 3) }

  def low = grades[0]
  def mid = grades[1]
  def high = grades[2]
  let(:job) { create(:job, title: "Software Engineer", min_grade: low, max_grade: high) }
  let(:position) { create(:position, job: job, legal_entity: entity) }
  let(:senior_position) { create(:position, job: job, legal_entity: entity) }
  let(:hr) { create(:user, :hr) }

  def hire_payload(**overrides)
    {
      action_type: "hire", effective_date: "2026-01-05", reason: "Backfill",
      person: { first_name: "Priya", last_name: "Sharma", email: "priya@example.com", phone_number: "+919800000000" },
      employment: { legal_entity_id: entity.id, employment_type: "full_time", work_email: "priya@acme.example" },
      assignment: { position_id: position.id, grade_id: low.id },
      compensation: { annual_salary: { amount: "1850000.00", currency: "INR" }, pay_frequency: "monthly" }
    }.deep_merge(overrides)
  end

  # Accepts a payload hash or keyword attributes.
  def post_action(body = nil, user: hr, **attributes)
    post "/api/v1/employment_actions", params: body || attributes, headers: auth_headers(user), as: :json
  end

  def patch_action(id, body = nil, user: hr, **attributes)
    patch "/api/v1/employment_actions/#{id}", params: body || attributes, headers: auth_headers(user), as: :json
  end

  # Hires via the API and returns the new Employment.
  def hire!(**overrides)
    post_action(hire_payload(**overrides))
    raise "hire failed: #{response.body}" unless response.status == 201

    Employment.find(json.dig("employment", "id"))
  end
end
