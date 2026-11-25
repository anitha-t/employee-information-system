module Api
  module V1
    # HR salary reports (docs/api-design.md §2.7). Each returns one entry per
    # country, in that country's currency.
    class ReportsController < BaseController
      before_action { authorize :report, :show? }

      # (a) GET /reports/salary_stats?country=&as_of=&employment_type=
      def salary_stats
        render json: Reports::SalaryStats.new(as_of: as_of, **string_params(:country, :employment_type)).call
      end

      # (b) GET /reports/salary_by_job?country=&job_title=&as_of=&employment_type=
      def salary_by_job
        render json: Reports::SalaryStats.new(as_of: as_of, by_job: true,
                                              **string_params(:country, :job_title, :employment_type)).call
      end

      # (c) GET /reports/salary_spend?country=&year=&breakdown=month
      def salary_spend
        report = Reports::SalarySpend.new(year: year, **string_params(:country)).call
        report[:data].each { |row| row.delete(:breakdown) } unless string_param(:breakdown) == "month"
        render json: report
      end

      private

      def as_of = date_param(:as_of, default: Date.current)

      def year
        year = integer_param(:year, default: Date.current.year)
        raise ValidationError.for("year", "must be a year between 2000 and 2100") unless year.between?(2000, 2100)

        year
      end
    end
  end
end
