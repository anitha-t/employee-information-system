# Renders every error in the shape documented in docs/api-design.md:
#   {"error": {"code": "...", "message": "...", "details": {"field.path": ["msg"]}}}
module ApiErrorHandling
  extend ActiveSupport::Concern

  included do
    rescue_from ActiveRecord::RecordNotFound do |e|
      render_error :not_found, "not_found", "#{e.model || 'Record'} not found"
    end

    rescue_from ActiveRecord::RecordInvalid do |e|
      render_error :unprocessable_entity, "validation_failed", "Validation failed",
                   details: e.record.errors.to_hash(false)
    end

    rescue_from ActiveRecord::StaleObjectError do
      render_error :conflict, "stale_object",
                   "This record was changed by someone else. Reload and try again."
    end

    rescue_from ActionController::ParameterMissing do |e|
      render_error :bad_request, "bad_request", e.message
    end

    rescue_from Pundit::NotAuthorizedError do
      render_error :forbidden, "forbidden", "You are not allowed to perform this action"
    end
  end

  private

  def render_error(status, code, message, details: {})
    render status: status, json: { error: { code: code, message: message, details: details } }
  end
end
