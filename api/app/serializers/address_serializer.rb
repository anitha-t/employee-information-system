# A person's or legal entity's address.
class AddressSerializer
  def initialize(address)
    @address = address
  end

  def as_json(*)
    @address.slice(:id, :address_type, :line1, :line2, :city, :state, :postal_code)
            .merge(country: @address.country.slice(:id, :iso_code, :name))
  end
end
