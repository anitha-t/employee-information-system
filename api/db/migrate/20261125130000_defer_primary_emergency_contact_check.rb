# Moving "primary" from one emergency contact to another in a single profile
# update briefly has two primaries mid-save. A partial unique index cannot be
# deferred, so replace it with an exclusion constraint checked at commit.
class DeferPrimaryEmergencyContactCheck < ActiveRecord::Migration[8.1]
  def change
    remove_index :emergency_contacts, :person_id, unique: true, where: "is_primary",
                 name: "index_emergency_contacts_one_primary_per_person"

    add_exclusion_constraint :emergency_contacts, "person_id WITH =",
                             using: :gist, where: "is_primary", deferrable: :deferred,
                             name: "emergency_contacts_one_primary_per_person"
  end
end
