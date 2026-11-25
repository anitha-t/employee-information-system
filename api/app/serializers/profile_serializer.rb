class ProfileSerializer
  def initialize(person)
    @person = person
  end

  def as_json(*)
    {
      id: @person.id,
      lock_version: @person.lock_version,
      first_name: @person.first_name,
      last_name: @person.last_name,
      full_name: @person.full_name,
      preferred_name: @person.preferred_name,
      email: @person.email,
      phone_number: @person.phone_number,
      dob: @person.dob,
      gender: @person.gender,
      addresses: @person.addresses.sort_by(&:created_at).map { |address| address_json(address) },
      emergency_contacts: @person.emergency_contacts.sort_by { |c| [ c.is_primary? ? 0 : 1, c.created_at ] }.map { |c| contact_json(c) }
    }
  end

  private

  def address_json(address)
    address.slice(:id, :address_type, :line1, :line2, :city, :state, :postal_code)
           .merge(country: address.country.slice(:id, :iso_code, :name))
  end

  def contact_json(contact)
    contact.slice(:id, :name, :relationship, :phone_number, :is_primary)
  end
end
