# Read-only row from employee_snapshots_on(as_of): an employment with its
# person, country, and the primary assignment / compensation on that date.
# Always query through .as_of(date) so the date comes from Rails.
class EmployeeSnapshot < ApplicationRecord
  self.primary_key = :employment_id
  self.implicit_order_column = :full_name

  belongs_to :employment
  belongs_to :person

  def self.as_of(date)
    from(sanitize_sql_array([ "employee_snapshots_on(?) AS employee_snapshots", date ]))
  end

  def readonly? = true

  def display_name = preferred_name.presence || full_name

  def annual_salary
    Money.new(annual_salary_cents, currency) if annual_salary_cents
  end
end
