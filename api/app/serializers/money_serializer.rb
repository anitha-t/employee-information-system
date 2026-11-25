# Money as JSON: {"amount": "1850000.00", "currency": "INR"}. The amount is a
# string so no precision is lost in JavaScript (docs/api-design.md §1).
module MoneySerializer
  def self.call(money)
    return if money.nil?

    { amount: money.format(symbol: false, thousands_separator: "", decimal_mark: "."), currency: money.currency.iso_code }
  end
end
