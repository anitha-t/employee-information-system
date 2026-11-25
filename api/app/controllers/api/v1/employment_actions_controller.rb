module Api
  module V1
    # HR-only. One API to create and correct every kind of employment change
    # (docs/api-design.md §2.5, §3.2, §3.3). Actions apply immediately.
    class EmploymentActionsController < BaseController
      include Paginated

      PERSON_FIELDS = %i[first_name last_name preferred_name email phone_number dob gender].freeze
      EMPLOYMENT_FIELDS = %i[legal_entity_id employment_type notice_period_days work_email].freeze
      ASSIGNMENT_FIELDS = %i[position_id grade_id reports_to_employment_id].freeze
      COMPENSATION_FIELDS = [ :pay_frequency, { annual_salary: %i[amount currency] } ].freeze
      SEPARATION_FIELDS = %i[resignation_date last_working_date separation_type separation_reason eligible_for_rehire].freeze
      INCLUDES = [ { created_by_user: :person }, { reviewed_by_user: :person }, { employment: :person },
                   { assignment: [ :grade, { position: %i[job team] }, { reports_to_employment: :person } ] },
                   :compensation ].freeze

      def index
        authorize EmploymentAction
        records, meta = paginate(filtered(policy_scope(EmploymentAction)))
        render json: { data: records.map { |action| EmploymentActionSerializer.new(action) }, meta: meta }
      end

      def show
        action = authorize EmploymentAction.includes(INCLUDES).find(params[:id])
        render json: EmploymentActionSerializer.new(action, include_previous: true)
      end

      def create
        authorize EmploymentAction
        result = EmploymentActions::Create.new(params: create_params, user: current_user).call
        render status: :created, json: EmploymentActionSerializer.new(result.action, warnings: result.warnings)
      end

      def update
        action = authorize EmploymentAction.find(params[:id])
        params.expect(:lock_version)
        result = EmploymentActions::Update.new(action: action, params: update_params, user: current_user).call
        render json: EmploymentActionSerializer.new(result.action, warnings: result.warnings)
      end

      private

      def create_params
        params.permit(:action_type, :employment_id, :person_id, :effective_date, :reason, :reviewed_by_user_id, :review_decision,
                      person: PERSON_FIELDS, employment: EMPLOYMENT_FIELDS, assignment: ASSIGNMENT_FIELDS,
                      compensation: COMPENSATION_FIELDS, separation: SEPARATION_FIELDS)
      end

      def update_params
        params.permit(:lock_version, :effective_date, :reason, :reviewed_by_user_id, :review_decision,
                      assignment: ASSIGNMENT_FIELDS, compensation: COMPENSATION_FIELDS, separation: SEPARATION_FIELDS)
      end

      def filtered(scope)
        scope = scope.includes(INCLUDES).order(effective_date: :desc, created_at: :desc)
        scope = scope.where(employment_id: params[:employment_id]) if params[:employment_id].present?
        scope = scope.where(action_type: params[:action_type]) if params[:action_type].present?
        scope = scope.where(created_by_user_id: params[:created_by]) if params[:created_by].present?
        scope = scope.where(reviewed_by_user_id: params[:reviewed_by]) if params[:reviewed_by].present?
        scope = scope.where(effective_date: params[:effective_from]..) if params[:effective_from].present?
        scope = scope.where(effective_date: ..params[:effective_to]) if params[:effective_to].present?
        if params[:country].present?
          scope = scope.joins(employment: { legal_entity: { location: :country } })
                       .where(countries: { iso_code: params[:country].to_s.upcase })
        end
        scope
      end
    end
  end
end
