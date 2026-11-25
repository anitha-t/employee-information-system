# A legal entity, with the country (and currency) every employment there
# reports under, and its registered addresses.
class LegalEntitySerializer
  def initialize(entity)
    @entity = entity
  end

  def as_json(*)
    location = @entity.location
    @entity.slice(:id, :name, :is_active, :effective_from, :effective_to).merge(
      location: location.slice(:id, :city, :state),
      country: location.country.slice(:id, :iso_code, :name, :currency),
      addresses: @entity.addresses.sort_by(&:created_at).map { |address| AddressSerializer.new(address).as_json }
    )
  end
end
