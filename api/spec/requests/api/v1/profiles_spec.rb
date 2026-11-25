require "rails_helper"

RSpec.describe "Profiles" do
  let(:india) { create(:country, :india) }
  let(:person) { create(:person, first_name: "Anitha", last_name: "T", preferred_name: "Anu", dob: Date.new(1990, 5, 1)) }
  let(:employee) { create(:user, person: person) }
  let(:hr) { create(:user, :hr) }
  let!(:home) { create(:address, addressable: person, address_type: "home", line1: "12 MG Road", country: india) }
  let!(:contact) { create(:emergency_contact, person: person, name: "Ravi", is_primary: true) }

  def patch_profile(path, user, body)
    patch path, params: body, headers: auth_headers(user), as: :json
  end

  describe "GET /api/v1/me/profile" do
    it "returns the signed-in person's full profile" do
      get "/api/v1/me/profile", headers: auth_headers(employee)

      expect(response).to have_http_status(:ok)
      expect(json).to include("id" => person.id, "lock_version" => 0, "full_name" => "Anitha T", "dob" => "1990-05-01")
      expect(json["addresses"].first).to include("id" => home.id, "line1" => "12 MG Road", "country" => include("iso_code" => "IN"))
      expect(json["emergency_contacts"].first).to include("id" => contact.id, "name" => "Ravi", "is_primary" => true)
    end
  end

  describe "PATCH /api/v1/me/profile" do
    it "updates contact fields and creates, updates and removes nested records in one request" do
      patch_profile "/api/v1/me/profile", employee,
                    lock_version: 0,
                    preferred_name: "Anitha",
                    phone_number: "+919800000001",
                    addresses: [
                      { id: home.id, line2: "Flat 4B" },
                      { address_type: "mailing", line1: "PO Box 9", city: "Pune", country_id: india.id }
                    ],
                    emergency_contacts: [
                      { id: contact.id, _destroy: true },
                      { name: "Maya", phone_number: "+919822222222", is_primary: true }
                    ]

      expect(response).to have_http_status(:ok)
      expect(json).to include("preferred_name" => "Anitha", "phone_number" => "+919800000001", "lock_version" => 1)
      expect(json["addresses"].map { |a| [ a["line1"], a["line2"] ] }).to eq([ [ "12 MG Road", "Flat 4B" ], [ "PO Box 9", nil ] ])
      expect(json["emergency_contacts"].map { |c| c["name"] }).to eq([ "Maya" ])
    end

    it "moves the primary flag between emergency contacts in one request" do
      backup = create(:emergency_contact, person: person, name: "Sam")

      patch_profile "/api/v1/me/profile", employee,
                    lock_version: 0,
                    emergency_contacts: [ { id: backup.id, is_primary: true }, { id: contact.id, is_primary: false } ]

      expect(response).to have_http_status(:ok)
      expect(json["emergency_contacts"].map { |c| [ c["name"], c["is_primary"] ] }).to eq([ [ "Sam", true ], [ "Ravi", false ] ])
    end

    it "forbids employees from changing HR-only fields" do
      patch_profile "/api/v1/me/profile", employee, lock_version: 0, first_name: "X", dob: "2000-01-01", preferred_name: "Y"

      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to include("code" => "forbidden_fields")
      expect(json.dig("error", "details").keys).to contain_exactly("first_name", "dob")
      expect(person.reload.preferred_name).to eq("Anu")
    end

    it "requires lock_version" do
      patch_profile "/api/v1/me/profile", employee, preferred_name: "Y"
      expect(response).to have_http_status(:bad_request)
    end

    it "rejects a stale lock_version, even when only nested records change" do
      patch_profile "/api/v1/me/profile", employee, lock_version: 0, addresses: [ { id: home.id, line2: "A" } ]
      patch_profile "/api/v1/me/profile", employee, lock_version: 0, addresses: [ { id: home.id, line2: "B" } ]

      expect(response).to have_http_status(:conflict)
      expect(home.reload.line2).to eq("A")
    end

    it "keys nested validation errors by position and saves nothing" do
      patch_profile "/api/v1/me/profile", employee,
                    lock_version: 0, preferred_name: "Changed",
                    addresses: [ { id: home.id, line1: "Ok" }, { address_type: "registered", line1: "", city: "Pune", country_id: india.id } ]

      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("error", "details")).to include("addresses[1].line1", "addresses[1].address_type")
      expect(person.reload.preferred_name).to eq("Anu")
      expect(home.reload.line1).to eq("12 MG Road")
    end

    it "returns 404 for another person's address id" do
      foreign = create(:address)
      patch_profile "/api/v1/me/profile", employee, lock_version: 0, addresses: [ { id: foreign.id, line1: "Hijack" } ]

      expect(response).to have_http_status(:not_found)
      expect(foreign.reload.line1).not_to eq("Hijack")
    end

    it "records who made each change in the audit trail" do
      patch_profile "/api/v1/me/profile", employee, lock_version: 0, preferred_name: "Anitha", addresses: [ { id: home.id, city: "Mysuru" } ]

      expect(person.versions.last.whodunnit).to eq(employee.id)
      expect(home.versions.last).to have_attributes(whodunnit: employee.id, object_changes: include("city" => [ "Bengaluru", "Mysuru" ]))
    end
  end

  describe "/api/v1/people/:person_id/profile" do
    it "lets HR read and edit any field" do
      get "/api/v1/people/#{person.id}/profile", headers: auth_headers(hr)
      expect(response).to have_http_status(:ok)

      patch_profile "/api/v1/people/#{person.id}/profile", hr, lock_version: 0, first_name: "Anita", dob: "1991-06-02", gender: "female"

      expect(response).to have_http_status(:ok)
      expect(json).to include("full_name" => "Anita T", "dob" => "1991-06-02", "gender" => "female")
      expect(person.versions.last.whodunnit).to eq(hr.id)
    end

    it "forbids employees from reading or editing someone else's profile" do
      other = create(:person)

      get "/api/v1/people/#{other.id}/profile", headers: auth_headers(employee)
      expect(response).to have_http_status(:forbidden)

      patch_profile "/api/v1/people/#{other.id}/profile", employee, lock_version: 0, preferred_name: "X"
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 404 for an unknown person" do
      get "/api/v1/people/#{SecureRandom.uuid}/profile", headers: auth_headers(hr)
      expect(response).to have_http_status(:not_found)
    end
  end
end
