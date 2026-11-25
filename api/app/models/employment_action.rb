# One business event that changes an employment (docs/domain-model.md).
# It takes effect immediately; reviewer fields are informational only.
class EmploymentAction < ApplicationRecord
  has_paper_trail

  ACTION_TYPES = %w[hire promotion transfer manager_change regrade salary_change separation].freeze

  belongs_to :employment
  belongs_to :created_by_user, class_name: "User"
  belongs_to :reviewed_by_user, class_name: "User", optional: true
  has_one :assignment, dependent: :restrict_with_error
  has_one :compensation, dependent: :restrict_with_error

  string_enum :action_type, ACTION_TYPES
  string_enum :review_decision, %w[approved rejected], prefix: :review, allow_nil: true

  validates :effective_date, presence: true
  validates :reviewed_by_user, presence: true, if: :review_decision?
  validate :reviewer_is_hr
  validate :effective_date_not_before_hire_date

  scope :chronological, -> { order(:effective_date, :created_at) }

  def latest_for_employment?
    !employment.employment_actions.where.not(id: id).where(effective_date: effective_date..).exists?
  end

  private

  def reviewer_is_hr
    errors.add(:reviewed_by_user, "must be an HR user") if reviewed_by_user && !reviewed_by_user.hr?
  end

  def effective_date_not_before_hire_date
    return if employment.nil? || effective_date.blank? || employment.hire_date.blank?

    errors.add(:effective_date, "cannot be before the hire date") if effective_date < employment.hire_date
  end
end
