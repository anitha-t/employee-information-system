module Reports
  # (c) Total salary spend per country in a calendar year.
  #
  # Each compensation row contributes annual_salary / days_in_year for every
  # day it was in effect within the year, ending at the employee's last
  # working day. For the current year, spend is counted up to and including
  # today (partial: true). The yearly total is the sum of the monthly
  # amounts, so the breakdown always adds up.
  class SalarySpend < Base
    def initialize(year:, country: nil, today: Date.current)
      super(country: country)
      @year = year
      @today = today
    end

    def call
      year_start = Date.new(@year, 1, 1)
      next_year = Date.new(@year + 1, 1, 1)
      period_end = [ next_year, @today + 1 ].min # exclusive
      months = period_end > year_start ? monthly_spend(year_start, period_end, (next_year - year_start).to_i) : {}
      employees = period_end > year_start ? employee_counts(year_start, period_end) : {}

      {
        year: @year, from: year_start, to: (period_end - 1 if period_end > year_start), partial: period_end < next_year,
        data: countries.map { |country| country_row(country, months.fetch(country.iso_code, []), employees.fetch(country.iso_code, 0)) }
      }
    end

    private

    # Compensation rows clipped to [:from, :to) and to the last working day.
    # A constant template: every value is bound through sanitize_sql_array.
    PERIODS_SQL = <<~SQL.freeze
      SELECT co.iso_code AS country_code, comp.employment_id, comp.annual_salary_cents,
             GREATEST(comp.effective_from, :from) AS starts,
             LEAST(COALESCE(comp.effective_to, 'infinity'::date), :to, e.last_working_date + 1) AS ends
      FROM compensations comp
      JOIN employments e ON e.id = comp.employment_id
      JOIN legal_entities le ON le.id = e.legal_entity_id
      JOIN locations l ON l.id = le.location_id
      JOIN countries co ON co.id = l.country_id
      WHERE comp.effective_from < :to
        AND COALESCE(comp.effective_to, 'infinity'::date) > :from
        AND co.iso_code IN (:codes)
    SQL

    MONTHLY_SQL = <<~SQL.freeze
      WITH periods AS (#{PERIODS_SQL}),
      months AS (
        SELECT m::date AS month_start, (m + interval '1 month')::date AS month_end
        FROM generate_series(:from::date, :last_month::date, interval '1 month') AS m
      )
      SELECT country_code, to_char(month_start, 'YYYY-MM'),
             ROUND(SUM(annual_salary_cents * (LEAST(ends, month_end) - GREATEST(starts, month_start))::numeric / :days))
      FROM periods JOIN months ON starts < month_end AND ends > month_start
      WHERE ends > starts
      GROUP BY 1, 2
      ORDER BY 1, 2
    SQL

    EMPLOYEES_SQL = <<~SQL.freeze
      SELECT country_code, COUNT(DISTINCT employment_id) FROM (#{PERIODS_SQL}) periods
      WHERE ends > starts GROUP BY 1
    SQL

    def binds(from, to)
      { from: from, to: to, codes: countries.map(&:iso_code) }
    end

    def monthly_spend(from, to, days_in_year)
      query = sql(MONTHLY_SQL, binds(from, to).merge(last_month: (to - 1).beginning_of_month, days: days_in_year))
      rows = ActiveRecord::Base.connection.select_rows(query)
      rows.group_by(&:first).transform_values { |list| list.map { |_code, month, cents| [ month, cents.to_i ] } }
    end

    def employee_counts(from, to)
      ActiveRecord::Base.connection.select_rows(sql(EMPLOYEES_SQL, binds(from, to))).to_h { |code, count| [ code, count.to_i ] }
    end

    def country_row(country, months, employee_count)
      {
        country: country.iso_code, currency: country.currency, employee_count: employee_count,
        total_spend: money(months.sum { |_month, cents| cents }, country.currency),
        breakdown: months.map { |month, cents| { month: month, spend: money(cents, country.currency) } }
      }
    end
  end
end
