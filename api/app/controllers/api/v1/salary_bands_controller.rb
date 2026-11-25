module Api
  module V1
    # GET /api/v1/salary_bands?country=&grade_id=&as_of=  (HR only)
    # Bands in effect on `as_of` (default today), by country then grade rank.
    class SalaryBandsController < ReferenceDataController
      def index
        authorize SalaryBand
        scope = SalaryBand.active_on(date_param(:as_of, default: Date.current))
                          .joins(:country, :grade).preload(:country, :grade)
                          .order(Country.arel_table[:iso_code], Grade.arel_table[:rank])
        scope = scope.where(country: country) if country
        scope = scope.where(grade_id: string_param(:grade_id)) if string_param(:grade_id)
        render_list scope, SalaryBandSerializer
      end
    end
  end
end
