class User < ApplicationRecord
  has_paper_trail skip: %i[password_digest]
  has_secure_password

  belongs_to :person
  has_many :sessions, dependent: :destroy

  string_enum :role, %w[hr employee]

  normalizes :email_address, with: ->(email) { email.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :person_id, uniqueness: true
  validates :password, length: { minimum: 12 }, allow_nil: true
end
