module EmploymentActions
  # Validates and normalizes a POST /employment_actions payload against the
  # rules for its action type (docs/api-design.md §3.2). Raises
  # ValidationError listing every problem at once.
  class Payload
    SECTIONS = %w[person employment assignment compensation separation].freeze
    ASSIGNMENT_KEYS = %w[position_id grade_id reports_to_employment_id].freeze

    RULES = {
      "hire" => { required: %w[employment assignment compensation], optional: %w[person],
                  assignment_keys: ASSIGNMENT_KEYS, required_assignment_keys: %w[position_id grade_id] },
      "promotion" => { required: %w[assignment], optional: %w[compensation],
                       assignment_keys: ASSIGNMENT_KEYS, any_assignment_keys: %w[position_id grade_id] },
      "transfer" => { required: %w[assignment], optional: %w[compensation],
                      assignment_keys: ASSIGNMENT_KEYS, required_assignment_keys: %w[position_id] },
      "manager_change" => { required: %w[assignment],
                            assignment_keys: %w[reports_to_employment_id], required_assignment_keys: %w[reports_to_employment_id] },
      "regrade" => { required: %w[assignment], optional: %w[compensation],
                     assignment_keys: %w[grade_id], required_assignment_keys: %w[grade_id] },
      "salary_change" => { required: %w[compensation] },
      "separation" => { required: %w[separation] }
    }.freeze

    attr_reader :data

    def initialize(params)
      @data = params.to_h.with_indifferent_access
      @errors = Hash.new { |hash, key| hash[key] = [] }
    end

    def validate!
      rule = RULES[action_type]
      return fail_with("action_type", "must be one of: #{RULES.keys.join(', ')}") unless rule

      check_subject
      check_sections(rule)
      check_assignment(rule) if data[:assignment].is_a?(Hash)
      @compensation = parse_compensation if data[:compensation].is_a?(Hash)
      @effective_date = parse_effective_date
      raise ValidationError, @errors.to_h if @errors.any?

      self
    end

    def action_type = data[:action_type].to_s
    def hire? = action_type == "hire"
    def effective_date = @effective_date
    def section(name) = data[name]&.to_h&.with_indifferent_access
    def compensation = @compensation

    def action_attributes
      data.slice(:reason, :reviewed_by_user_id, :review_decision)
    end

    private

    def fail_with(key, message)
      @errors[key] << message
      raise ValidationError, @errors.to_h
    end

    def check_subject
      if hire?
        @errors["employment_id"] << "must not be given for a hire" if data.key?(:employment_id)
        @errors["person"] << "or person_id is required" if data[:person].blank? && data[:person_id].blank?
        @errors["person"] << "and person_id cannot both be given" if data[:person].present? && data[:person_id].present?
      elsif data[:employment_id].blank?
        @errors["employment_id"] << "is required"
      end
    end

    def check_sections(rule)
      allowed = rule[:required] + rule.fetch(:optional, [])
      SECTIONS.each do |name|
        given = data.key?(name)
        @errors[name] << "is required for #{action_type}" if rule[:required].include?(name) && !data[name].is_a?(Hash)
        @errors[name] << "is not allowed for #{action_type}" if given && allowed.exclude?(name)
      end
    end

    def check_assignment(rule)
      assignment = data[:assignment]
      (assignment.keys - rule[:assignment_keys]).each { |key| @errors["assignment.#{key}"] << "cannot be set by #{action_type}" }
      rule.fetch(:required_assignment_keys, []).each do |key|
        @errors["assignment.#{key}"] << "is required" unless assignment.key?(key) && (assignment[key].present? || key == "reports_to_employment_id")
      end
      any = rule[:any_assignment_keys]
      @errors["assignment"] << "must change #{any.join(' or ')}" if any && any.none? { |key| assignment[key].present? }
    end

    def parse_compensation
      compensation = data[:compensation]
      salary = compensation[:annual_salary]
      unless salary.is_a?(Hash) && salary[:amount].present? && salary[:currency].present?
        @errors["compensation.annual_salary"] << "must be {amount, currency}"
        return
      end

      amount = BigDecimal(salary[:amount].to_s, exception: false)
      return @errors["compensation.annual_salary.amount"] << "must be a positive number" unless amount&.positive?

      currency = Money::Currency.find(salary[:currency])
      return @errors["compensation.annual_salary.currency"] << "is not a known currency" unless currency

      { annual_salary: Money.from_amount(amount, currency), pay_frequency: compensation[:pay_frequency] }.compact
    end

    def parse_effective_date
      if action_type == "separation"
        separation = data[:separation].is_a?(Hash) ? data[:separation] : {}
        last_day = parse_date(separation[:last_working_date], "separation.last_working_date")
        @errors["effective_date"] << "must equal separation.last_working_date" if data[:effective_date].present? && parse_date(data[:effective_date], "effective_date") != last_day
        return last_day
      end

      parse_date(data[:effective_date], "effective_date")
    end

    def parse_date(value, key)
      if value.blank?
        @errors[key] << "is required"
        return
      end

      Date.iso8601(value.to_s)
    rescue Date::Error
      @errors[key] << "must be an ISO-8601 date"
      nil
    end
  end
end
