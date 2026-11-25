require "rails_helper"

RSpec.describe EmployeeSnapshot do
  it "is read-only and has no salary when there is no compensation row" do
    employment = create(:employment, person: create(:person, first_name: "Ada", last_name: "L", preferred_name: nil))
    snapshot = described_class.as_of(Date.current).find(employment.id)

    expect(snapshot).to be_readonly
    expect(snapshot.annual_salary).to be_nil
    expect(snapshot.display_name).to eq("Ada L")
  end
end
