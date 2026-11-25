namespace :db do
  namespace :seed do
    desc "Seed the demo org (grades, teams, entities, bands, jobs, positions). Idempotent. Refuses in production unless FORCE=1."
    task reference_data: :environment do
      abort "Refusing to seed demo reference data in production (set FORCE=1 to override)." if Rails.env.production? && ENV["FORCE"] != "1"

      require Rails.root.join("db/seeds/reference_data").to_s
      Seeds::ReferenceData.new.call
    end

    desc "Bulk-seed demo employees: COUNT=10000 SEED=42. Refuses in production unless FORCE=1."
    task employees: :environment do
      abort "Refusing to seed demo employees in production (set FORCE=1 to override)." if Rails.env.production? && ENV["FORCE"] != "1"

      require Rails.root.join("db/seeds/employees").to_s
      Seeds::Employees.new(count: ENV.fetch("COUNT", 10_000).to_i, seed: ENV.fetch("SEED", 42).to_i).call
    end
  end
end
