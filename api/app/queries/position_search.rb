# Positions open on a date, with filters (GET /api/v1/positions).
#
# Filled head count = primary assignments active on `as_of`, computed in SQL
# as a correlated subquery so `vacant` can filter on it before pagination.
class PositionSearch
  def initialize(as_of:, legal_entity_id: nil, team_id: nil, job_id: nil, country: nil, q: nil, vacant: false)
    @as_of = as_of
    @filters = { legal_entity_id: legal_entity_id, team_id: team_id, job_id: job_id }.compact
    @country = country
    @q = q
    @vacant = vacant
  end

  def call
    scope = Position.active_on(@as_of).where(@filters).order(:code)
    scope = scope.where(legal_entity_id: entities_in_country) if @country
    scope = scope.where("positions.code ILIKE :q OR positions.name ILIKE :q", q: "%#{Position.sanitize_sql_like(@q)}%") if @q
    scope = scope.where(Position.arel_table[:required_head_count].gt(filled_count)) if @vacant
    scope
  end

  # Adds `filled_count` to each loaded record and preloads what the serializer shows.
  def with_head_counts(records)
    records.select(Position.arel_table[Arel.star], filled_count.as("filled_count"))
           .preload(:job, :team, :location, legal_entity: { location: :country })
  end

  private

  def filled_count
    Assignment.primary.active_on(@as_of)
              .where(Assignment.arel_table[:position_id].eq(Position.arel_table[:id]))
              .select(Arel.star.count).arel
  end

  def entities_in_country
    LegalEntity.joins(:location).where(locations: { country_id: @country.id }).select(:id)
  end
end
