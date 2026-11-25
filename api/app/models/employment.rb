# One stint of a person with one legal entity. The legal entity (and so the
# country and currency) never changes; moving entity = separation + new hire.
class Employment < ApplicationRecord
  has_paper_trail

  EMPLOYMENT_TYPES = %w[full_time part_time contractor intern].freeze
  STATUSES = %w[active on_notice separated].freeze
  SEPARATION_TYPES = %w[voluntary involuntary retirement end_of_contract other].freeze

  # employee_number is assigned by the database from employee_number_seq.
  attr_readonly :legal_entity_id, :employee_number

  belongs_to :person
  belongs_to :legal_entity
  has_many :employment_actions, dependent: :restrict_with_error
  has_many :assignments, dependent: :restrict_with_error
  has_many :compensations, dependent: :restrict_with_error
  has_many :direct_report_assignments, class_name: "Assignment", foreign_key: :reports_to_employment_id,
                                       inverse_of: :reports_to_employment, dependent: :restrict_with_error

  string_enum :employment_type, EMPLOYMENT_TYPES
  string_enum :status, STATUSES
  string_enum :separation_type, SEPARATION_TYPES, prefix: :separation, allow_nil: true

  normalizes :work_email, with: ->(email) { email.strip.downcase }

  validates :hire_date, presence: true
  validates :notice_period_days, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :work_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :work_email, uniqueness: { conditions: -> { where.not(status: "separated") } },
                         allow_blank: true, unless: :separated?
  validate :last_working_date_after_hire_date

  delegate :country, :currency, to: :legal_entity

  def current_assignment(on: Date.current)
    assignments.primary.active_on(on).first
  end

  def current_compensation(on: Date.current)
    compensations.active_on(on).first
  end

  private

  def last_working_date_after_hire_date
    return if last_working_date.blank? || hire_date.blank? || last_working_date >= hire_date

    errors.add(:last_working_date, "cannot be before hire_date")
  end
end
