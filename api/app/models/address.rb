# Polymorphic: belongs to a Person (home / mailing) or a LegalEntity (registered).
class Address < ApplicationRecord
  has_paper_trail

  ADDRESSABLE_TYPES = %w[Person LegalEntity].freeze

  belongs_to :addressable, polymorphic: true
  belongs_to :country

  string_enum :address_type, %w[home mailing registered]

  validates :addressable_type, inclusion: { in: ADDRESSABLE_TYPES }
  validates :line1, :city, presence: true
  validate :address_type_matches_owner

  private

  # People have home / mailing addresses; legal entities have a registered address.
  def address_type_matches_owner
    allowed = addressable_type == "LegalEntity" ? %w[registered] : %w[home mailing]
    errors.add(:address_type, "must be one of: #{allowed.join(', ')}") if address_type.present? && allowed.exclude?(address_type)
  end
end
