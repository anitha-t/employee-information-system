# Salary bands reveal pay ranges, so even reading them is HR-only.
class SalaryBandPolicy < ApplicationPolicy
  def index? = hr?
end
