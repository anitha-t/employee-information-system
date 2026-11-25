module EmploymentActions
  # Creates an employment action and applies it immediately
  # (docs/domain-model.md "Which action creates which rows").
  #
  # - hire: creates (or reuses) the Person, a new Employment, and the first
  #   Assignment and Compensation rows.
  # - other changes: close the current row at effective_date and open a new
  #   one, copying unchanged fields. Changes must be made in date order.
  # - separation: closes all open rows at last_working_date + 1.
  class Create
    include RecordErrors

    Result = Data.define(:action, :warnings)
    ASSIGNMENT_COPY = %w[position_id grade_id reports_to_employment_id is_primary].freeze

    def initialize(params:, user:)
      @payload = Payload.new(params)
      @user = user
    end

    def call
      @payload.validate!
      action = ActiveRecord::Base.transaction { @payload.hire? ? hire! : change! }
      sign_out_if_separated(action.employment)
      Result.new(action: action, warnings: SalaryBandCheck.warnings_for(action.compensation))
    end

    private

    def date = @payload.effective_date

    # --- hire ---------------------------------------------------------------

    def hire!
      person = find_or_create_person
      if person.employments.where.not(status: "separated").exists?
        raise ValidationError.for("person", "already has an active employment")
      end

      employment = with_section_errors do
        Employment.create!(@payload.section(:employment).merge(person: person, hire_date: date, status: "active"))
      end
      action = create_action!(employment)
      with_section_errors do
        Assignment.create!(@payload.section(:assignment).merge(
          employment: employment, employment_action: action, effective_from: date, is_primary: true
        ))
        Compensation.create!(compensation_attributes(employment).merge(
          employment: employment, employment_action: action, effective_from: date
        ))
      end
      action
    end

    def find_or_create_person
      return Person.find(@payload.data[:person_id]) if @payload.data[:person_id].present?

      with_section_errors { Person.create!(@payload.section(:person)) }
    end

    # --- changes to an existing employment ----------------------------------

    def change!
      employment = Employment.lock.find(@payload.data[:employment_id])
      unless employment.active?
        raise ValidationError.for("employment_id", "is #{employment.status.humanize(capitalize: false)}; no further changes can be made")
      end

      action = create_action!(employment)
      supersede!(employment.assignments.primary, action, @payload.section(:assignment), "assignment") if @payload.section(:assignment)
      if @payload.compensation
        supersede!(employment.compensations, action, compensation_attributes(employment), "compensation")
      end
      separate!(employment, action) if @payload.section(:separation)
      action
    end

    # Closes the row active on `date` and opens a new one with `changes`.
    def supersede!(rows, action, changes, section)
      latest = rows.order(effective_from: :desc).first
      current = rows.active_on(date).first
      raise ValidationError.for(section, "has no row active on #{date}") unless current
      if latest.effective_from >= date
        raise ValidationError.for("effective_date", "must be after the latest #{section} change (#{latest.effective_from})")
      end

      with_section_errors(section) do
        end_date = current.effective_to
        current.update!(effective_to: date)
        rows.create!(current.attributes.slice(*copy_keys(rows)).merge(changes).merge(
          employment_action: action, effective_from: date, effective_to: end_date
        ))
      end
    end

    def copy_keys(rows)
      rows.klass == Assignment ? ASSIGNMENT_COPY : %w[pay_frequency]
    end

    def separate!(employment, action)
      separation = @payload.section(:separation)
      end_date = date + 1
      if [ employment.assignments, employment.compensations ].any? { |rows| rows.where(effective_from: end_date..).exists? }
        raise ValidationError.for("separation.last_working_date", "is before a later change; correct that change first")
      end

      with_section_errors("separation") do
        employment.update!(separation.merge(status: date < Date.current ? "separated" : "on_notice"))
      end
      [ employment.assignments, employment.compensations ].each do |rows|
        rows.where(effective_to: nil).or(rows.where(effective_to: end_date..)).find_each { |row| row.update!(effective_to: end_date) }
      end
    end

    # --- shared -------------------------------------------------------------

    def create_action!(employment)
      with_section_errors do
        EmploymentAction.create!(@payload.action_attributes.merge(
          employment: employment, action_type: @payload.action_type, effective_date: date,
          created_by_user: @user, reviewed_at: (Time.current if @payload.data[:review_decision].present?)
        ))
      end
    end

    def compensation_attributes(employment)
      attrs = @payload.compensation.dup
      salary = attrs.delete(:annual_salary)
      if salary.currency.iso_code != employment.currency
        raise ValidationError.for("compensation.annual_salary.currency", "must be #{employment.currency} for #{employment.legal_entity.name}")
      end

      attrs.merge(annual_salary_cents: salary.cents, currency: salary.currency.iso_code)
    end

    def sign_out_if_separated(employment)
      employment.person.user&.sign_out_everywhere! if employment.separated?
    end
  end
end
