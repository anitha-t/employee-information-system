class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    @reset_url = "#{ENV.fetch('WEB_APP_URL', 'http://localhost:5173')}/reset-password/#{user.password_reset_token}"
    mail subject: "Reset your password", to: user.email_address
  end
end
