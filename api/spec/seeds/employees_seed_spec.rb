require "rails_helper"
require Rails.root.join("db/seeds/employees").to_s

RSpec.describe Seeds::Employees do
  subject(:seed) { described_class.new(count: 60, seed: 7, created_by: hr, logger: nil) }

  let(:hr) { create(:user, :hr) }

  before { %w[IN US AU].each { |code| create(:country, iso_code: code) } }

  it "creates employees with valid, consistent history" do
    seed.call

    employments = Employment.includes(:person, :assignments, :compensations, :employment_actions).to_a
    records = employments.flat_map { |e| [ e, e.person ] + e.assignments + e.compensations + e.employment_actions }
    expect(employments.size).to eq(60)
    expect(records.reject(&:valid?).map { |r| [ r.class.name, r.errors.full_messages ] }).to eq([])
    expect(employments.map(&:employee_number).min).to eq("E000001")
  end

  it "builds full names from the name files" do
    seed.call

    first_names = File.readlines(Rails.root.join("db/seeds/first_names.txt"), chomp: true)
    last_names = File.readlines(Rails.root.join("db/seeds/last_names.txt"), chomp: true)
    expect(Person.where.not(id: hr.person_id).map { |p| [ p.first_name, p.last_name ] })
      .to all(satisfy { |first, last| first_names.include?(first) && last_names.include?(last) })
  end

  it "skips when employees already exist" do
    seed.call

    expect { described_class.new(count: 60, seed: 7, created_by: hr, logger: nil).call }.not_to change(Employment, :count)
  end

  it "generates the same people for the same seed" do
    people = Array.new(2) do
      generator = described_class.new(count: 20, seed: 7, created_by: hr, logger: nil)
      generator.send(:build_org)
      20.times { |index| generator.send(:build_employee, index) }
      generator.instance_variable_get(:@rows)[:people].map { |row| row.values_at(:first_name, :last_name, :dob, :email) }
    end

    expect(people.first).to eq(people.last)
  end
end
