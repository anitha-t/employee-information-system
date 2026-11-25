Rails.application.routes.draw do
  # Load balancer / uptime health check.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resource :session, only: %i[create destroy]
      resources :passwords, only: %i[create update], param: :token
      get "me", to: "me#show"
    end
  end
end
