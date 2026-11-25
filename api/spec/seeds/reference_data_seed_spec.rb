require "rails_helper"
require Rails.root.join("db/seeds/reference_data").to_s

RSpec.describe Seeds::ReferenceData do
  subject(:seed) { described_class.new(logger: nil) }

  before { %w[IN US AU].each { |code| create(:country, iso_code: code) } }

  it "creates a valid org for every country" do
    org = seed.call

    records = [ Grade, Team, Location, LegalEntity, SalaryBand, Job, JobCountry, Position, Address ].flat_map(&:all)
    expect(records.reject(&:valid?).map { |r| [ r.class.name, r.errors.full_messages ] }).to eq([])
    expect(org.entities.map { |e| e[:entity].country.iso_code }).to eq(%w[IN US AU])
  end

  it "gives every entity bands for each grade and a registered address, and every job a description" do
    seed.call

    expect(SalaryBand.count).to eq(3 * described_class::GRADE_COUNT)
    expect(LegalEntity.all).to all(satisfy { |entity| entity.addresses.registered.one? })
    expect(Job.where(description: nil)).to be_empty
  end

  it "keeps each position's job, entity and location consistent" do
    seed.call

    Position.includes(:legal_entity, :location).find_each do |position|
      expect(position.location&.country).to eq(position.is_remote? ? nil : position.legal_entity.country)
    end
    expect(Position.where(is_remote: true).count).to eq(described_class::OPEN_POSITIONS.count(&:last))
  end

  it "is idempotent and fills in what is missing without overwriting" do
    seed.call
    Job.find_by!(code: "SWE").update!(description: nil)
    Job.find_by!(code: "SSWE").update!(title: "Renamed")
    LegalEntity.first.addresses.destroy_all

    expect { described_class.new(logger: nil).call }
      .not_to change { [ Grade, Team, Location, LegalEntity, SalaryBand, Job, JobCountry, Position ].map(&:count) }
    expect(Job.find_by!(code: "SWE").description).to be_present
    expect(Job.find_by!(code: "SSWE").title).to eq("Renamed")
    expect(LegalEntity.first.addresses.registered.count).to eq(1)
  end

  it "logs a summary" do
    output = StringIO.new
    described_class.new(logger: output).call

    expect(output.string).to start_with("Reference data: 8 grades, 9 teams, 6 locations, 3 legal entities")
  end
end
