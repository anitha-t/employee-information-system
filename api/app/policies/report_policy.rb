# Salary reports are HR-only.
class ReportPolicy < ApplicationPolicy
  def show? = hr?
end
