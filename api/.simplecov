# Coverage configuration (SimpleCov 1.3 API). Coverage is started from
# spec/spec_helper.rb, before any application code is loaded.
SimpleCov.configure do
  enable_coverage :branch

  skip "/bin/"
  skip "/db/"
  skip "/spec/"
  skip "/vendor/"

  group "Services", "app/services"
  group "Policies", "app/policies"
  group "Serializers", "app/serializers"
  group "Validators", "app/validators"

  # Fails `rspec` when coverage drops. Raise these as the suite grows.
  coverage :line do
    minimum 95
    minimum 80, per: :file
  end
  coverage :branch, minimum: 85

  # Any legacy SimpleCov setting creeping back in fails the run.
  deprecations :raise
end
