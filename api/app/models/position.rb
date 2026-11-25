# A seat in the org: a job, in a team, at a legal entity.
class Position < ApplicationRecord
  include EffectiveDated
  has_paper_trail

  belongs_to :job
  belongs_to :team
  belongs_to :legal_entity
  belongs_to :location, optional: true
  has_many :assignments, dependent: :restrict_with_error

  validates :code, presence: true, uniqueness: true
  validates :name, presence: true
  validates :required_head_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :location, presence: true, unless: :is_remote?

  def filled_head_count(on: Date.current)
    assignments.primary.active_on(on).count
  end
end
