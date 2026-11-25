module Api
  module V1
    class BaseController < ApplicationController
      include QueryParams

      # Fail loudly if an action forgets to call `authorize` / `policy_scope`.
      after_action :verify_authorized
    end
  end
end
