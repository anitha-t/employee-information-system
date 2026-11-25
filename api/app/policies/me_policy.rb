# Any signed-in user may read their own summary.
class MePolicy < ApplicationPolicy
  def show? = user.present? && record == user
end
