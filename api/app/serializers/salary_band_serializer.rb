class SalaryBandSerializer
  def initialize(band)
    @band = band
  end

  def as_json(*)
    @band.slice(:id, :currency, :effective_from, :effective_to).merge(
      country: @band.country.slice(:id, :iso_code),
      grade: @band.grade.slice(:id, :code, :rank),
      min: MoneySerializer.call(@band.min),
      max: MoneySerializer.call(@band.max)
    )
  end
end
