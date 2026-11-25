# Authentication (docs/api-design.md §1). Every action requires a valid,
# unexpired session unless the controller opts out with
# `allow_unauthenticated_access`. The session token comes from either:
#
# - `Authorization: Bearer <token>`: scripts and curl, or
# - the signed, httpOnly `session_token` cookie set at sign-in: the web app.
#   JavaScript never sees this token.
#
# CSRF: a cookie is sent by the browser automatically, so cookie-authenticated
# requests that change data must carry `X-Requested-With: XMLHttpRequest`.
# A cross-site page can't add that header without a CORS preflight, which
# only WEB_ORIGINS pass. Bearer requests need no such check.
module Authentication
  extend ActiveSupport::Concern

  COOKIE = :session_token
  CSRF_HEADER = "X-Requested-With".freeze
  CSRF_VALUE = "XMLHttpRequest".freeze

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
    if bearer_token
      Current.session = Session.find_by_token(bearer_token)
    elsif cookie_token
      Current.session = Session.find_by_token(cookie_token)
      cookies.delete(COOKIE) unless Current.session
      return render_error(:forbidden, "csrf_failed", "Missing #{CSRF_HEADER} header") if Current.session && !csrf_safe?
    end
    return if Current.session

    render_error :unauthorized, "unauthenticated", "Sign in to continue"
  end

  # Sets the session cookie for a newly started session.
  def set_session_cookie(session, token)
    cookies.signed[COOKIE] = { value: token, expires: session.expires_at, httponly: true,
                               same_site: :lax, secure: Rails.env.production? }
  end

  def delete_session_cookie
    cookies.delete(COOKIE)
  end

  def bearer_token
    request.authorization.to_s[/\ABearer (.+)\z/, 1]
  end

  def cookie_token
    cookies.signed[COOKIE]
  end

  def csrf_safe?
    request.get? || request.head? || request.headers[CSRF_HEADER] == CSRF_VALUE
  end

  def current_user
    Current.user
  end

  # Used by Pundit and paper_trail.
  def pundit_user = current_user
  def user_for_paper_trail = current_user&.id
  def info_for_paper_trail = { request_id: request.request_id, ip: request.remote_ip }
end
