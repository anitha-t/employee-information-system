# Polymorphic: belongs to a Person (home / mailing) or a LegalEntity (registered).
class Address < ApplicationRecord
  has_paper_trail

  ADDRESSABLE_TYPES = %w[Person LegalEntity].freeze

  belongs_to :addressable, polymorphic: true
  belongs_to :country

  string_enum :address_type, %w[home mailing registered]

  validates :addressable_type, inclusion: { in: ADDRESSABLE_TYPES }
  validates :line1, :city, presence: true
end
