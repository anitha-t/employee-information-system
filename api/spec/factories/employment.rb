FactoryBot.define do
  factory :employment do
    person
    legal_entity
    employment_type { "full_time" }
    hire_date { Date.new(2026, 1, 5) }
    sequence(:work_email) { |n| "employee#{n}@acme.example" }
  end

  factory :employment_action do
    employment
    action_type { "hire" }
    effective_date { employment.hire_date }
    created_by_user factory: %i[user hr]
  end

  factory :assignment do
    employment
    employment_action { association :employment_action, employment: employment, effective_date: effective_from }
    position { association :position, legal_entity: employment.legal_entity }
    grade { position.job.min_grade }
    effective_from { employment.hire_date }
  end

  factory :compensation do
    employment
    employment_action { association :employment_action, employment: employment, effective_date: effective_from }
    annual_salary_cents { 1_850_000_00 }
    currency { employment.currency }
    effective_from { employment.hire_date }
  end
end
