module Api
  module V1
    # GET /api/v1/positions?legal_entity_id=&team_id=&job_id=&country=&q=&vacant=&as_of=&page=&per_page=
    # Positions open on `as_of` (default today), with filled head count and
    # vacancies. Paginated.
    class PositionsController < ReferenceDataController
      include Paginated

      def index
        authorize Position, policy_class: ReferenceDataPolicy
        search = PositionSearch.new(**string_params(:legal_entity_id, :team_id, :job_id, :q),
                                    country: country, vacant: boolean_param(:vacant), as_of: as_of)
        records, meta = paginate(search.call)
        render json: { data: search.with_head_counts(records).map { |position| PositionSerializer.new(position) },
                       meta: meta.merge(as_of: as_of) }
      end

      private

      def as_of
        @as_of ||= date_param(:as_of, default: Date.current)
      end
    end
  end
end
