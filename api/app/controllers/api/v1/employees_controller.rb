module Api
  module V1
    # HR employee list with search and filters, and one employee's detail
    # (docs/api-design.md §2.4, §4). Backed by EmployeeSnapshot.
    class EmployeesController < BaseController
      include Paginated

      def index
        authorize EmployeeSnapshot, policy_class: EmployeePolicy
        records, meta = paginate(EmployeeSearch.new(params, as_of: as_of).call)
        render json: { data: records.map { |snapshot| EmployeeSerializer.new(snapshot) }, meta: meta.merge(as_of: as_of) }
      end

      def show
        authorize EmployeeSnapshot, policy_class: EmployeePolicy # before the lookup: don't reveal which ids exist
        snapshot = EmployeeSnapshot.as_of(as_of).find(params[:id])
        render json: EmployeeSerializer.new(snapshot, employment: Employment.find(snapshot.employment_id))
      end

      private

      def as_of
        @as_of ||= params[:as_of].present? ? Date.iso8601(params[:as_of]) : Date.current
      rescue Date::Error
        raise ValidationError.for("as_of", "must be an ISO-8601 date")
      end
    end
  end
end
