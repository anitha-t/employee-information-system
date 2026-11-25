Rails.application.routes.draw do
  # Load balancer / uptime health check.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resource :session, only: %i[create destroy]
      resources :passwords, only: %i[create update], param: :token
      get "me", to: "me#show"
      get "me/profile", to: "profiles#show"
      patch "me/profile", to: "profiles#update"
      get "people/:person_id/profile", to: "profiles#show", as: :person_profile
      patch "people/:person_id/profile", to: "profiles#update"
    end
  end
end
