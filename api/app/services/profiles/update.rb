module Profiles
  # Saves a person's profile and its nested addresses / emergency contacts in
  # one transaction (docs/api-design.md §3.1).
  #
  # The person's lock_version guards the whole profile: it is checked and
  # bumped on every save, even when only nested records change, so two people
  # editing the same profile can't silently overwrite each other (409).
  class Update
    def initialize(person:, attributes:, lock_version:)
      @person = person
      @attributes = attributes
      @lock_version = lock_version
    end

    def call
      Person.transaction do
        @person.assign_attributes(@attributes)
        @person.lock_version = @lock_version
        @person.updated_at = Time.current # forces the locked UPDATE on the person row
        @person.save!
      end
      @person
    end
  end
end
