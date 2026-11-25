require "rails_helper"

RSpec.describe ApplicationPolicy do
  let(:hr) { create(:user, :hr) }
  let(:employee) { create(:user) }

  it "denies every action by default" do
    policy = described_class.new(hr, Object.new)
    expect(%i[index? show? create? update? destroy?].map { |action| policy.public_send(action) }).to all(be(false))
  end

  it "knows whether the user is HR" do
    expect(described_class.new(hr, nil).hr?).to be(true)
    expect(described_class.new(employee, nil).hr?).to be(false)
    expect(described_class.new(nil, nil).hr?).to be(false)
  end

  it "requires scopes to define #resolve" do
    expect { described_class::Scope.new(hr, Person).resolve }.to raise_error(NoMethodError, /must define #resolve/)
  end
end
