module Api
  module V1
    # GET /api/v1/me: the signed-in user's own summary.
    class MeController < BaseController
      def show
        authorize current_user, policy_class: MePolicy
        render json: MeSerializer.new(current_user)
      end
    end
  end
end
