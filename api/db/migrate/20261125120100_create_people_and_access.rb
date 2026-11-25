# People, contact details and login. See docs/domain-model.md "People & Access".
class CreatePeopleAndAccess < ActiveRecord::Migration[8.1]
  def change
    create_table :people, id: :uuid do |t|
      t.string :first_name, null: false
      t.string :last_name
      t.string :preferred_name
      t.virtual :full_name, type: :string, stored: true,
                as: "(first_name || COALESCE(' ' || last_name, ''))"
      t.string :email
      t.string :phone_number
      t.date :dob
      t.string :gender
      t.virtual :search_vector, type: :tsvector, stored: true,
                as: "to_tsvector('simple', " \
                    "COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || " \
                    "COALESCE(preferred_name, '') || ' ' || COALESCE(email, ''))"
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :people, :email, unique: true
    add_index :people, :search_vector, using: :gin
    add_index :people, :full_name, using: :gin, opclass: :gin_trgm_ops
    add_index :people, :preferred_name, using: :gin, opclass: :gin_trgm_ops

    create_table :emergency_contacts, id: :uuid do |t|
      t.references :person, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :relationship
      t.string :phone_number, null: false
      t.boolean :is_primary, null: false, default: false
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :emergency_contacts, :person_id, unique: true, where: "is_primary",
              name: "index_emergency_contacts_one_primary_per_person"

    create_table :addresses, id: :uuid do |t|
      t.references :addressable, type: :uuid, polymorphic: true, null: false
      t.string :address_type, null: false
      t.string :line1, null: false
      t.string :line2
      t.string :city, null: false
      t.string :state
      t.string :postal_code
      t.references :country, type: :uuid, null: false, foreign_key: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end

    create_table :users, id: :uuid do |t|
      t.references :person, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.string :email_address, null: false
      t.string :password_digest, null: false
      t.string :role, null: false, default: "employee"
      t.timestamps
    end
    add_index :users, :email_address, unique: true
    add_check_constraint :users, "role IN ('hr', 'employee')", name: "users_valid_role"

    create_table :sessions, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string :token_digest, null: false
      t.string :ip_address
      t.string :user_agent
      t.datetime :expires_at, null: false
      t.timestamps
    end
    add_index :sessions, :token_digest, unique: true
  end
end
