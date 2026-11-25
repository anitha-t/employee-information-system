# paper_trail audit trail. UUID item ids and jsonb so the audit API can
# return field-level diffs ({field: [old, new]}) from object_changes.
class CreateVersions < ActiveRecord::Migration[8.1]
  def change
    create_table :versions, id: :uuid do |t|
      t.string   :item_type, null: false
      t.uuid     :item_id,   null: false
      t.string   :event,     null: false
      t.string   :whodunnit             # current_user.id
      t.jsonb    :object
      t.jsonb    :object_changes
      t.string   :request_id
      t.string   :ip
      t.datetime :created_at, null: false
    end

    add_index :versions, %i[item_type item_id]
    add_index :versions, :whodunnit
    add_index :versions, :created_at
  end
end
