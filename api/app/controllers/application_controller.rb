class ApplicationController < ActionController::API
  include Pundit::Authorization
  include ApiErrorHandling
end
