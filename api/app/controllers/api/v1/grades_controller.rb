module Api
  module V1
    # GET /api/v1/grades?include_inactive=  (lowest rank first)
    class GradesController < ReferenceDataController
      def index
        authorize Grade, policy_class: ReferenceDataPolicy
        render_list only_active(Grade.ordered), GradeSerializer
      end
    end
  end
end
