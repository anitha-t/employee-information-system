FactoryBot.define do
  factory :person do
    first_name { Faker::Name.first_name }
    last_name { Faker::Name.last_name }
    sequence(:email) { |n| "person#{n}@example.com" }
    phone_number { "+919800000000" }
    dob { Date.new(1994, 2, 11) }
  end

  factory :emergency_contact do
    person
    name { Faker::Name.name }
    relationship { "spouse" }
    phone_number { "+919811111111" }
  end

  factory :address do
    addressable factory: :person
    address_type { "home" }
    line1 { "12 MG Road" }
    city { "Bengaluru" }
    postal_code { "560001" }
    country
  end

  factory :user do
    person
    sequence(:email_address) { |n| "user#{n}@acme.example" }
    password { "correct-horse-battery" }
    role { "employee" }

    trait(:hr) { role { "hr" } }
  end
end
