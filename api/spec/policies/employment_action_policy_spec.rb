require "rails_helper"

RSpec.describe EmploymentActionPolicy do
  it "scopes actions to HR" do
    action = create(:employment_action)

    expect(described_class::Scope.new(action.created_by_user, EmploymentAction).resolve).to eq([ action ])
    expect(described_class::Scope.new(create(:user), EmploymentAction).resolve).to be_empty
  end
end
