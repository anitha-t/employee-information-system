# Employment, actions and effective-dated assignment / compensation.
# See docs/domain-model.md "Employment" and "Integrity constraints".
class CreateEmployment < ActiveRecord::Migration[8.1]
  def up
    execute "CREATE SEQUENCE employee_number_seq START 1"

    create_table :employments, id: :uuid do |t|
      t.references :person, type: :uuid, null: false, foreign_key: true
      t.references :legal_entity, type: :uuid, null: false, foreign_key: true
      t.string :employee_number, null: false,
               default: -> { "'E' || lpad(nextval('employee_number_seq')::text, 6, '0')" }
      t.string :employment_type, null: false
      t.string :status, null: false, default: "active"
      t.date :hire_date, null: false
      t.integer :notice_period_days
      t.date :resignation_date
      t.date :last_working_date
      t.string :separation_type
      t.text :separation_reason
      t.boolean :eligible_for_rehire
      t.string :work_email
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :employments, :employee_number, unique: true
    # A rehired person may get their old work email back once the previous stint is separated.
    add_index :employments, :work_email, unique: true, where: "status <> 'separated'",
              name: "index_employments_on_work_email_unless_separated"
    add_index :employments, :status
    add_check_constraint :employments, "last_working_date IS NULL OR last_working_date >= hire_date",
                         name: "employments_valid_last_working_date"

    create_table :employment_actions, id: :uuid do |t|
      t.references :employment, type: :uuid, null: false, foreign_key: true, index: false
      t.string :action_type, null: false
      t.date :effective_date, null: false
      t.text :reason
      t.references :created_by_user, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.references :reviewed_by_user, type: :uuid, foreign_key: { to_table: :users }
      t.string :review_decision
      t.datetime :reviewed_at
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    add_index :employment_actions, %i[employment_id effective_date]
    add_index :employment_actions, :action_type

    create_table :assignments, id: :uuid do |t|
      t.references :employment, type: :uuid, null: false, foreign_key: true, index: false
      t.references :employment_action, type: :uuid, null: false, foreign_key: true
      t.references :position, type: :uuid, null: false, foreign_key: true
      t.references :grade, type: :uuid, null: false, foreign_key: true
      t.references :reports_to_employment, type: :uuid, foreign_key: { to_table: :employments }
      t.boolean :is_primary, null: false, default: true
      t.date :effective_from, null: false
      t.date :effective_to
      t.timestamps
    end
    add_index :assignments, %i[employment_id effective_from]
    add_check_constraint :assignments, "effective_to IS NULL OR effective_to > effective_from",
                         name: "assignments_valid_range"
    add_exclusion_constraint :assignments,
                             "employment_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&",
                             using: :gist, where: "is_primary", name: "assignments_no_overlapping_primary"

    create_table :compensations, id: :uuid do |t|
      t.references :employment, type: :uuid, null: false, foreign_key: true, index: false
      t.references :employment_action, type: :uuid, null: false, foreign_key: true
      t.bigint :annual_salary_cents, null: false
      t.string :currency, null: false, limit: 3
      t.string :pay_frequency, null: false, default: "monthly"
      t.date :effective_from, null: false
      t.date :effective_to
      t.timestamps
    end
    add_index :compensations, %i[employment_id effective_from]
    add_check_constraint :compensations, "annual_salary_cents > 0", name: "compensations_positive_salary"
    add_check_constraint :compensations, "effective_to IS NULL OR effective_to > effective_from",
                         name: "compensations_valid_range"
    add_exclusion_constraint :compensations,
                             "employment_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&",
                             using: :gist, name: "compensations_no_overlap"
  end

  def down
    drop_table :compensations
    drop_table :assignments
    drop_table :employment_actions
    drop_table :employments
    execute "DROP SEQUENCE employee_number_seq"
  end
end
