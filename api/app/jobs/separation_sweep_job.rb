# Daily: employments whose last working day has passed move from on_notice
# to separated, and the person is signed out everywhere.
class SeparationSweepJob < ApplicationJob
  queue_as :default

  def perform(today: Date.current)
    Employment.on_notice.where(last_working_date: ...today).includes(person: :user).find_each do |employment|
      employment.update!(status: "separated")
      employment.person.user&.sign_out_everywhere!
    end
  end
end
