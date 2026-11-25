class Person < ApplicationRecord
  include PgSearch::Model
  has_paper_trail skip: %i[full_name search_vector]

  GENDERS = %w[female male non_binary undisclosed].freeze

  has_many :addresses, as: :addressable, dependent: :destroy
  has_many :emergency_contacts, dependent: :destroy
  has_many :employments, dependent: :restrict_with_error
  has_one :user, dependent: :restrict_with_error

  accepts_nested_attributes_for :addresses, allow_destroy: true
  accepts_nested_attributes_for :emergency_contacts, allow_destroy: true

  string_enum :gender, GENDERS, prefix: true, allow_nil: true

  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :first_name, :last_name, :preferred_name, with: ->(name) { name.strip.presence }

  validates :first_name, presence: true
  validates :email, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :phone_number, phone_number: true
  validate :at_most_one_primary_emergency_contact

  # Full-text on the generated search_vector (names + email), plus trigram
  # similarity on full_name so typos and partial names still match.
  pg_search_scope :search,
                  against: %i[full_name],
                  using: {
                    tsearch: { tsvector_column: "search_vector", dictionary: "simple", prefix: true },
                    trigram: { threshold: 0.2 }
                  }

  def display_name
    preferred_name.presence || full_name || [ first_name, last_name ].compact.join(" ")
  end

  private

  def at_most_one_primary_emergency_contact
    primaries = emergency_contacts.reject(&:marked_for_destruction?).count(&:is_primary?)
    errors.add(:emergency_contacts, "can have only one primary contact") if primaries > 1
  end
end
