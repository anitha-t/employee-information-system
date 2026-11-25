# Bulk demo data: an org (legal entities, teams, grades, salary bands, jobs,
# positions) and N employees with realistic history: hires, yearly salary
# changes, promotions, separations and managers.
#
#   bin/rails db:seed                          # runs this in development (10,000 employees)
#   bin/rails db:seed:employees COUNT=20000     # explicit, any size
#   bin/rails db:seed:replant                  # wipe all data and reseed
#
# Performance: every row is built in memory and streamed into Postgres with
# COPY inside one transaction (no per-record validations, callbacks or audit
# versions, and no ActiveRecord type casting), so 10,000 employees with
# ~150,000 history rows take a few seconds. Because validations are
# skipped, the generator itself keeps the data valid: positions belong to the
# employee's legal entity, grades stay within the job's range, currencies
# match the country, and effective-dated rows never overlap (the database
# exclusion constraints still check this on insert).
#
# Output is reproducible: the same COUNT and SEED give the same data.
module Seeds
  class Employees
    TABLES = %i[people addresses emergency_contacts employments employment_actions assignments compensations].freeze
    NAMES_DIR = File.expand_path(__dir__)
    HISTORY_START = Date.new(2016, 1, 4)

    ENTITIES = [
      { code: "IN", name: "Acme India Pvt Ltd", city: "Bengaluru", state: "KA", postal_code: "560001",
        share: 0.60, increment_month: 4, phone: ->(rng) { "+91#{rng.rand(7_000_000_000..9_999_999_999)}" } },
      { code: "US", name: "Acme Inc", city: "San Francisco", state: "CA", postal_code: "94105",
        share: 0.25, increment_month: 1, phone: ->(rng) { "+1415#{rng.rand(1_000_000..9_999_999)}" } },
      { code: "AU", name: "Acme Australia Pty Ltd", city: "Sydney", state: "NSW", postal_code: "2000",
        share: 0.15, increment_month: 7, phone: ->(rng) { "+614#{rng.rand(10_000_000..99_999_999)}" } }
    ].freeze

    # Grade 1 band (whole currency units); each grade above is 40% higher.
    G1_BAND = { "IN" => [ 600_000, 1_000_000 ], "US" => [ 60_000, 85_000 ], "AU" => [ 65_000, 90_000 ] }.freeze
    GRADE_STEP = 1.4
    GRADE_COUNT = 8
    ROUND_TO = { "IN" => 1_000, "US" => 100, "AU" => 100 }.freeze

    ENGINEERING_TEAMS = %w[Platform Payments Mobile Data].freeze
    TEAMS = { "Engineering" => ENGINEERING_TEAMS, "Sales" => [], "People" => [], "Finance" => [], "Operations" => [] }.freeze

    JobSpec = Data.define(:code, :title, :level, :min_grade, :max_grade, :teams, :weight, :manager)
    JOBS = [
      JobSpec.new("SWE", "Software Engineer", "IC2", 1, 3, ENGINEERING_TEAMS, 30, false),
      JobSpec.new("SSWE", "Senior Software Engineer", "IC3", 3, 5, ENGINEERING_TEAMS, 18, false),
      JobSpec.new("STAFF", "Staff Engineer", "IC4", 5, 7, ENGINEERING_TEAMS, 4, false),
      JobSpec.new("EM", "Engineering Manager", "M1", 5, 7, ENGINEERING_TEAMS, 4, true),
      JobSpec.new("DS", "Data Scientist", "IC3", 2, 5, %w[Data], 5, false),
      JobSpec.new("SALES", "Sales Executive", "IC2", 1, 4, %w[Sales], 12, false),
      JobSpec.new("AM", "Account Manager", "IC3", 3, 5, %w[Sales], 6, false),
      JobSpec.new("HRG", "HR Generalist", "IC2", 2, 4, %w[People], 5, false),
      JobSpec.new("FIN", "Financial Analyst", "IC2", 2, 5, %w[Finance], 5, false),
      JobSpec.new("OPS", "Operations Associate", "IC1", 1, 3, %w[Operations], 9, false),
      JobSpec.new("DIR", "Director", "M3", 7, 8, %w[Engineering Sales], 2, true)
    ].freeze

    RELATIONSHIPS = %w[spouse parent sibling partner friend].freeze
    STREETS = [ "MG Road", "Main Street", "George Street", "Park Avenue", "Church Street", "High Street", "Lake View Road" ].freeze

    def initialize(count:, seed: 42, created_by: nil, today: Date.current, logger: $stdout)
      @count = count
      @rng = Random.new(seed)
      @created_by = created_by
      @today = today
      @logger = logger
      @rows = Hash.new { |hash, table| hash[table] = [] }
      @reporting_lines = Hash.new { |hash, code| hash[code] = { directors: [], managers: [], staff: [] } }
    end

    def call
      if Employment.exists?
        log "Employees already exist; skipping. Use bin/rails db:seed:replant to start over."
        return
      end

      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      ActiveRecord::Base.transaction do
        # Sequences ignore rollbacks; with no employments yet, start numbering at E000001.
        ActiveRecord::Base.connection.execute("SELECT setval('employee_number_seq', 1, false)")
        build_org
        @count.times { |index| build_employee(index) }
        assign_managers
        insert_rows
        update_head_counts
      end
      ActiveRecord::Base.connection.execute("ANALYZE")
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started
      log format("Seeded %<n>d employees (%<rows>s) in %<s>.1fs", n: @count, s: elapsed,
                                                                 rows: @rows.map { |table, rows| "#{rows.size} #{table}" }.join(", "))
    end

    private

    def log(message) = @logger&.puts(message)

    # --- reference data (idempotent, few rows: normal ActiveRecord) ---------

    def build_org
      @hr_user = @created_by || User.find_by(role: "hr") || raise("Create an HR user first (bin/rails db:seed in development)")
      @grades = (1..GRADE_COUNT).map do |rank|
        Grade.find_or_create_by!(code: "G#{rank}") { |grade| grade.name = "Grade #{rank}"; grade.rank = rank }
      end
      @teams = build_teams
      @entities = ENTITIES.map { |config| build_entity(config) }
      @jobs = JOBS.map { |job| [ job, build_job(job) ] }
      @positions = build_positions
      @first_names = read_names("first_names.txt")
      @last_names = read_names("last_names.txt")
      @full_names = @first_names.product(@last_names).shuffle(random: @rng)
    end

    def build_teams
      TEAMS.each_with_object({}) do |(name, children), teams|
        parent = Team.find_or_create_by!(name: name, parent_id: nil)
        teams[name] = parent
        children.each { |child| teams[child] = Team.find_or_create_by!(name: child, parent: parent) }
      end
    end

    def build_entity(config)
      country = Country.find_by!(iso_code: config[:code])
      location = Location.find_or_create_by!(country: country, city: config[:city]) { |l| l.state = config[:state] }
      entity = LegalEntity.find_or_create_by!(name: config[:name]) do |e|
        e.location = location
        e.effective_from = HISTORY_START.beginning_of_year
      end
      @grades.each do |grade|
        min, max = band_for(config[:code], grade.rank)
        SalaryBand.find_or_create_by!(grade: grade, country: country) do |band|
          band.assign_attributes(currency: country.currency, min_cents: min * 100, max_cents: max * 100,
                                 effective_from: HISTORY_START.beginning_of_year)
        end
      end
      config.merge(country: country, location: location, entity: entity)
    end

    def build_job(job)
      record = Job.find_or_create_by!(code: job.code) do |j|
        j.title = job.title
        j.level = job.level
        j.min_grade = @grades[job.min_grade - 1]
        j.max_grade = @grades[job.max_grade - 1]
      end
      Country.where(iso_code: ENTITIES.pluck(:code)).find_each { |country| JobCountry.find_or_create_by!(job: record, country: country) }
      record
    end

    def build_positions
      @entities.product(@jobs).each_with_object({}) do |(entity, (job, record)), positions|
        job.teams.each do |team_name|
          code = "#{entity[:code]}-#{job.code}-#{team_name.upcase}"
          positions[[ entity[:code], job.code, team_name ]] = Position.find_or_create_by!(code: code) do |p|
            p.assign_attributes(name: "#{job.title}, #{team_name} (#{entity[:code]})", job: record, team: @teams.fetch(team_name),
                                legal_entity: entity[:entity], location: entity[:location],
                                effective_from: HISTORY_START.beginning_of_year, required_head_count: 0)
          end
        end
      end
    end

    def read_names(file)
      File.readlines(File.join(NAMES_DIR, file), chomp: true).map(&:strip).reject(&:empty?).uniq
    end

    def band_for(country_code, rank)
      min, max = G1_BAND.fetch(country_code)
      factor = GRADE_STEP**(rank - 1)
      [ (min * factor).round(-3), (max * factor).round(-3) ]
    end

    # --- employees (bulk) ---------------------------------------------------

    def build_employee(index)
      entity = pick_entity
      job, job_record = pick_job
      team = job.teams.sample(random: @rng)
      position = @positions.fetch([ entity[:code], job.code, team ])
      first_name, last_name = @full_names[index % @full_names.size]
      hire_date = pick_hire_date(index)
      last_working_date = pick_last_working_date(job, hire_date)

      person_id = add_person(index, entity, first_name, last_name)
      employment_id = add_employment(index, entity, person_id, first_name, last_name, hire_date, last_working_date)
      role = job.code == "DIR" ? :directors : (job.manager ? :managers : :staff)
      @reporting_lines[entity[:code]][role] << employment_id

      build_history(entity, job, job_record, position, employment_id, hire_date, last_working_date)
    end

    # 60% India, 25% US, 15% Australia.
    def pick_entity
      roll = @rng.rand
      cumulative = 0.0
      @entities.find { |entity| (cumulative += entity[:share]) > roll } || @entities.last
    end

    def pick_job
      @job_weights ||= @jobs.flat_map { |job, record| [ [ job, record ] ] * job.weight }
      @job_weights.sample(random: @rng)
    end

    # ~0.5% are future joiners; everyone else joined between 2016 and two weeks ago.
    def pick_hire_date(index)
      return @today + @rng.rand(7..40) if index % 200 == 199

      HISTORY_START + @rng.rand(0..(@today - 14 - HISTORY_START).to_i)
    end

    # ~6% have left, ~1% are on notice. Managers stay so reporting lines hold.
    def pick_last_working_date(job, hire_date)
      return if job.manager || hire_date > @today

      roll = @rng.rand
      earliest = hire_date + 120
      if roll < 0.06 && earliest < @today
        earliest + @rng.rand(0..(@today - 1 - earliest).to_i)
      elsif roll < 0.07
        @today + @rng.rand(10..60)
      end
    end

    def add_person(index, entity, first_name, last_name)
      id = SecureRandom.uuid
      @rows[:people] << {
        id: id, first_name: first_name, last_name: last_name, preferred_name: nil,
        email: "#{slug(first_name)}.#{slug(last_name)}.#{index}@example.com",
        phone_number: entity[:phone].call(@rng), dob: Date.new(@rng.rand(1965..2003), @rng.rand(1..12), @rng.rand(1..28)),
        gender: Person::GENDERS.sample(random: @rng)
      }
      @rows[:addresses] << {
        id: SecureRandom.uuid, addressable_type: "Person", addressable_id: id, address_type: "home",
        line1: "#{@rng.rand(1..999)} #{STREETS.sample(random: @rng)}", line2: nil, city: entity[:city],
        state: entity[:state], postal_code: entity[:postal_code], country_id: entity[:country].id
      }
      @rows[:emergency_contacts] << {
        id: SecureRandom.uuid, person_id: id, is_primary: true,
        name: "#{@first_names.sample(random: @rng)} #{last_name}", relationship: RELATIONSHIPS.sample(random: @rng),
        phone_number: entity[:phone].call(@rng)
      }
      id
    end

    def add_employment(index, entity, person_id, first_name, last_name, hire_date, last_working_date)
      id = SecureRandom.uuid
      status = if last_working_date.nil? then "active"
      elsif last_working_date < @today then "separated"
      else "on_notice"
      end
      separated = !last_working_date.nil?
      @rows[:employments] << {
        id: id, person_id: person_id, legal_entity_id: entity[:entity].id,
        employment_type: @rng.rand < 0.92 ? "full_time" : %w[part_time contractor intern].sample(random: @rng),
        status: status, hire_date: hire_date, notice_period_days: entity[:code] == "IN" ? 60 : 30,
        work_email: "#{slug(first_name)}.#{slug(last_name)}.#{index}@acme.example",
        resignation_date: (last_working_date - 30 if separated), last_working_date: last_working_date,
        separation_type: (%w[voluntary voluntary voluntary involuntary].sample(random: @rng) if separated),
        separation_reason: ("Seeded separation" if separated), eligible_for_rehire: (separated ? @rng.rand < 0.8 : nil)
      }
      id
    end

    # Hire, then one event per year on the country's increment date:
    # ~12% promotion (next grade, +12–20%), ~75% salary change (+3–10%).
    def build_history(entity, job, job_record, position, employment_id, hire_date, last_working_date)
      code = entity[:code]
      grade = job.min_grade + (job.max_grade > job.min_grade && @rng.rand < 0.3 ? 1 : 0)
      min, max = band_for(code, grade)
      salary = round_salary(code, min + (@rng.rand * (max - min) * 0.6))
      end_date = last_working_date && last_working_date + 1

      action_id = add_action(employment_id, "hire", hire_date, "Seeded hire")
      assignment = add_row(:assignments, employment_id: employment_id, employment_action_id: action_id, position_id: position.id,
                                         grade_id: @grades[grade - 1].id, reports_to_employment_id: nil, is_primary: true,
                                         effective_from: hire_date, effective_to: nil)
      compensation = add_row(:compensations, employment_id: employment_id, employment_action_id: action_id,
                                             annual_salary_cents: salary * 100, currency: entity[:country].currency,
                                             pay_frequency: "monthly", effective_from: hire_date, effective_to: nil)

      ((hire_date.year + 1)..@today.year).each do |year|
        date = Date.new(year, entity[:increment_month], 1)
        break if date > @today || (end_date && date >= end_date)

        if grade < job.max_grade && @rng.rand < 0.12
          grade += 1
          salary = round_salary(code, salary * (1.12 + (@rng.rand * 0.08)))
          action_id = add_action(employment_id, "promotion", date, "Seeded promotion")
          assignment = supersede(:assignments, assignment, date, action_id, grade_id: @grades[grade - 1].id)
          compensation = supersede(:compensations, compensation, date, action_id, annual_salary_cents: salary * 100)
        elsif @rng.rand < 0.85
          salary = round_salary(code, salary * (1.03 + (@rng.rand * 0.07)))
          action_id = add_action(employment_id, "salary_change", date, "Seeded annual increment")
          compensation = supersede(:compensations, compensation, date, action_id, annual_salary_cents: salary * 100)
        end
      end

      return unless last_working_date

      add_action(employment_id, "separation", last_working_date, "Seeded separation")
      assignment[:effective_to] = end_date
      compensation[:effective_to] = end_date
    end

    def add_action(employment_id, action_type, date, reason)
      id = SecureRandom.uuid
      @rows[:employment_actions] << {
        id: id, employment_id: employment_id, action_type: action_type, effective_date: date, reason: reason,
        created_by_user_id: @hr_user.id, reviewed_by_user_id: nil, review_decision: nil, reviewed_at: nil
      }
      id
    end

    def add_row(table, attributes)
      row = attributes.merge(id: SecureRandom.uuid)
      @rows[table] << row
      row
    end

    def supersede(table, current, date, action_id, changes)
      current[:effective_to] = date
      add_row(table, current.except(:id).merge(changes, employment_action_id: action_id, effective_from: date, effective_to: nil))
    end

    # Staff report to a manager in the same entity, managers to a director;
    # directors have no manager. Managers and directors never leave, so every
    # reporting line points at a current employee.
    def assign_managers
      rows_by_employment = @rows[:assignments].group_by { |row| row[:employment_id] }
      @reporting_lines.each_value do |lines|
        managers = lines[:managers].presence || lines[:directors]
        set_manager(rows_by_employment, lines[:managers], lines[:directors])
        set_manager(rows_by_employment, lines[:staff], managers)
      end
    end

    def set_manager(rows_by_employment, employment_ids, candidates)
      return if candidates.empty?

      employment_ids.each do |employment_id|
        manager = candidates.sample(random: @rng)
        rows_by_employment.fetch(employment_id).each { |row| row[:reports_to_employment_id] = manager }
      end
    end

    # COPY each table in foreign-key order. employee_number is omitted so the
    # employee_number_seq default numbers employments in insertion order.
    def insert_rows
      now = Time.current.utc.iso8601(6)
      connection = ActiveRecord::Base.connection.raw_connection
      encoder = PG::TextEncoder::CopyRow.new
      TABLES.each do |table|
        rows = @rows[table]
        next if rows.empty?

        columns = rows.first.keys
        sql = "COPY #{table} (#{(columns + %i[created_at updated_at]).join(', ')}) FROM STDIN"
        connection.copy_data(sql, encoder) do
          rows.each { |row| connection.put_copy_data(row.values_at(*columns).map { |value| copy_value(value) } << now << now) }
        end
      end
    end

    def copy_value(value)
      case value
      when nil then nil
      when true then "t"
      when false then "f"
      when Date then value.iso8601
      else value.to_s
      end
    end

    def update_head_counts
      ActiveRecord::Base.connection.execute(<<~SQL.squish)
        UPDATE positions SET required_head_count = filled.count
        FROM (SELECT position_id, COUNT(*) AS count FROM assignments
              WHERE is_primary AND effective_to IS NULL GROUP BY position_id) filled
        WHERE positions.id = filled.position_id
      SQL
    end

    def round_salary(code, amount)
      step = ROUND_TO.fetch(code)
      ((amount / step).round * step).to_i
    end

    def slug(name) = name.downcase.gsub(/[^a-z0-9]/, "")
  end
end
