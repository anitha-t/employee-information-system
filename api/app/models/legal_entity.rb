# Employer of record. Its location's country is the employee's country for
# all reporting (docs/domain-model.md, decision 1).
class LegalEntity < ApplicationRecord
  include EffectiveDated
  has_paper_trail

  belongs_to :location
  has_many :addresses, as: :addressable, dependent: :destroy
  has_many :employments, dependent: :restrict_with_error
  has_many :positions, dependent: :restrict_with_error

  scope :active, -> { where(is_active: true) }

  validates :name, presence: true, uniqueness: true

  delegate :country, to: :location
  delegate :currency, to: :country
end
