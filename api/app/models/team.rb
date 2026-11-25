class Team < ApplicationRecord
  has_paper_trail

  belongs_to :parent, class_name: "Team", optional: true
  has_many :children, class_name: "Team", foreign_key: :parent_id, dependent: :restrict_with_error, inverse_of: :parent
  has_many :positions, dependent: :restrict_with_error

  scope :active, -> { where(is_active: true) }
  scope :roots, -> { where(parent_id: nil) }

  validates :name, presence: true
  validate :parent_is_not_self_or_descendant

  private

  def parent_is_not_self_or_descendant
    node = parent
    while node
      return errors.add(:parent, "cannot be the team itself or one of its sub-teams") if node.id == id && id.present?

      node = node.parent
    end
  end
end
