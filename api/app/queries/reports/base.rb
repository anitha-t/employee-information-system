module Reports
  # Shared helpers for the salary reports. Every report is per country, in
  # that country's currency; amounts are never summed across currencies.
  class Base
    def initialize(country: nil)
      @country_code = country.presence&.upcase
    end

    private

    # The countries to report on, in a stable order. Unknown codes are a 422.
    def countries
      @countries ||= begin
        scope = Country.order(:iso_code)
        scope = scope.where(iso_code: @country_code) if @country_code
        scope.to_a.tap do |found|
          raise ValidationError.for("country", "is not a known country code") if @country_code && found.empty?
        end
      end
    end

    def money(cents, currency)
      MoneySerializer.call(Money.new(cents.round, currency)) unless cents.nil?
    end

    def sql(template, binds)
      ActiveRecord::Base.sanitize_sql_array([ template, binds ])
    end
  end
end
