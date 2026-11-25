class EmergencyContact < ApplicationRecord
  has_paper_trail

  belongs_to :person

  validates :name, presence: true
  validates :phone_number, presence: true, phone_number: true
end
