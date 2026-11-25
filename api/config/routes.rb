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

      resources :employment_actions, only: %i[index show create update]
      resources :employees, only: %i[index show]

      scope :reports, controller: :reports, as: :reports do
        get :salary_stats
        get :salary_by_job
        get :salary_spend
      end
    end
  end
end
