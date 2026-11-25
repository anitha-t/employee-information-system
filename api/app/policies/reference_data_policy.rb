# Reference data (countries, locations, legal entities, teams, grades, jobs,
# positions) is readable by any signed-in user (docs/api-design.md §2.6).
class ReferenceDataPolicy < ApplicationPolicy
  def index? = user.present?
end
