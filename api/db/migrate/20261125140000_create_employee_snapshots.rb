# One row per employment with its person, legal entity / country, and the
# primary assignment and compensation that apply on a given date.
#
# employee_snapshots_on(as_of) is a set-returning SQL function so callers
# (employee list, reports) can pass the date explicitly; Postgres inlines it,
# so filters push down. The employee_snapshots view (= today) only exists to
# give ActiveRecord the column types; always query through
# EmployeeSnapshot.as_of(date).
#
# Row choice per employment: the latest row starting on or before as_of;
# if none (a future hire) the earliest upcoming row. Separated employments
# therefore show their last known job and salary.
class CreateEmployeeSnapshots < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL
      CREATE FUNCTION employee_snapshots_on(as_of date)
      RETURNS TABLE (
        employment_id uuid, person_id uuid, employee_number text, status text, employment_type text,
        hire_date date, last_working_date date, work_email text,
        legal_entity_id uuid, legal_entity_name text, country_id uuid, country_code text, currency text,
        full_name text, preferred_name text, person_email text, search_vector tsvector,
        assignment_id uuid, assignment_effective_from date, assignment_effective_to date,
        position_id uuid, position_name text, job_id uuid, job_title text, job_level text,
        team_id uuid, team_name text, grade_id uuid, grade_code text,
        manager_employment_id uuid, manager_name text,
        compensation_id uuid, compensation_effective_from date, compensation_effective_to date,
        annual_salary_cents bigint, pay_frequency text
      )
      LANGUAGE sql STABLE
      AS $$
        SELECT
          e.id, e.person_id, e.employee_number::text, e.status::text, e.employment_type::text,
          e.hire_date, e.last_working_date, e.work_email::text,
          le.id, le.name::text, c.id, c.iso_code::text, c.currency::text,
          p.full_name::text, p.preferred_name::text, p.email::text, p.search_vector,
          a.id, a.effective_from, a.effective_to,
          pos.id, pos.name::text, j.id, j.title::text, j.level::text,
          t.id, t.name::text, g.id, g.code::text,
          a.reports_to_employment_id, COALESCE(mp.preferred_name, mp.full_name)::text,
          comp.id, comp.effective_from, comp.effective_to,
          comp.annual_salary_cents, comp.pay_frequency::text
        FROM employments e
        JOIN people p ON p.id = e.person_id
        JOIN legal_entities le ON le.id = e.legal_entity_id
        JOIN locations l ON l.id = le.location_id
        JOIN countries c ON c.id = l.country_id
        LEFT JOIN LATERAL (
          SELECT * FROM assignments
          WHERE assignments.employment_id = e.id AND assignments.is_primary
          ORDER BY assignments.effective_from > as_of,
                   CASE WHEN assignments.effective_from <= as_of THEN assignments.effective_from END DESC,
                   assignments.effective_from
          LIMIT 1
        ) a ON true
        LEFT JOIN positions pos ON pos.id = a.position_id
        LEFT JOIN jobs j ON j.id = pos.job_id
        LEFT JOIN teams t ON t.id = pos.team_id
        LEFT JOIN grades g ON g.id = a.grade_id
        LEFT JOIN employments me ON me.id = a.reports_to_employment_id
        LEFT JOIN people mp ON mp.id = me.person_id
        LEFT JOIN LATERAL (
          SELECT * FROM compensations
          WHERE compensations.employment_id = e.id
          ORDER BY compensations.effective_from > as_of,
                   CASE WHEN compensations.effective_from <= as_of THEN compensations.effective_from END DESC,
                   compensations.effective_from
          LIMIT 1
        ) comp ON true
      $$;

      CREATE VIEW employee_snapshots AS SELECT * FROM employee_snapshots_on(CURRENT_DATE);
    SQL
  end

  def down
    execute "DROP VIEW employee_snapshots; DROP FUNCTION employee_snapshots_on(date);"
  end
end
