module Api
  module V1
    # HR salary reports (docs/api-design.md §2.7). Each returns one entry per
    # country, in that country's currency.
    class ReportsController < BaseController
      before_action { authorize :report, :show? }

      # (a) GET /reports/salary_stats?country=&as_of=&employment_type=
      def salary_stats
        render json: Reports::SalaryStats.new(as_of: as_of, country: params[:country],
                                              employment_type: params[:employment_type]).call
      end

      # (b) GET /reports/salary_by_job?country=&job_title=&as_of=&employment_type=
      def salary_by_job
        render json: Reports::SalaryStats.new(as_of: as_of, country: params[:country], by_job: true,
                                              job_title: params[:job_title], employment_type: params[:employment_type]).call
      end

      # (c) GET /reports/salary_spend?country=&year=&breakdown=month
      def salary_spend
        report = Reports::SalarySpend.new(year: year, country: params[:country]).call
        report[:data].each { |row| row.delete(:breakdown) } unless params[:breakdown] == "month"
        render json: report
      end

      private

      def as_of
        params[:as_of].present? ? Date.iso8601(params[:as_of]) : Date.current
      rescue Date::Error
        raise ValidationError.for("as_of", "must be an ISO-8601 date")
      end

      def year
        return Date.current.year if params[:year].blank?

        year = Integer(params[:year], 10, exception: false)
        raise ValidationError.for("year", "must be a year between 2000 and 2100") unless year&.between?(2000, 2100)

        year
      end
    end
  end
end
