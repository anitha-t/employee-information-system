module Api
  module V1
    # POST /api/v1/passwords        request a reset email (always 202, no account enumeration)
    # PUT  /api/v1/passwords/:token set a new password and revoke all sessions
    class PasswordsController < BaseController
      allow_unauthenticated_access
      skip_after_action :verify_authorized
      rate_limit to: 5, within: 15.minutes, only: :create,
                 with: -> { render_error :too_many_requests, "rate_limited", "Too many requests. Try again later." }

      def create
        user = User.find_by(email_address: params.expect(:email_address).to_s.strip.downcase)
        PasswordsMailer.reset(user).deliver_later if user&.can_sign_in?
        head :accepted
      end

      def update
        user = User.find_by_password_reset_token(params[:token])
        return render_error(:unprocessable_content, "invalid_token", "This reset link is invalid or has expired") unless user

        User.transaction do
          user.update!(password: params.expect(:password))
          user.sign_out_everywhere!
        end
        head :no_content
      end
    end
  end
end
