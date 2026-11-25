require "rails_helper"

RSpec.describe User do
  it "authenticates with a password of at least 12 characters" do
    expect(build(:user, password: "short")).not_to be_valid
    user = create(:user, password: "correct-horse-battery")
    expect(user.authenticate("correct-horse-battery")).to eq(user)
  end

  it "only allows hr and employee roles" do
    expect(build(:user, role: "admin")).not_to be_valid
    expect(build(:user, :hr)).to be_hr
  end

  it "does not store the password digest in the audit trail" do
    user = create(:user)
    expect(user.versions.last.object_changes).not_to have_key("password_digest")
  end
end
