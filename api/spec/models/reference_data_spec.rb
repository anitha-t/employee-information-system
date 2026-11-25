require "rails_helper"

RSpec.describe "Reference data" do
  describe Country do
    it "rejects unknown currencies" do
      expect(described_class.new(iso_code: "XX", name: "X", currency: "ZZZ")).not_to be_valid
    end
  end

  describe LegalEntity do
    it "derives country and currency from its location" do
      entity = create(:legal_entity, country_code: "AU")
      expect([ entity.country.iso_code, entity.currency ]).to eq(%w[AU AUD])
    end
  end

  describe Team do
    it "prevents cycles in the hierarchy" do
      parent = create(:team)
      child = create(:team, parent: parent)
      parent.parent = child
      expect(parent).not_to be_valid
    end
  end

  describe Job do
    let(:low_grade) { create(:grade, rank: 1) }
    let(:mid_grade) { create(:grade, rank: 3) }
    let(:high_grade) { create(:grade, rank: 5) }

    it "requires max grade >= min grade and checks grades in range" do
      expect(build(:job, min_grade: mid_grade, max_grade: low_grade)).not_to be_valid
      job = create(:job, min_grade: low_grade, max_grade: mid_grade)
      expect(job.grade_allowed?(mid_grade)).to be(true)
      expect(job.grade_allowed?(high_grade)).to be(false)
    end
  end

  describe SalaryBand do
    it "requires the country currency and covers amounts in range" do
      us = create(:country, :us)
      expect(build(:salary_band, country: us, currency: "INR")).not_to be_valid
      band = create(:salary_band, country: us, min_cents: 100_000_00, max_cents: 150_000_00)
      expect(band.covers?(Money.new(120_000_00, "USD"))).to be(true)
      expect(band.covers?(Money.new(160_000_00, "USD"))).to be(false)
    end

    it "does not allow overlapping bands for the same grade and country" do
      band = create(:salary_band, effective_from: Date.new(2026, 1, 1))
      expect {
        create(:salary_band, grade: band.grade, country: band.country, effective_from: Date.new(2026, 6, 1))
      }.to raise_error(ActiveRecord::ExclusionViolation)
    end
  end

  describe JobCountry do
    it "lists a job in a country only once" do
      job_country = described_class.create!(job: create(:job), country: create(:country))
      expect(described_class.new(job: job_country.job, country: job_country.country)).not_to be_valid
    end
  end

  describe Position do
    it "requires a location unless remote" do
      expect(build(:position, location: nil)).not_to be_valid
      expect(build(:position, :remote)).to be_valid
    end

    it "counts filled head count from active primary assignments" do
      position = create(:position)
      employment = create(:employment, legal_entity: position.legal_entity)
      create(:assignment, employment: employment, position: position)
      expect(position.filled_head_count).to eq(1)
      expect(position.filled_head_count(on: employment.hire_date - 1)).to eq(0)
    end
  end
end
