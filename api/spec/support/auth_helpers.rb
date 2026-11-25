module AuthHelpers
  # Headers for a signed-in request as `user`.
  def auth_headers(user)
    _session, token = Session.start!(user: user)
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
