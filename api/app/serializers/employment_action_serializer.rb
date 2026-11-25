class EmploymentActionSerializer
  def initialize(action, warnings: [], include_previous: false)
    @action = action
    @warnings = warnings
    @include_previous = include_previous
  end

  def as_json(*)
    employment = @action.employment
    json = {
      id: @action.id,
      lock_version: @action.lock_version,
      action_type: @action.action_type,
      effective_date: @action.effective_date,
      reason: @action.reason,
      employment: { id: employment.id, employee_number: employment.employee_number, status: employment.status,
                    person: { id: employment.person_id, display_name: employment.person.display_name } },
      assignment: assignment_json(@action.assignment),
      compensation: compensation_json(@action.compensation),
      separation: (separation_json(employment) if @action.separation?),
      created_by: user_json(@action.created_by_user),
      created_at: @action.created_at,
      reviewed_by: user_json(@action.reviewed_by_user),
      review_decision: @action.review_decision,
      reviewed_at: @action.reviewed_at
    }
    json[:previous] = previous_json if @include_previous
    json[:warnings] = @warnings if @warnings.any?
    json
  end

  private

  def previous_json
    {
      assignment: assignment_json(previous_row(@action.assignment)),
      compensation: compensation_json(previous_row(@action.compensation))
    }
  end

  def previous_row(row)
    row && row.class.where(employment_id: row.employment_id, effective_to: row.effective_from).where.not(id: row.id).first
  end

  def assignment_json(assignment)
    return unless assignment

    position = assignment.position
    {
      id: assignment.id, effective_from: assignment.effective_from, effective_to: assignment.effective_to,
      position: { id: position.id, code: position.code, name: position.name },
      job: { id: position.job_id, title: position.job.title },
      team: { id: position.team_id, name: position.team.name },
      grade: { id: assignment.grade_id, code: assignment.grade.code },
      reports_to: assignment.reports_to_employment && {
        employment_id: assignment.reports_to_employment_id,
        display_name: assignment.reports_to_employment.person.display_name
      }
    }
  end

  def compensation_json(compensation)
    return unless compensation

    {
      id: compensation.id, effective_from: compensation.effective_from, effective_to: compensation.effective_to,
      annual_salary: MoneySerializer.call(compensation.annual_salary), pay_frequency: compensation.pay_frequency
    }
  end

  def separation_json(employment)
    employment.slice(:resignation_date, :last_working_date, :separation_type, :separation_reason, :eligible_for_rehire)
  end

  def user_json(user)
    user && { id: user.id, display_name: user.person.display_name }
  end
end
