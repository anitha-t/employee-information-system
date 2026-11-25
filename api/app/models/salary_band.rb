class SalaryBand < ApplicationRecord
  include EffectiveDated
  has_paper_trail

  belongs_to :grade
  belongs_to :country

  monetize :min_cents, as: :min, with_model_currency: :currency
  monetize :max_cents, as: :max, with_model_currency: :currency

  validates :min_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :max_cents, numericality: { greater_than_or_equal_to: :min_cents }, if: :min_cents
  validate :currency_matches_country

  def covers?(money)
    money.currency == min.currency && money.between?(min, max)
  end

  private

  def currency_matches_country
    return if country.nil? || currency == country.currency

    errors.add(:currency, "must be #{country.currency} for #{country.iso_code}")
  end
end
