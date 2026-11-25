module Reports
  # (a) Min, max, average and median annual salary per country, and
  # (b) the same per job title when grouped by job.
  #
  # Population: employments with a compensation row active on as_of (so
  # leavers after their last day and future joiners are excluded). The job
  # title is the primary assignment active on as_of.
  class SalaryStats < Base
    MIN_GROUP_SIZE = 5

    STATS = {
      headcount: "COUNT(*)",
      min: "MIN(annual_salary_cents)",
      max: "MAX(annual_salary_cents)",
      average: "AVG(annual_salary_cents)",
      median: "percentile_cont(0.5) WITHIN GROUP (ORDER BY annual_salary_cents)"
    }.freeze

    def initialize(as_of:, country: nil, by_job: false, job_title: nil, employment_type: nil)
      super(country: country)
      @as_of = as_of
      @by_job = by_job
      @job_title = job_title.presence
      @employment_type = employment_type.presence
    end

    def call
      rows = grouped_rows
      return { as_of: @as_of, data: countries.map { |country| country_row(country, rows[[ country.iso_code ]]) } } unless @by_job

      shown, hidden = rows.partition { |_key, stats| stats[:headcount] >= MIN_GROUP_SIZE }
      {
        as_of: @as_of, min_group_size: MIN_GROUP_SIZE, suppressed_groups: hidden.size,
        data: shown.sort_by { |(code, title), _| [ code, title.to_s ] }.map { |(code, title), stats| job_row(code, title, stats) }
      }
    end

    private

    def grouped_rows
      keys = @by_job ? %w[country_code job_title] : %w[country_code]
      scope.group(*keys).pluck(*keys.map { |key| Arel.sql(key) }, *STATS.values.map { |expr| Arel.sql(expr) })
           .to_h do |values|
             [ values.first(keys.size), STATS.keys.zip(values.drop(keys.size)).to_h ]
           end
    end

    def scope
      scope = EmployeeSnapshot.as_of(@as_of)
                              .where(country_code: countries.map(&:iso_code))
                              .where("compensation_effective_from <= :d AND (compensation_effective_to IS NULL OR compensation_effective_to > :d)", d: @as_of)
      scope = scope.where(employment_type: @employment_type) if @employment_type
      return scope unless @by_job

      scope = scope.where("assignment_effective_from <= :d AND (assignment_effective_to IS NULL OR assignment_effective_to > :d)", d: @as_of)
      @job_title ? scope.where("lower(job_title) = ?", @job_title.downcase) : scope
    end

    def country_row(country, stats)
      { country: country.iso_code, currency: country.currency }.merge(stats_json(stats || { headcount: 0 }, country.currency))
    end

    def job_row(code, title, stats)
      currency = countries.find { |country| country.iso_code == code }.currency
      { country: code, currency: currency, job_title: title }.merge(stats_json(stats, currency))
    end

    def stats_json(stats, currency)
      { headcount: stats[:headcount] }.merge(%i[min max average median].index_with { |key| money(stats[key], currency) })
    end
  end
end
