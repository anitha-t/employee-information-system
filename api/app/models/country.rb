class Country < ApplicationRecord
  has_many :locations, dependent: :restrict_with_error
  has_many :salary_bands, dependent: :restrict_with_error
  has_many :job_countries, dependent: :restrict_with_error
  has_many :jobs, through: :job_countries

  normalizes :iso_code, :currency, with: ->(value) { value.strip.upcase }

  validates :iso_code, presence: true, uniqueness: true, format: { with: /\A[A-Z]{2}\z/ }
  validates :name, presence: true
  validates :currency, presence: true, format: { with: /\A[A-Z]{3}\z/ }
  validate :currency_known_to_money

  private

  def currency_known_to_money
    errors.add(:currency, "is not a known ISO-4217 currency") if currency.present? && Money::Currency.find(currency).nil?
  end
end
