# The HR employee list and employee detail (salaries included) are HR-only.
class EmployeePolicy < ApplicationPolicy
  def index? = hr?
  def show? = hr?
end
