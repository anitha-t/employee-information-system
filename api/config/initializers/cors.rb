# Lets the React app (web/) call the API from another origin with its session
# cookie. In development Vite proxies /api, so the browser sees one origin.
# Set WEB_ORIGINS to a comma-separated list in non-development environments.
# Cross-site deployments also need the cookie's SameSite changed; prefer the
# same site (e.g. app.example.com + api.example.com).
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV.fetch("WEB_ORIGINS", "http://localhost:5173").split(",").map(&:strip))

    resource "/api/*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      credentials: true
  end
end
