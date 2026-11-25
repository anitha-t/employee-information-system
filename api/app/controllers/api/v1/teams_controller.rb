module Api
  module V1
    # GET /api/v1/teams?tree=&include_inactive=
    # Flat by default (each team has parent_id). With tree=true, top-level
    # teams with nested `children`.
    class TeamsController < ReferenceDataController
      def index
        authorize Team, policy_class: ReferenceDataPolicy
        teams = only_active(Team.order(:name)).to_a
        return render_list(teams, TeamSerializer) unless boolean_param(:tree)

        children = teams.group_by(&:parent_id)
        ids = teams.to_set(&:id)
        # A team whose parent is filtered out (inactive) becomes a root.
        roots = teams.reject { |team| ids.include?(team.parent_id) }
        render json: { data: roots.map { |team| TeamSerializer.new(team, children: children).as_json } }
      end
    end
  end
end
