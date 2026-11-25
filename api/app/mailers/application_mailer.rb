class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "no-reply@employee-information-system.local")
  layout "mailer"
end
