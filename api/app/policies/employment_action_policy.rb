# Employment actions are HR-only. Employees see their own history through
# /me endpoints instead.
class EmploymentActionPolicy < ApplicationPolicy
  def index? = hr?
  def show? = hr?
  def create? = hr?
  def update? = hr?

  class Scope < ApplicationPolicy::Scope
    def resolve
      user&.hr? ? scope.all : scope.none
    end
  end
end
