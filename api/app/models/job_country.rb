class JobCountry < ApplicationRecord
  belongs_to :job
  belongs_to :country

  validates :country_id, uniqueness: { scope: :job_id }
end
