# Deny-by-default base policy. Subclasses opt in per action.
# Roles: `hr` (global, full access) and `employee` (self-service only).
class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  %i[index? show? create? update? destroy?].each do |action|
    define_method(action) { false }
  end

  def hr?
    user&.hr? || false
  end

  class Scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NoMethodError, "You must define #resolve in #{self.class}"
    end

    private

    attr_reader :user, :scope
  end
end
