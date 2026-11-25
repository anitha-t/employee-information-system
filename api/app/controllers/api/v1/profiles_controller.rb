module Api
  module V1
    # GET/PATCH /api/v1/me/profile              the signed-in person's profile
    # GET/PATCH /api/v1/people/:person_id/profile any person's profile (HR)
    #
    # One endpoint edits contact fields plus nested addresses and emergency
    # contacts: items without id are created, with id updated, and with
    # "_destroy": true removed (docs/api-design.md §3.1).
    class ProfilesController < BaseController
      ADDRESS_FIELDS = %i[id address_type line1 line2 city state postal_code country_id _destroy].freeze
      CONTACT_FIELDS = %i[id name relationship phone_number is_primary _destroy].freeze
      NESTED = { "addresses" => ADDRESS_FIELDS, "emergency_contacts" => CONTACT_FIELDS }.freeze
      NON_ATTRIBUTE_PARAMS = %w[controller action format person_id lock_version].freeze

      before_action :set_person

      def show
        authorize @person, policy_class: ProfilePolicy
        render json: ProfileSerializer.new(@person)
      end

      def update
        authorize @person, policy_class: ProfilePolicy
        lock_version = params.expect(:lock_version)
        Profiles::Update.new(person: @person, attributes: profile_attributes, lock_version: lock_version).call
        render json: ProfileSerializer.new(load_person(@person.id))
      end

      private

      def set_person
        @person = load_person(params[:person_id] || current_user.person_id)
      end

      def load_person(id)
        Person.includes(:emergency_contacts, addresses: :country).find(id)
      end

      def profile_attributes
        allowed = ProfilePolicy.new(current_user, @person).permitted_attributes
        submitted = params.keys - NON_ATTRIBUTE_PARAMS
        forbidden = submitted - allowed
        raise ForbiddenAttributesError, forbidden if forbidden.any?

        scalars = allowed - NESTED.keys
        params.permit(*scalars, **NESTED.slice(*allowed))
              .to_h
              .transform_keys { |key| NESTED.key?(key) ? "#{key}_attributes" : key }
      end
    end
  end
end
