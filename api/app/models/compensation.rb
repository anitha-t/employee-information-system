# Salary, effective-dated. Created only by EmploymentActions. The currency is
# always the legal entity's country currency, so per-country sums never mix.
class Compensation < ApplicationRecord
  include EffectiveDated
  has_paper_trail

  PAY_FREQUENCIES = %w[monthly semi_monthly bi_weekly weekly].freeze

  belongs_to :employment
  belongs_to :employment_action

  monetize :annual_salary_cents, as: :annual_salary, with_model_currency: :currency,
                                 numericality: { greater_than: 0 }

  string_enum :pay_frequency, PAY_FREQUENCIES

  validate :currency_matches_legal_entity
  validate :starts_on_or_after_hire_date

  private

  def currency_matches_legal_entity
    return if employment.nil? || currency == employment.currency

    errors.add(:currency, "must be #{employment.currency} for #{employment.legal_entity.name}")
  end

  def starts_on_or_after_hire_date
    return if employment.nil? || effective_from.blank? || effective_from >= employment.hire_date

    errors.add(:effective_from, "cannot be before the hire date")
  end
end
