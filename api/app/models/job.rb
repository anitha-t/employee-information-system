class Job < ApplicationRecord
  has_paper_trail

  belongs_to :min_grade, class_name: "Grade"
  belongs_to :max_grade, class_name: "Grade"
  has_many :job_countries, dependent: :destroy
  has_many :countries, through: :job_countries
  has_many :positions, dependent: :restrict_with_error

  scope :active, -> { where(is_active: true) }
  scope :available_in, ->(country) { joins(:job_countries).where(job_countries: { country_id: country }) }

  validates :code, presence: true, uniqueness: true
  validates :title, presence: true
  validate :grade_range_ordered

  def grade_allowed?(grade)
    grade.present? && grade.rank.between?(min_grade.rank, max_grade.rank)
  end

  private

  def grade_range_ordered
    return if min_grade.nil? || max_grade.nil? || max_grade.rank >= min_grade.rank

    errors.add(:max_grade, "must be the same as or above the minimum grade")
  end
end
