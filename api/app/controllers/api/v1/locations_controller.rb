module Api
  module V1
    # GET /api/v1/locations?country=&include_inactive=
    class LocationsController < ReferenceDataController
      def index
        authorize Location, policy_class: ReferenceDataPolicy
        scope = only_active(Location.includes(:country).order(:city))
        scope = scope.where(country: country) if country
        render_list scope, LocationSerializer
      end
    end
  end
end
