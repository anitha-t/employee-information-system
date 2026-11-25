# Demo organisation: grades, teams, offices, legal entities (with registered
# addresses), salary bands, jobs and positions for India, the US and Australia.
#
#   bin/rails db:seed                  # runs this in development
#   bin/rails db:seed:reference_data   # just this, in any non-production env
#
# Idempotent: records are found by their natural key (code, name, city) and
# only created or filled in when missing, so it is safe to re-run on a
# database that already has employees. Existing values are never overwritten.
#
# Seeds::Employees builds on the records returned by #call.
module Seeds
  class ReferenceData
    START = Date.new(2016, 1, 1)

    # One legal entity per country. `offices` are extra locations used by
    # open positions; the entity itself sits at the first (head) office.
    ENTITIES = [
      { code: "IN", name: "Acme India Pvt Ltd", city: "Bengaluru", state: "KA", postal_code: "560001",
        line1: "100 MG Road", offices: [ { city: "Hyderabad", state: "TG" } ] },
      { code: "US", name: "Acme Inc", city: "San Francisco", state: "CA", postal_code: "94105",
        line1: "1 Market Street", offices: [ { city: "New York", state: "NY" } ] },
      { code: "AU", name: "Acme Australia Pty Ltd", city: "Sydney", state: "NSW", postal_code: "2000",
        line1: "200 George Street", offices: [ { city: "Melbourne", state: "VIC" } ] }
    ].freeze

    # Grade 1 band (whole currency units); each grade above is 40% higher.
    G1_BAND = { "IN" => [ 600_000, 1_000_000 ], "US" => [ 60_000, 85_000 ], "AU" => [ 65_000, 90_000 ] }.freeze
    GRADE_STEP = 1.4
    GRADE_COUNT = 8

    ENGINEERING_TEAMS = %w[Platform Payments Mobile Data].freeze
    TEAMS = { "Engineering" => ENGINEERING_TEAMS, "Sales" => [], "People" => [], "Finance" => [], "Operations" => [] }.freeze

    JobSpec = Data.define(:code, :title, :level, :min_grade, :max_grade, :teams, :weight, :manager, :description)
    JOBS = [
      JobSpec.new("SWE", "Software Engineer", "IC2", 1, 3, ENGINEERING_TEAMS, 30, false,
                  "Designs, builds and maintains product features."),
      JobSpec.new("SSWE", "Senior Software Engineer", "IC3", 3, 5, ENGINEERING_TEAMS, 18, false,
                  "Leads features end to end and mentors other engineers."),
      JobSpec.new("STAFF", "Staff Engineer", "IC4", 5, 7, ENGINEERING_TEAMS, 4, false,
                  "Sets technical direction across teams."),
      JobSpec.new("EM", "Engineering Manager", "M1", 5, 7, ENGINEERING_TEAMS, 4, true,
                  "Manages an engineering team's people and delivery."),
      JobSpec.new("DS", "Data Scientist", "IC3", 2, 5, %w[Data], 5, false,
                  "Builds models and analyses that inform product decisions."),
      JobSpec.new("SALES", "Sales Executive", "IC2", 1, 4, %w[Sales], 12, false,
                  "Finds and closes new business."),
      JobSpec.new("AM", "Account Manager", "IC3", 3, 5, %w[Sales], 6, false,
                  "Grows and retains existing customer accounts."),
      JobSpec.new("HRG", "HR Generalist", "IC2", 2, 4, %w[People], 5, false,
                  "Supports hiring, onboarding and employee relations."),
      JobSpec.new("FIN", "Financial Analyst", "IC2", 2, 5, %w[Finance], 5, false,
                  "Plans budgets and reports on financial performance."),
      JobSpec.new("OPS", "Operations Associate", "IC1", 1, 3, %w[Operations], 9, false,
                  "Runs day-to-day business operations."),
      JobSpec.new("DIR", "Director", "M3", 7, 8, %w[Engineering Sales], 2, true,
                  "Leads a department and its managers.")
    ].freeze

    # Unfilled seats at the second office (or remote), so vacancies show up.
    # [country, job code, team, head count, remote?]
    OPEN_POSITIONS = [
      [ "IN", "SWE", "Platform", 3, false ], [ "IN", "DS", "Data", 2, false ], [ "IN", "HRG", "People", 1, false ],
      [ "US", "SSWE", "Payments", 2, false ], [ "US", "STAFF", "Data", 1, true ],
      [ "AU", "SALES", "Sales", 2, false ], [ "AU", "SWE", "Mobile", 1, true ]
    ].freeze

    Org = Data.define(:grades, :teams, :entities, :jobs, :positions)

    def self.band_for(country_code, rank)
      min, max = G1_BAND.fetch(country_code)
      factor = GRADE_STEP**(rank - 1)
      [ (min * factor).round(-3), (max * factor).round(-3) ]
    end

    def initialize(logger: $stdout)
      @logger = logger
    end

    # Returns the org as an Org:
    #   grades    [Grade] by rank
    #   teams     { name => Team }
    #   entities  [{ code:, country:, location:, entity:, ... }]
    #   jobs      [[JobSpec, Job]]
    #   positions { [country code, job code, team name] => Position } (head-office seats only)
    def call
      org = ActiveRecord::Base.transaction do
        grades = build_grades
        teams = build_teams
        entities = ENTITIES.map { |config| build_entity(config, grades) }
        jobs = JOBS.map { |spec| [ spec, build_job(spec, grades) ] }
        positions = build_positions(entities, jobs, teams)
        build_open_positions(entities, jobs, teams)
        Org.new(grades:, teams:, entities:, jobs:, positions:)
      end
      @logger&.puts "Reference data: #{summary}"
      org
    end

    private

    def build_grades
      (1..GRADE_COUNT).map do |rank|
        Grade.find_or_create_by!(code: "G#{rank}") { |grade| grade.name = "Grade #{rank}"; grade.rank = rank }
      end
    end

    def build_teams
      TEAMS.each_with_object({}) do |(name, children), teams|
        parent = Team.find_or_create_by!(name: name, parent_id: nil)
        teams[name] = parent
        children.each { |child| teams[child] = Team.find_or_create_by!(name: child, parent: parent) }
      end
    end

    def build_entity(config, grades)
      country = Country.find_by!(iso_code: config[:code])
      location = find_location(country, config)
      offices = config[:offices].map { |office| find_location(country, office) }
      entity = LegalEntity.find_or_create_by!(name: config[:name]) do |e|
        e.location = location
        e.effective_from = START
      end
      unless entity.addresses.exists?(address_type: "registered")
        entity.addresses.create!(address_type: "registered", line1: config[:line1], city: config[:city],
                                 state: config[:state], postal_code: config[:postal_code], country: country)
      end
      grades.each { |grade| build_band(country, grade) }
      config.merge(country: country, location: location, offices: offices, entity: entity)
    end

    def find_location(country, attrs)
      Location.find_or_create_by!(country: country, city: attrs[:city]) { |l| l.state = attrs[:state] }
    end

    def build_band(country, grade)
      min, max = self.class.band_for(country.iso_code, grade.rank)
      SalaryBand.find_or_create_by!(grade: grade, country: country) do |band|
        band.assign_attributes(currency: country.currency, min_cents: min * 100, max_cents: max * 100, effective_from: START)
      end
    end

    def build_job(spec, grades)
      record = Job.find_or_create_by!(code: spec.code) do |job|
        job.assign_attributes(title: spec.title, level: spec.level,
                              min_grade: grades[spec.min_grade - 1], max_grade: grades[spec.max_grade - 1])
      end
      record.update!(description: spec.description) if record.description.blank?
      Country.where(iso_code: ENTITIES.pluck(:code)).find_each { |country| JobCountry.find_or_create_by!(job: record, country: country) }
      record
    end

    # One position per entity × job × team at the head office.
    def build_positions(entities, jobs, teams)
      entities.product(jobs).each_with_object({}) do |(entity, (spec, job)), positions|
        spec.teams.each do |team_name|
          code = "#{entity[:code]}-#{spec.code}-#{team_name.upcase}"
          positions[[ entity[:code], spec.code, team_name ]] = Position.find_or_create_by!(code: code) do |p|
            p.assign_attributes(name: "#{spec.title}, #{team_name} (#{entity[:code]})", job: job, team: teams.fetch(team_name),
                                legal_entity: entity[:entity], location: entity[:location],
                                effective_from: START, required_head_count: 0)
          end
        end
      end
    end

    def build_open_positions(entities, jobs, teams)
      OPEN_POSITIONS.each do |country_code, job_code, team_name, head_count, remote|
        entity = entities.find { |e| e[:code] == country_code }
        spec, job = jobs.find { |s, _| s.code == job_code }
        office = entity[:offices].first
        place = remote ? "Remote" : office.city
        Position.find_or_create_by!(code: "#{country_code}-#{job_code}-#{team_name.upcase}-#{remote ? 'REMOTE' : office.city.upcase.delete(' ')}") do |p|
          p.assign_attributes(name: "#{spec.title}, #{team_name} (#{place})", job: job, team: teams.fetch(team_name),
                              legal_entity: entity[:entity], location: (remote ? nil : office), is_remote: remote,
                              effective_from: START, required_head_count: head_count)
        end
      end
    end

    def summary
      [ Grade, Team, Location, LegalEntity, SalaryBand, Job, Position ]
        .map { |model| "#{model.count} #{model.model_name.plural.tr('_', ' ')}" }.join(", ")
    end
  end
end
