# Organisation reference data. See docs/domain-model.md "Reference / Organisation".
class CreateReferenceData < ActiveRecord::Migration[8.1]
  def change
    create_table :countries, id: :uuid do |t|
      t.string :iso_code, null: false, limit: 2
      t.string :name, null: false
      t.string :currency, null: false, limit: 3
      t.timestamps
    end
    add_index :countries, :iso_code, unique: true

    create_table :locations, id: :uuid do |t|
      t.references :country, type: :uuid, null: false, foreign_key: true
      t.string :state
      t.string :city, null: false
      t.boolean :is_active, null: false, default: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end

    create_table :legal_entities, id: :uuid do |t|
      t.string :name, null: false
      t.references :location, type: :uuid, null: false, foreign_key: true
      t.date :effective_from, null: false
      t.date :effective_to
      t.boolean :is_active, null: false, default: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :legal_entities, :name, unique: true
    add_check_constraint :legal_entities, "effective_to IS NULL OR effective_to > effective_from",
                         name: "legal_entities_valid_range"

    create_table :teams, id: :uuid do |t|
      t.string :name, null: false
      t.references :parent, type: :uuid, foreign_key: { to_table: :teams }
      t.boolean :is_active, null: false, default: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end

    create_table :grades, id: :uuid do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.integer :rank, null: false
      t.boolean :is_active, null: false, default: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :grades, :code, unique: true
    add_index :grades, :rank, unique: true

    create_table :salary_bands, id: :uuid do |t|
      t.references :grade, type: :uuid, null: false, foreign_key: true
      t.references :country, type: :uuid, null: false, foreign_key: true
      t.bigint :min_cents, null: false
      t.bigint :max_cents, null: false
      t.string :currency, null: false, limit: 3
      t.date :effective_from, null: false
      t.date :effective_to
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_check_constraint :salary_bands, "min_cents >= 0 AND max_cents >= min_cents", name: "salary_bands_valid_amounts"
    add_check_constraint :salary_bands, "effective_to IS NULL OR effective_to > effective_from",
                         name: "salary_bands_valid_range"
    add_exclusion_constraint :salary_bands,
                             "grade_id WITH =, country_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&",
                             using: :gist, name: "salary_bands_no_overlap"

    create_table :jobs, id: :uuid do |t|
      t.string :code, null: false
      t.string :title, null: false
      t.string :level
      t.text :description
      t.references :min_grade, type: :uuid, null: false, foreign_key: { to_table: :grades }
      t.references :max_grade, type: :uuid, null: false, foreign_key: { to_table: :grades }
      t.boolean :is_active, null: false, default: true
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :jobs, :code, unique: true
    add_index :jobs, :title

    create_table :job_countries, id: :uuid do |t|
      t.references :job, type: :uuid, null: false, foreign_key: true
      t.references :country, type: :uuid, null: false, foreign_key: true
      t.timestamps
    end
    add_index :job_countries, %i[job_id country_id], unique: true

    create_table :positions, id: :uuid do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.references :job, type: :uuid, null: false, foreign_key: true
      t.references :team, type: :uuid, null: false, foreign_key: true
      t.references :legal_entity, type: :uuid, null: false, foreign_key: true
      t.references :location, type: :uuid, foreign_key: true
      t.boolean :is_remote, null: false, default: false
      t.integer :required_head_count, null: false, default: 1
      t.date :effective_from, null: false
      t.date :effective_to
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :positions, :code, unique: true
    add_check_constraint :positions, "is_remote OR location_id IS NOT NULL", name: "positions_location_unless_remote"
    add_check_constraint :positions, "required_head_count >= 0", name: "positions_head_count_non_negative"
    add_check_constraint :positions, "effective_to IS NULL OR effective_to > effective_from",
                         name: "positions_valid_range"
  end
end
