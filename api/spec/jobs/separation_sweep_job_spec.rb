require "rails_helper"

RSpec.describe SeparationSweepJob do
  it "separates people whose last working day has passed and signs them out" do
    leaver = create(:employment, status: "on_notice", last_working_date: Date.new(2026, 5, 31))
    staying = create(:employment, status: "on_notice", last_working_date: Date.new(2026, 6, 1))
    user = create(:user, person: leaver.person)
    Session.start!(user: user)

    described_class.perform_now(today: Date.new(2026, 6, 1))

    expect([ leaver.reload.status, staying.reload.status ]).to eq(%w[separated on_notice])
    expect(user.sessions).to be_empty
  end
end
