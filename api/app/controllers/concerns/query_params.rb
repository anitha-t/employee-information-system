# Typed readers for query-string parameters. Rails turns ?x[]=1 into an Array
# and ?x[a]=1 into a hash, which would crash string / date handling (500) or
# reach a query unexpectedly. These accept only a single string and answer
# 422 for anything else.
module QueryParams
  BOOLEANS = { "true" => true, "1" => true, "false" => false, "0" => false }.freeze

  private

  # The string value, or nil when absent or blank.
  def string_param(key)
    value = params[key]
    return if value.blank?
    raise ValidationError.for(key, "must be a single value") unless value.is_a?(String)

    value
  end

  # { key => string } for the given keys that are present.
  def string_params(*keys)
    keys.index_with { |key| string_param(key) }.compact
  end

  def date_param(key, default: nil)
    value = string_param(key)
    return default if value.nil?

    Date.iso8601(value)
  rescue Date::Error
    raise ValidationError.for(key, "must be an ISO-8601 date")
  end

  def integer_param(key, default: nil)
    value = string_param(key)
    return default if value.nil?

    Integer(value, 10, exception: false) || raise(ValidationError.for(key, "must be a whole number"))
  end

  # true / 1 or false / 0; anything else is a 422.
  def boolean_param(key, default: false)
    value = string_param(key)
    return default if value.nil?

    BOOLEANS.fetch(value.downcase) { raise ValidationError.for(key, "must be true or false") }
  end
end
