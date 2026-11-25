# A position loaded by PositionSearch#with_head_counts (which adds filled_count).
class PositionSerializer
  def initialize(position)
    @position = position
  end

  def as_json(*)
    p = @position
    filled = p.read_attribute(:filled_count).to_i
    p.slice(:id, :code, :name, :is_remote, :effective_from, :effective_to, :required_head_count).merge(
      filled_head_count: filled,
      vacancies: [ p.required_head_count - filled, 0 ].max,
      job: p.job.slice(:id, :code, :title),
      team: p.team.slice(:id, :name),
      legal_entity: p.legal_entity.slice(:id, :name),
      country: p.legal_entity.country.slice(:id, :iso_code, :currency),
      location: p.location&.slice(:id, :city, :state)
    )
  end
end
