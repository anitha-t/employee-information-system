# Salaries are always stored with their own currency column
# (monetize ..., with_model_currency: :currency). The default currency is only
# a fallback and must never be relied on for domain data.
MoneyRails.configure do |config|
  config.default_currency = :usd
  config.locale_backend = :currency
  config.rounding_mode = BigDecimal::ROUND_HALF_EVEN
  config.no_cents_if_whole = false
end
