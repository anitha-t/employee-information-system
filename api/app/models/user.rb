class User < ApplicationRecord
  has_paper_trail skip: %i[password_digest]
  has_secure_password reset_token: { expires_in: 1.hour }

  belongs_to :person
  has_many :sessions, dependent: :destroy

  string_enum :role, %w[hr employee]

  normalizes :email_address, with: ->(email) { email.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :person_id, uniqueness: true
  validates :password, length: { minimum: 12 }, allow_nil: true

  # People who have only separated employments can no longer sign in.
  # A person with no employment yet (e.g. a bootstrap HR admin) can.
  def can_sign_in?
    employments = person.employments
    employments.none? || employments.where.not(status: "separated").exists?
  end

  # Revokes every bearer token, e.g. after a password reset or separation.
  def sign_out_everywhere!
    sessions.delete_all
  end
end
