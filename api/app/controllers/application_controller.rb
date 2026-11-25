class ApplicationController < ActionController::API
  include ActionController::Cookies
  include Pundit::Authorization
  include ApiErrorHandling
  include Authentication

  # Payloads are flat / explicitly nested as documented in docs/api-design.md;
  # don't auto-wrap JSON bodies under a controller-named key.
  wrap_parameters false
end
