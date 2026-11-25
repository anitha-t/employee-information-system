COUNTRY_DATA = {
  "IN" => { name: "India", currency: "INR" },
  "US" => { name: "United States", currency: "USD" },
  "AU" => { name: "Australia", currency: "AUD" }
}.freeze

FactoryBot.define do
  factory :country do
    iso_code { "IN" }
    name { COUNTRY_DATA.fetch(iso_code)[:name] }
    currency { COUNTRY_DATA.fetch(iso_code)[:currency] }

    # Countries are unique reference rows; reuse instead of duplicating.
    initialize_with { Country.find_or_initialize_by(iso_code: iso_code) }

    trait(:india) { iso_code { "IN" } }
    trait(:us) { iso_code { "US" } }
    trait(:australia) { iso_code { "AU" } }
  end

  factory :location do
    country
    city { Faker::Address.city }
    state { Faker::Address.state_abbr }
  end

  factory :legal_entity do
    transient { country_code { "IN" } }

    sequence(:name) { |n| "Acme #{country_code} #{n}" }
    location { association :location, country: association(:country, iso_code: country_code) }
    effective_from { Date.new(2020, 1, 1) }
  end

  factory :team do
    sequence(:name) { |n| "Team #{n}" }
  end

  factory :grade do
    sequence(:rank) { |n| n }
    code { "G#{rank}" }
    name { "Grade #{rank}" }
  end

  factory :salary_band do
    grade
    country
    currency { country.currency }
    min_cents { 1_000_000_00 }
    max_cents { 2_000_000_00 }
    effective_from { Date.new(2026, 1, 1) }
  end

  factory :job do
    sequence(:code) { |n| "JOB#{n}" }
    title { "Software Engineer" }
    level { "L3" }
    min_grade factory: :grade
    max_grade { association :grade, rank: min_grade.rank + 1000 }
  end

  factory :position do
    sequence(:code) { |n| "POS#{n}" }
    name { "#{job.title} – #{team.name}" }
    job
    team
    legal_entity
    location { legal_entity.location }
    effective_from { Date.new(2020, 1, 1) }

    trait :remote do
      is_remote { true }
      location { nil }
    end
  end
end
