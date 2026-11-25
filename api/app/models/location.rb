class Location < ApplicationRecord
  has_paper_trail

  belongs_to :country
  has_many :legal_entities, dependent: :restrict_with_error
  has_many :positions, dependent: :restrict_with_error

  scope :active, -> { where(is_active: true) }

  validates :city, presence: true
end
