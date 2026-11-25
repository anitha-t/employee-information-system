module Api
  module V1
    # GET /api/v1/jobs?country=&q=&include_inactive=
    # `country` keeps jobs available there; `q` matches title or code.
    class JobsController < ReferenceDataController
      def index
        authorize Job, policy_class: ReferenceDataPolicy
        scope = only_active(Job.preload(:min_grade, :max_grade, :countries).order(:title))
        scope = scope.where(id: JobCountry.where(country: country).select(:job_id)) if country
        if (q = string_param(:q))
          scope = scope.where("jobs.title ILIKE :q OR jobs.code ILIKE :q", q: "%#{Job.sanitize_sql_like(q)}%")
        end
        render_list scope, JobSerializer
      end
    end
  end
end
