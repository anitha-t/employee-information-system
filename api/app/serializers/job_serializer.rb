# A job, its allowed grade range and the countries it is available in.
class JobSerializer
  def initialize(job)
    @job = job
  end

  def as_json(*)
    @job.slice(:id, :code, :title, :level, :description, :is_active).merge(
      min_grade: grade_json(@job.min_grade),
      max_grade: grade_json(@job.max_grade),
      countries: @job.countries.map(&:iso_code).sort
    )
  end

  private

  def grade_json(grade) = grade.slice(:id, :code, :rank)
end
