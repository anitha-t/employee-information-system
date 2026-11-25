# A person's profile (docs/api-design.md §2.2, §2.4).
# HR can read and edit anyone's profile; employees only their own, and only
# their contact details, addresses and emergency contacts.
class ProfilePolicy < ApplicationPolicy
  SELF_SERVICE_ATTRIBUTES = %w[preferred_name phone_number email addresses emergency_contacts].freeze
  HR_ONLY_ATTRIBUTES = %w[first_name last_name dob gender].freeze

  def show? = hr? || own_profile?
  def update? = show?

  # Top-level fields this user may send in PATCH .../profile.
  def permitted_attributes
    hr? ? SELF_SERVICE_ATTRIBUTES + HR_ONLY_ATTRIBUTES : SELF_SERVICE_ATTRIBUTES
  end

  private

  def own_profile?
    user.present? && record.id == user.person_id
  end
end
