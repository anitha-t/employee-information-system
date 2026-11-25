# The two development logins, as real employees with a full profile and
# employment history (development only):
#
#   hr@employee-information-system.local        Ananya Iyer, HR Generalist (HR)
#   employee@employee-information-system.local  Priya Sharma, Software Engineer (employee)
#
# Employment rows are created through EmploymentActions::Create and profiles
# through Profiles::Update, the same services the API uses, so the data obeys
# every domain rule and gets an audit trail.
#
# Idempotent: each step only runs when its records are missing. An existing
# database whose logins point at other people (older seeds) is re-linked.
#
#   ensure_users!        before the bulk employee seed (it needs an HR user)
#   ensure_employments!  after it (the bulk seed skips once employments exist)
module Seeds
  class DevAccounts
    PASSWORD = ENV.fetch("DEV_HR_PASSWORD", "dev-password-123")

    ACCOUNTS = [
      {
        email_address: "hr@employee-information-system.local", role: "hr",
        person: { first_name: "Ananya", last_name: "Iyer", preferred_name: nil, email: "ananya.iyer@example.com",
                  phone_number: "+919845012345", dob: Date.new(1987, 9, 14), gender: "female" },
        addresses: [
          { address_type: "home", line1: "42 Indiranagar 100 Feet Road", line2: "Flat 3B", city: "Bengaluru",
            state: "KA", postal_code: "560038" }
        ],
        emergency_contacts: [
          { name: "Karthik Iyer", relationship: "spouse", phone_number: "+919845067890", is_primary: true },
          { name: "Lakshmi Iyer", relationship: "parent", phone_number: "+914426541234", is_primary: false }
        ],
        position_code: "IN-HRG-PEOPLE", grade: "G3", hire_years_ago: 6, salary: 1_600_000,
        work_email: "ananya.iyer@acme.example",
        # [years after hire, action, changes]
        history: [ [ 2, "salary_change", { salary: 1_720_000 } ], [ 4, "salary_change", { salary: 1_850_000 } ] ]
      },
      {
        email_address: "employee@employee-information-system.local", role: "employee",
        person: { first_name: "Priya", last_name: "Sharma", preferred_name: "Priya", email: "priya.sharma@example.com",
                  phone_number: "+919900112233", dob: Date.new(1994, 2, 11), gender: "female" },
        addresses: [
          { address_type: "home", line1: "12 MG Road", line2: "Apartment 4C", city: "Bengaluru",
            state: "KA", postal_code: "560001" },
          { address_type: "mailing", line1: "PO Box 2210", line2: nil, city: "Bengaluru",
            state: "KA", postal_code: "560001" }
        ],
        emergency_contacts: [
          { name: "Ravi Sharma", relationship: "sibling", phone_number: "+919811111111", is_primary: true },
          { name: "Meena Sharma", relationship: "parent", phone_number: "+911123456789", is_primary: false }
        ],
        position_code: "IN-SWE-PLATFORM", grade: "G2", hire_years_ago: 3, salary: 1_200_000,
        work_email: "priya.sharma@acme.example", manager_position_code: "IN-EM-PLATFORM",
        history: [
          [ 1, "salary_change", { salary: 1_296_000 } ],
          [ 2, "promotion", { grade: "G3", salary: 1_500_000 } ]
        ]
      }
    ].freeze

    # People older seeds created for the logins. Removed once nothing uses them.
    LEGACY_PERSON_EMAILS = %w[hr.admin@example.com].freeze

    # The yearly review date for India (matches Seeds::Employees).
    REVIEW_MONTH = 4

    def initialize(today: Date.current, logger: $stdout)
      @today = today
      @logger = logger
    end

    # Creates each login and its person, or re-links a login to its person.
    def ensure_users!
      ACCOUNTS.each do |account|
        person = Person.find_or_create_by!(email: account[:person][:email]) { |p| p.assign_attributes(account[:person]) }
        user = User.find_or_initialize_by(email_address: account[:email_address])
        user.assign_attributes(person: person, role: account[:role])
        user.password = PASSWORD if user.new_record?
        user.save!
      end
      remove_legacy_people
    end

    # Hires each login's person with salary history, and fills in their profile.
    def ensure_employments!
      ensure_users!
      hr = User.find_by!(email_address: ACCOUNTS.first[:email_address])
      PaperTrail.request(whodunnit: hr.id) do
        ACCOUNTS.each do |account|
          person = Person.find_by!(email: account[:person][:email])
          fill_profile(person, account)
          hire_with_history(person, account, hr) unless person.employments.where.not(status: "separated").exists?
        end
      end
      ACCOUNTS.each { |account| log "Dev login: #{account[:email_address]} / #{PASSWORD} (#{account[:role]})" }
    end

    private

    def log(message) = @logger&.puts(message)

    def remove_legacy_people
      Person.where(email: LEGACY_PERSON_EMAILS).where.missing(:user, :employments).destroy_all
    end

    def fill_profile(person, account)
      india = Country.find_by!(iso_code: "IN")
      attributes = {}
      if person.addresses.none?
        attributes[:addresses_attributes] = account[:addresses].map { |address| address.merge(country_id: india.id) }
      end
      attributes[:emergency_contacts_attributes] = account[:emergency_contacts] if person.emergency_contacts.none?
      return if attributes.empty?

      Profiles::Update.new(person: person, attributes: attributes, lock_version: person.lock_version).call
    end

    def hire_with_history(person, account, hr)
      position = Position.find_by!(code: account[:position_code])
      hire_date = Date.new(@today.year - account[:hire_years_ago], REVIEW_MONTH, 3)
      employment = apply(hr, action_type: "hire", person_id: person.id, effective_date: hire_date, reason: "Dev login seed",
                             employment: { legal_entity_id: position.legal_entity_id, employment_type: "full_time",
                                           notice_period_days: 60, work_email: account[:work_email] },
                             assignment: { position_id: position.id, grade_id: grade(account[:grade]),
                                           reports_to_employment_id: manager_for(account, hire_date) },
                             compensation: salary(account[:salary], "monthly")).employment

      account[:history].each do |years, action_type, changes|
        date = Date.new(hire_date.year + years, REVIEW_MONTH, 1)
        next if date > @today

        payload = { action_type: action_type, employment_id: employment.id, effective_date: date,
                    reason: action_type == "promotion" ? "Annual promotion cycle" : "Annual increment",
                    compensation: salary(changes[:salary]) }
        payload[:assignment] = { grade_id: grade(changes[:grade]) } if changes[:grade]
        apply(hr, **payload)
      end
      log "Hired #{person.full_name} as #{employment.reload.employee_number}"
    end

    def apply(hr, **params)
      EmploymentActions::Create.new(params: params, user: hr).call.action
    end

    def salary(amount, pay_frequency = nil)
      { annual_salary: { amount: "#{amount}.00", currency: "INR" }, pay_frequency: pay_frequency }.compact
    end

    def grade(code) = Grade.find_by!(code: code).id

    # A current manager in that position who joined before the hire date, if the bulk seed made one.
    def manager_for(account, hire_date)
      return unless account[:manager_position_code]

      Assignment.primary.open_ended
                .joins(:position, :employment)
                .where(positions: { code: account[:manager_position_code] }, employments: { status: "active" })
                .where(employments: { hire_date: ..hire_date })
                .order("employments.hire_date").pick(:employment_id)
    end
  end
end
