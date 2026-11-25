module EmploymentActions
  # Non-blocking check: is the salary inside the band for the grade and
  # country on its effective date? Returns warning strings.
  module SalaryBandCheck
    def self.warnings_for(compensation)
      return [] unless compensation

      employment = compensation.employment
      grade = employment.current_assignment(on: compensation.effective_from)&.grade
      band = grade && SalaryBand.active_on(compensation.effective_from).find_by(grade: grade, country: employment.country)
      return [] if band.nil? || band.covers?(compensation.annual_salary)

      [ "annual_salary #{MoneySerializer.call(compensation.annual_salary)[:amount]} is outside the #{grade.code} " \
        "band for #{employment.country.iso_code} (#{band.min.to_d.to_s('F')}–#{band.max.to_d.to_s('F')} #{band.currency})" ]
    end
  end
end
