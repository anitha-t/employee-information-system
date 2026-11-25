class EnableExtensions < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pgcrypto"   # gen_random_uuid() for UUID primary keys
    enable_extension "btree_gist" # exclusion constraints on effective-dated ranges
    enable_extension "pg_trgm"    # trigram employee search
  end
end
