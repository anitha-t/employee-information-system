# The React app (web/) calls this API from a different origin using bearer tokens.
# Set WEB_ORIGINS to a comma-separated list in non-development environments.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV.fetch("WEB_ORIGINS", "http://localhost:5173").split(",").map(&:strip))

    resource "/api/*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: %w[Authorization]
  end
end
