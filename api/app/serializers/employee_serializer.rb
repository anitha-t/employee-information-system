# One employee from EmployeeSnapshot. With `employment:` it also includes
# the employment details shown on the employee page.
class EmployeeSerializer
  def initialize(snapshot, employment: nil)
    @snapshot = snapshot
    @employment = employment
  end

  def as_json(*)
    s = @snapshot
    json = {
      employment_id: s.employment_id,
      employee_number: s.employee_number,
      status: s.status,
      employment_type: s.employment_type,
      hire_date: s.hire_date,
      last_working_date: s.last_working_date,
      work_email: s.work_email,
      person: { id: s.person_id, full_name: s.full_name, display_name: s.display_name, email: s.person_email },
      legal_entity: { id: s.legal_entity_id, name: s.legal_entity_name },
      country: { id: s.country_id, iso_code: s.country_code, currency: s.currency },
      position: s.position_id && { id: s.position_id, name: s.position_name },
      job: s.job_id && { id: s.job_id, title: s.job_title, level: s.job_level },
      team: s.team_id && { id: s.team_id, name: s.team_name },
      grade: s.grade_id && { id: s.grade_id, code: s.grade_code },
      manager: s.manager_employment_id && { employment_id: s.manager_employment_id, display_name: s.manager_name },
      annual_salary: MoneySerializer.call(s.annual_salary),
      pay_frequency: s.pay_frequency
    }
    json[:employment] = employment_json if @employment
    json
  end

  private

  def employment_json
    @employment.slice(:lock_version, :notice_period_days, :resignation_date, :separation_type, :separation_reason, :eligible_for_rehire)
               .merge(assignment_effective_from: @snapshot.assignment_effective_from,
                      compensation_effective_from: @snapshot.compensation_effective_from)
  end
end
