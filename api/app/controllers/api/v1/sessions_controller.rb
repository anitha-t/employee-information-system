module Api
  module V1
    # POST /api/v1/session   sign in, returns a bearer token
    # DELETE /api/v1/session sign out (revokes the current token)
    class SessionsController < BaseController
      allow_unauthenticated_access only: :create
      skip_after_action :verify_authorized
      rate_limit to: 10, within: 3.minutes, only: :create,
                 with: -> { render_error :too_many_requests, "rate_limited", "Too many sign-in attempts. Try again later." }

      def create
        user = User.authenticate_by(email_address: params.expect(:email_address), password: params.expect(:password))

        if user&.can_sign_in?
          session, token = Session.start!(user: user, ip_address: request.remote_ip, user_agent: request.user_agent)
          render status: :created, json: { token: token, expires_at: session.expires_at, user: UserSerializer.new(user) }
        else
          render_error :unauthorized, "invalid_credentials", "Email or password is incorrect"
        end
      end

      def destroy
        Current.session.destroy!
        head :no_content
      end
    end
  end
end
