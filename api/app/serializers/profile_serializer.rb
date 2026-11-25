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
      addresses: @person.addresses.sort_by(&:created_at).map { |address| AddressSerializer.new(address).as_json },
      emergency_contacts: @person.emergency_contacts.sort_by { |c| [ c.is_primary? ? 0 : 1, c.created_at ] }.map { |c| contact_json(c) }
    }
  end

  private

  def contact_json(contact)
    contact.slice(:id, :name, :relationship, :phone_number, :is_primary)
  end
end
