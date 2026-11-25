require "rails_helper"
require Rails.root.join("db/seeds/reference_data").to_s
require Rails.root.join("db/seeds/dev_accounts").to_s

RSpec.describe Seeds::DevAccounts do
  subject(:seed) { described_class.new(logger: nil) }

  let(:hr_email) { "hr@employee-information-system.local" }
  let(:employee_email) { "employee@employee-information-system.local" }

  before do
    travel_to(Date.new(2026, 11, 25))
    %w[IN US AU].each { |code| create(:country, iso_code: code) }
    Seeds::ReferenceData.new(logger: nil).call
  end

  after { travel_back }

  def person_for(email) = User.find_by!(email_address: email).person

  it "creates the HR login as Ananya Iyer with salary history" do
    seed.ensure_employments!

    user = User.find_by!(email_address: hr_email)
    expect(user).to have_attributes(role: "hr", person: have_attributes(full_name: "Ananya Iyer", dob: Date.new(1987, 9, 14)))
    expect(user.authenticate("dev-password-123")).to be_truthy
    expect(user.person.employments.sole.employment_actions.order(:effective_date).pluck(:action_type))
      .to eq(%w[hire salary_change salary_change])
  end

  it "creates the employee login as Priya Sharma, promoted, with a salary history" do
    seed.ensure_employments!

    employment = person_for(employee_email).employments.sole
    expect(employment).to have_attributes(status: "active", hire_date: Date.new(2023, 4, 3), work_email: "priya.sharma@acme.example")
    expect(employment.current_assignment.grade.code).to eq("G3")
    expect(employment.compensations.order(:effective_from).map { |c| c.annual_salary.cents / 100 }).to eq([ 1_200_000, 1_296_000, 1_500_000 ])
  end

  it "gives both logins addresses and a primary emergency contact" do
    seed.ensure_employments!

    priya = person_for(employee_email)
    expect(priya.addresses.pluck(:address_type)).to contain_exactly("home", "mailing")
    expect(priya.emergency_contacts.find_by(is_primary: true).name).to eq("Ravi Sharma")
    expect(person_for(hr_email).emergency_contacts.count).to eq(2)
  end

  it "keeps every record valid and audited as the HR login" do
    seed.ensure_employments!

    people = Person.includes(:addresses, :emergency_contacts, employments: %i[assignments compensations employment_actions])
    records = people.flat_map { |p| [ p ] + p.addresses + p.emergency_contacts + p.employments.flat_map { |e| [ e ] + e.assignments + e.compensations + e.employment_actions } }
    expect(records.reject(&:valid?)).to eq([])
    expect(PaperTrail::Version.where(item_type: "EmploymentAction").pluck(:whodunnit).uniq).to eq([ User.find_by!(role: "hr").id ])
  end

  it "reports to a current Engineering Manager when the bulk seed made one" do
    manager = create(:employment, hire_date: Date.new(2020, 1, 6), legal_entity: LegalEntity.find_by!(name: "Acme India Pvt Ltd"))
    action = EmploymentAction.create!(employment: manager, action_type: "hire", effective_date: manager.hire_date,
                                      created_by_user: create(:user, :hr))
    Assignment.create!(employment: manager, employment_action: action, position: Position.find_by!(code: "IN-EM-PLATFORM"),
                       grade: Grade.find_by!(code: "G5"), is_primary: true, effective_from: manager.hire_date)

    seed.ensure_employments!

    expect(person_for(employee_email).employments.sole.current_assignment.reports_to_employment).to eq(manager)
  end

  it "is idempotent" do
    seed.ensure_employments!

    expect { described_class.new(logger: nil).ensure_employments! }
      .not_to change { [ Person, User, Employment, EmploymentAction, Assignment, Compensation, Address, EmergencyContact ].map(&:count) }
  end

  it "re-links logins that older seeds attached to other people, and removes the unused old HR person" do
    old_hr = create(:person, first_name: "HR", last_name: "Admin", email: "hr.admin@example.com")
    create(:user, :hr, email_address: hr_email, person: old_hr)
    someone = create(:person)
    create(:user, email_address: employee_email, person: someone)

    seed.ensure_users!

    expect(person_for(hr_email).full_name).to eq("Ananya Iyer")
    expect(person_for(employee_email).full_name).to eq("Priya Sharma")
    expect(Person.exists?(old_hr.id)).to be(false)
    expect(Person.exists?(someone.id)).to be(true)
  end

  it "logs the logins" do
    output = StringIO.new
    described_class.new(logger: output).ensure_employments!

    expect(output.string).to include("Hired Ananya Iyer as E", "Dev login: #{employee_email} / dev-password-123 (employee)")
  end
end
