# The request tried to change fields the current user may not change.
class ForbiddenAttributesError < StandardError
  attr_reader :attributes

  def initialize(attributes)
    @attributes = attributes
    super("You are not allowed to change: #{attributes.join(', ')}")
  end
end
