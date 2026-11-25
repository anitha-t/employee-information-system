# GET /api/v1/employees: filters + Postgres full-text search over
# employee_snapshots_on(as_of) (docs/api-design.md §4).
#
# q matches, in one query:
# - names / personal email through the people.search_vector (prefix match),
# - full_name by trigram similarity (typos, partial names),
# - employee_number or work_email by prefix.
# With q, results are ranked by relevance, then name.
class EmployeeSearch
  FILTERS = %i[legal_entity_id team_id job_id grade_id employment_type].freeze
  DEFAULT_STATUSES = %w[active on_notice].freeze
  SIMILARITY_THRESHOLD = 0.2

  def initialize(params, as_of: Date.current)
    @params = params
    @as_of = as_of
  end

  def call
    scope = EmployeeSnapshot.as_of(@as_of)
    scope = apply_filters(scope)
    query.present? ? search(scope) : scope.order(:full_name, :employee_number)
  end

  private

  def query = @params[:q].to_s.strip

  def apply_filters(scope)
    FILTERS.each { |key| scope = scope.where(key => @params[key]) if @params[key].present? }
    scope = scope.where(country_code: @params[:country].to_s.upcase) if @params[:country].present?
    scope.where(status: statuses)
  end

  # status=separated, status=active,on_notice, or status=all. Default hides leavers.
  def statuses
    requested = @params[:status].to_s.split(",").map(&:strip)
    return Employment::STATUSES if requested == [ "all" ]

    requested.presence || DEFAULT_STATUSES
  end

  def search(scope)
    tsquery = prefix_tsquery
    prefix = "#{EmployeeSnapshot.sanitize_sql_like(query.downcase)}%"
    text_match = tsquery ? "search_vector @@ to_tsquery('simple', :tsquery)" : "false"
    rank = tsquery ? "ts_rank(search_vector, to_tsquery('simple', :tsquery))" : "0"
    binds = { tsquery: tsquery, q: query, prefix: prefix, threshold: SIMILARITY_THRESHOLD }

    scope.where(<<~SQL.squish, binds)
      #{text_match}
      OR similarity(full_name, :q) >= :threshold
      OR lower(employee_number) LIKE :prefix
      OR lower(work_email) LIKE :prefix
    SQL
         .order(Arel.sql(EmployeeSnapshot.sanitize_sql_array([ "#{rank} + similarity(full_name, :q) DESC", binds ])))
         .order(:full_name, :employee_number)
  end

  # "priya sha" -> "priya:* & sha:*". Only letters/digits survive, so user
  # input can't inject tsquery operators.
  def prefix_tsquery
    terms = query.downcase.scan(/[[:alnum:]]+/)
    terms.map { |term| "#{term}:*" }.join(" & ").presence
  end
end
