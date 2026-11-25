# E.164: "+" followed by 7–15 digits, no leading zero.
class PhoneNumberValidator < ActiveModel::EachValidator
  FORMAT = /\A\+[1-9]\d{6,14}\z/

  def validate_each(record, attribute, value)
    return if value.blank?

    record.errors.add(attribute, options[:message] || "must be in E.164 format, e.g. +919800000000") unless FORMAT.match?(value)
  end
end
