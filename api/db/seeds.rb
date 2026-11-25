# Idempotent reference data. Run with: bin/rails db:seed
[
  { iso_code: "IN", name: "India", currency: "INR" },
  { iso_code: "US", name: "United States", currency: "USD" },
  { iso_code: "AU", name: "Australia", currency: "AUD" }
].each do |attrs|
  Country.find_or_initialize_by(iso_code: attrs[:iso_code]).update!(attrs)
end

# Development-only bootstrap HR login (never runs in other environments).
if Rails.env.development?
  hr_person = Person.find_or_create_by!(email: "hr.admin@example.com") do |person|
    person.first_name = "HR"
    person.last_name = "Admin"
  end
  User.find_or_create_by!(email_address: "hr@salary-management.local") do |user|
    user.person = hr_person
    user.role = "hr"
    user.password = ENV.fetch("DEV_HR_PASSWORD", "dev-password-123")
  end
  puts "Dev HR login: hr@salary-management.local / #{ENV.fetch('DEV_HR_PASSWORD', 'dev-password-123')}"
end

# Development-only demo data: 10,000 employees with history (bulk insert,
# takes seconds). Skipped when employees already exist. SEED_EMPLOYEES=0 skips it.
if Rails.env.development? && ENV.fetch("SEED_EMPLOYEES", "10000").to_i.positive?
  require Rails.root.join("db/seeds/employees").to_s
  Seeds::Employees.new(count: ENV.fetch("SEED_EMPLOYEES", "10000").to_i).call

  employee = Employment.active.where("hire_date <= ?", Date.current).order(:employee_number).first
  if employee && !User.exists?(email_address: "employee@salary-management.local")
    User.create!(person: employee.person, role: "employee", email_address: "employee@salary-management.local",
                 password: ENV.fetch("DEV_HR_PASSWORD", "dev-password-123"))
  end
  puts "Dev employee login: employee@salary-management.local / #{ENV.fetch('DEV_HR_PASSWORD', 'dev-password-123')}" if employee
end
