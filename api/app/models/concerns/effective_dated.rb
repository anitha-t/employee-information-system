# Half-open effective-dated rows: [effective_from, effective_to), where
# effective_to = nil means open-ended. See docs/domain-model.md.
module EffectiveDated
  extend ActiveSupport::Concern

  included do
    scope :active_on, lambda { |date|
      where(arel_table[:effective_from].lteq(date))
        .where(arel_table[:effective_to].eq(nil).or(arel_table[:effective_to].gt(date)))
    }
    scope :current, -> { active_on(Date.current) }
    scope :open_ended, -> { where(effective_to: nil) }

    validates :effective_from, presence: true
    validate :effective_to_after_effective_from
  end

  def active_on?(date)
    effective_from <= date && (effective_to.nil? || effective_to > date)
  end

  private

  def effective_to_after_effective_from
    return if effective_from.blank? || effective_to.blank?

    errors.add(:effective_to, "must be after effective_from") unless effective_to > effective_from
  end
end
