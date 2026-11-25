# Bearer-token authentication (docs/api-design.md §1). Every action requires
# a valid, unexpired session token unless the controller opts out with
# `allow_unauthenticated_access`.
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
    # paper_trail does not set whodunnit on its own; it must run after
    # authentication so the audit trail records who made each change.
    before_action :set_paper_trail_whodunnit
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def require_authentication
    Current.session = Session.find_by_token(bearer_token)
    return if Current.session

    render_error :unauthorized, "unauthenticated", "A valid bearer token is required"
  end

  def bearer_token
    request.authorization.to_s[/\ABearer (.+)\z/, 1]
  end

  def current_user
    Current.user
  end

  # Used by Pundit and paper_trail.
  def pundit_user = current_user
  def user_for_paper_trail = current_user&.id
  def info_for_paper_trail = { request_id: request.request_id, ip: request.remote_ip }
end
