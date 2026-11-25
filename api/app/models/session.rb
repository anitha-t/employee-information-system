# One bearer token per login. Only a SHA-256 digest of the token is stored;
# the raw token is returned once, at sign-in.
class Session < ApplicationRecord
  TTL = 14.days

  belongs_to :user

  scope :unexpired, -> { where(expires_at: Time.current..) }

  # Returns [session, raw_token].
  def self.start!(user:, ip_address: nil, user_agent: nil)
    token = SecureRandom.base58(32)
    session = create!(user: user, token_digest: digest(token), ip_address: ip_address,
                      user_agent: user_agent&.truncate(255), expires_at: TTL.from_now)
    [ session, token ]
  end

  def self.find_by_token(token)
    return if token.blank?

    unexpired.includes(:user).find_by(token_digest: digest(token))
  end

  def self.digest(token)
    OpenSSL::Digest::SHA256.hexdigest(token)
  end
end
