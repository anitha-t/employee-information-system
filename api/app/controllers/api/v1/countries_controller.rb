module Api
  module V1
    # GET /api/v1/countries: the seeded countries, by name.
    class CountriesController < ReferenceDataController
      def index
        authorize Country, policy_class: ReferenceDataPolicy
        render_list Country.order(:name), CountrySerializer
      end
    end
  end
end
