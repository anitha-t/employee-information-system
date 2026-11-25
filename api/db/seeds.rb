# Idempotent reference data. Run with: bin/rails db:seed
[
  { iso_code: "IN", name: "India", currency: "INR" },
  { iso_code: "US", name: "United States", currency: "USD" },
  { iso_code: "AU", name: "Australia", currency: "AUD" }
].each do |attrs|
  Country.find_or_initialize_by(iso_code: attrs[:iso_code]).update!(attrs)
end
