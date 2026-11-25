# Loaded automatically by `require "simplecov"` (top of spec/spec_helper.rb).
SimpleCov.start "rails" do
  enable_coverage :branch

  add_filter "/bin/"
  add_filter "/db/"
  add_filter "/spec/"
  add_filter "/vendor/"
  # Empty Rails base classes; remove these once real jobs / mailers exist.
  add_filter "app/jobs/application_job.rb"
  add_filter "app/mailers/application_mailer.rb"

  add_group "Services", "app/services"
  add_group "Policies", "app/policies"
  add_group "Validators", "app/validators"

  # Fails `rspec` when coverage drops. Raise these as the suite grows.
  minimum_coverage line: 95, branch: 85
  coverage(:line) { minimum 80, per: :file }
end
