class LocationSerializer
  def initialize(location)
    @location = location
  end

  def as_json(*)
    @location.slice(:id, :city, :state, :is_active).merge(country: @location.country.slice(:id, :iso_code, :name))
  end
end
