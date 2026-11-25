# What the employee does, effective-dated. Created only by EmploymentActions.
class Assignment < ApplicationRecord
  include EffectiveDated
  has_paper_trail

  belongs_to :employment
  belongs_to :employment_action
  belongs_to :position
  belongs_to :grade
  belongs_to :reports_to_employment, class_name: "Employment", optional: true, inverse_of: :direct_report_assignments

  scope :primary, -> { where(is_primary: true) }

  delegate :job, :team, to: :position

  validate :position_in_employment_legal_entity
  validate :grade_within_job_range
  validate :starts_on_or_after_hire_date
  validate :does_not_report_to_self

  private

  def position_in_employment_legal_entity
    return if position.nil? || employment.nil? || position.legal_entity_id == employment.legal_entity_id

    errors.add(:position, "must belong to the employment's legal entity")
  end

  def grade_within_job_range
    return if position.nil? || grade.nil? || position.job.grade_allowed?(grade)

    errors.add(:grade, "must be between #{position.job.min_grade.code} and #{position.job.max_grade.code} for this job")
  end

  def starts_on_or_after_hire_date
    return if employment.nil? || effective_from.blank? || effective_from >= employment.hire_date

    errors.add(:effective_from, "cannot be before the hire date")
  end

  def does_not_report_to_self
    errors.add(:reports_to_employment, "cannot be the employee themselves") if reports_to_employment_id.present? && reports_to_employment_id == employment_id
  end
end
