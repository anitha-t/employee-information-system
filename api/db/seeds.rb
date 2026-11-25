# Idempotent reference data. Run with: bin/rails db:seed
[
  { iso_code: "IN", name: "India", currency: "INR" },
  { iso_code: "US", name: "United States", currency: "USD" },
  { iso_code: "AU", name: "Australia", currency: "AUD" }
].each do |attrs|
  Country.find_or_initialize_by(iso_code: attrs[:iso_code]).update!(attrs)
end

# Everything below is development-only.
return unless Rails.env.development?

require Rails.root.join("db/seeds/dev_accounts").to_s
require Rails.root.join("db/seeds/reference_data").to_s

# The HR and employee logins and their people. The bulk seed needs an HR user.
dev_accounts = Seeds::DevAccounts.new
dev_accounts.ensure_users!

# Demo org: grades, teams, offices, legal entities, salary bands, jobs and
# positions. Idempotent, so it also tops up an existing database.
Seeds::ReferenceData.new.call

# 10,000 demo employees with history (bulk insert, takes seconds). Skipped
# when employees already exist. SEED_EMPLOYEES=0 skips it.
if ENV.fetch("SEED_EMPLOYEES", "10000").to_i.positive?
  require Rails.root.join("db/seeds/employees").to_s
  Seeds::Employees.new(count: ENV.fetch("SEED_EMPLOYEES", "10000").to_i).call
end

# The logins as real employees: employment history, addresses, emergency contacts.
dev_accounts.ensure_employments!
