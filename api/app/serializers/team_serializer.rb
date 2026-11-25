# A team. Given `children` ({ parent_id => [Team] }), it nests sub-teams.
class TeamSerializer
  def initialize(team, children: nil)
    @team = team
    @children = children
  end

  def as_json(*)
    json = @team.slice(:id, :name, :parent_id, :is_active)
    return json unless @children

    json.merge(children: @children.fetch(@team.id, []).map { |child| self.class.new(child, children: @children).as_json })
  end
end
