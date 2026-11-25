module Api
  module V1
    # Shared filters for the read-only reference-data lists
    # (docs/api-design.md §2.6). Lists return {data}; positions also paginate.
    class ReferenceDataController < BaseController
      private

      # Inactive records are hidden unless ?include_inactive=true.
      def only_active(scope)
        boolean_param(:include_inactive) ? scope : scope.active
      end

      # The Country for ?country=IN, nil when absent. Unknown codes are a 422.
      def country
        code = string_param(:country)
        return unless code

        @country ||= Country.find_by(iso_code: code.upcase) || raise(ValidationError.for("country", "is not a known country code"))
      end

      def render_list(records, serializer)
        render json: { data: records.map { |record| serializer.new(record).as_json } }
      end
    end
  end
end
