class GradeSerializer
  def initialize(grade)
    @grade = grade
  end

  def as_json(*)
    @grade.slice(:id, :code, :name, :rank, :is_active)
  end
end
