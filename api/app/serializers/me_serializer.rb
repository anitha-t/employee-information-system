# GET /api/v1/me: who am I, and where do I currently work.
class MeSerializer
  def initialize(user)
    @user = user
    @person = user.person
  end

  def as_json(*)
    {
      user: UserSerializer.new(@user).as_json,
      person: {
        id: @person.id,
        full_name: @person.full_name,
        preferred_name: @person.preferred_name,
        display_name: @person.display_name
      },
      employment: employment_json
    }
  end

  private

  def employment_json
    employment = @person.employments.where.not(status: "separated").order(hire_date: :desc).first
    return unless employment

    assignment = employment.current_assignment
    {
      id: employment.id,
      employee_number: employment.employee_number,
      status: employment.status,
      legal_entity: employment.legal_entity.name,
      country: employment.country.iso_code,
      job_title: assignment&.job&.title,
      team: assignment&.team&.name,
      manager: assignment&.reports_to_employment&.person&.display_name
    }
  end
end
