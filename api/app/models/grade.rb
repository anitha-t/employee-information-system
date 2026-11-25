class Grade < ApplicationRecord
  has_paper_trail

  has_many :salary_bands, dependent: :restrict_with_error
  has_many :assignments, dependent: :restrict_with_error

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:rank) }

  validates :code, presence: true, uniqueness: true
  validates :name, presence: true
  validates :rank, presence: true, uniqueness: true, numericality: { only_integer: true }
end
