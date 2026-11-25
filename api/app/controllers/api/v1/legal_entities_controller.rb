module Api
  module V1
    # GET /api/v1/legal_entities?country=&include_inactive=
    # Each entity carries its country and currency, and its registered addresses.
    class LegalEntitiesController < ReferenceDataController
      def index
        authorize LegalEntity, policy_class: ReferenceDataPolicy
        scope = only_active(LegalEntity.includes({ location: :country }, { addresses: :country }).order(:name))
        scope = scope.where(location_id: Location.where(country: country).select(:id)) if country
        render_list scope, LegalEntitySerializer
      end
    end
  end
end
