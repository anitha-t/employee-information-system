class CountrySerializer
  def initialize(country)
    @country = country
  end

  def as_json(*)
    @country.slice(:id, :iso_code, :name, :currency)
  end
end
