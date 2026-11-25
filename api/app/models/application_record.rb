class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # UUID primary keys have no order; make .first / .last deterministic.
  self.implicit_order_column = :created_at

  # Builds a string-backed enum from a list of values, validated by Rails.
  def self.string_enum(name, values, allow_nil: false, **options)
    enum name, values.index_with(&:to_s), validate: allow_nil ? { allow_nil: true } : true, **options
  end
end
