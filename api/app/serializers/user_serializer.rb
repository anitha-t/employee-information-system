class UserSerializer
  def initialize(user)
    @user = user
  end

  def as_json(*)
    { id: @user.id, email_address: @user.email_address, role: @user.role }
  end
end
