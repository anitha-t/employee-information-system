module EmploymentActions
  # PATCH /employment_actions/:id: corrects an action in place
  # (docs/api-design.md §3.3). Values in the rows it created are updated
  # directly; the audit trail keeps the old values.
  #
  # Moving effective_date is only allowed on the employment's latest action:
  # the row it created starts on the new date and the row before it ends there.
  class Update
    include RecordErrors

    Result = Data.define(:action, :warnings)
    ACTION_FIELDS = %w[reason reviewed_by_user_id review_decision].freeze
    SEPARATION_FIELDS = %w[resignation_date last_working_date separation_type separation_reason eligible_for_rehire].freeze

    def initialize(action:, params:, user:)
      @action = action
      @params = params.to_h.with_indifferent_access
      @user = user
    end

    def call
      ActiveRecord::Base.transaction do
        @action.employment.lock!
        check_sections!
        update_values!
        move_effective_date!(Date.iso8601(@params[:effective_date].to_s)) if @params.key?(:effective_date) && !separation?
        update_separation! if @params[:separation].is_a?(Hash)
        save_action!
      end
      Result.new(action: @action.reload, warnings: SalaryBandCheck.warnings_for(@action.compensation))
    rescue Date::Error
      raise ValidationError.for("effective_date", "must be an ISO-8601 date")
    end

    private

    def separation? = @action.separation?

    def check_sections!
      errors = {}
      allowed = Payload::RULES.fetch(@action.action_type)[:assignment_keys] || []
      if (assignment = @params[:assignment])
        errors["assignment"] = [ "this action has no assignment change" ] unless @action.assignment
        (assignment.keys - allowed).each { |key| errors["assignment.#{key}"] = [ "cannot be set by #{@action.action_type}" ] }
      end
      errors["compensation"] = [ "this action has no compensation change" ] if @params[:compensation] && !@action.compensation
      errors["separation"] = [ "is only allowed for a separation" ] if @params[:separation] && !separation?
      raise ValidationError, errors if errors.any?
    end

    def update_values!
      with_section_errors("assignment") { @action.assignment.update!(@params[:assignment]) } if @params[:assignment]
      update_compensation!(@params[:compensation]) if @params[:compensation]
    end

    def update_compensation!(changes)
      payload = Payload.new(action_type: "salary_change", employment_id: @action.employment_id,
                            effective_date: @action.effective_date.iso8601, compensation: changes.reverse_merge(annual_salary: current_salary_json))
      payload.validate!
      attrs = payload.compensation
      salary = attrs.delete(:annual_salary)
      with_section_errors("compensation") do
        @action.compensation.update!(attrs.merge(annual_salary_cents: salary.cents, currency: salary.currency.iso_code))
      end
    end

    def current_salary_json
      MoneySerializer.call(@action.compensation.annual_salary)
    end

    def move_effective_date!(new_date)
      old_date = @action.effective_date
      return if new_date == old_date
      raise ValidationError.for("effective_date", "can only be changed on the employment's latest action") unless @action.latest_for_employment?

      @action.hire? ? move_hire_date!(new_date) : move_change_date!(old_date, new_date)
      @action.effective_date = new_date
    end

    def move_hire_date!(new_date)
      with_section_errors("employment") { @action.employment.update!(hire_date: new_date) }
      [ @action.assignment, @action.compensation ].each do |row|
        with_section_errors { row.update!(effective_from: new_date) }
      end
    end

    # Rows must never overlap, so shrink first and grow second.
    def move_change_date!(old_date, new_date)
      [ @action.assignment, @action.compensation ].compact.each do |row|
        previous = row.class.where(employment_id: row.employment_id, effective_to: old_date).where.not(id: row.id).first
        if new_date <= previous.effective_from
          raise ValidationError.for("effective_date", "must be after #{previous.effective_from}, when the previous #{row.model_name.element} started")
        end

        steps = [ -> { row.update!(effective_from: new_date) }, -> { previous.update!(effective_to: new_date) } ]
        steps.reverse! if new_date < old_date
        with_section_errors { steps.each(&:call) }
      end
    end

    def update_separation!
      employment = @action.employment
      changes = @params[:separation].slice(*SEPARATION_FIELDS)
      old_end = employment.last_working_date + 1
      with_section_errors("separation") { employment.assign_attributes(changes) }
      new_last_day = employment.last_working_date
      raise ValidationError.for("separation.last_working_date", "is required") if new_last_day.nil?

      new_end = new_last_day + 1
      move_separation_end!(employment, old_end, new_end) if new_end != old_end
      employment.status = new_last_day < Date.current ? "separated" : "on_notice"
      with_section_errors("separation") { employment.save! }
      @action.effective_date = new_last_day
      employment.person.user&.sign_out_everywhere! if employment.separated?
    end

    def move_separation_end!(employment, old_end, new_end)
      [ employment.assignments, employment.compensations ].each do |rows|
        closing = rows.where(effective_to: old_end).to_a
        if closing.any? { |row| row.effective_from >= new_end }
          raise ValidationError.for("separation.last_working_date", "is before a later change; correct that change first")
        end

        with_section_errors("separation") { closing.each { |row| row.update!(effective_to: new_end) } }
      end
    end

    def save_action!
      attrs = @params.slice(*ACTION_FIELDS)
      @action.assign_attributes(attrs)
      @action.reviewed_at = @action.review_decision ? Time.current : nil if @action.review_decision_changed?
      @action.lock_version = @params.fetch(:lock_version)
      @action.updated_at = Time.current # always run the locked UPDATE
      with_section_errors { @action.save! }
    end
  end
end
