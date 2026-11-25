# A request-level validation failure that is not tied to one record, e.g. a
# payload that doesn't fit the action type. Renders as 422 validation_failed.
class ValidationError < StandardError
  attr_reader :details

  # details: { "field.path" => ["message", ...] }
  def initialize(details)
    @details = details
    super("Validation failed: #{details.map { |key, messages| "#{key} #{messages.join(', ')}" }.join('; ')}")
  end

  def self.for(key, message)
    new(key.to_s => [ message ])
  end
end
