module EmploymentActions
  # Re-raises model validation errors as a ValidationError whose keys are
  # prefixed with the payload section, e.g. "compensation.currency".
  module RecordErrors
    SECTION_FOR = {
      "Person" => "person", "Employment" => "employment", "Assignment" => "assignment",
      "Compensation" => "compensation", "EmploymentAction" => nil
    }.freeze

    private

    def with_section_errors(section = nil)
      yield
    rescue ActiveRecord::RecordInvalid => e
      prefix = section || SECTION_FOR[e.record.class.name]
      details = e.record.errors.to_hash(false).transform_keys { |key| [ prefix, key ].compact.join(".") }
      raise ValidationError, details
    end
  end
end
