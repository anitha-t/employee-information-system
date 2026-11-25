SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: employee_snapshots_on(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.employee_snapshots_on(as_of date) RETURNS TABLE(employment_id uuid, person_id uuid, employee_number text, status text, employment_type text, hire_date date, last_working_date date, work_email text, legal_entity_id uuid, legal_entity_name text, country_id uuid, country_code text, currency text, full_name text, preferred_name text, person_email text, search_vector tsvector, assignment_id uuid, assignment_effective_from date, assignment_effective_to date, position_id uuid, position_name text, job_id uuid, job_title text, job_level text, team_id uuid, team_name text, grade_id uuid, grade_code text, manager_employment_id uuid, manager_name text, compensation_id uuid, compensation_effective_from date, compensation_effective_to date, annual_salary_cents bigint, pay_frequency text)
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    addressable_type character varying NOT NULL,
    addressable_id uuid NOT NULL,
    address_type character varying NOT NULL,
    line1 character varying NOT NULL,
    line2 character varying,
    city character varying NOT NULL,
    state character varying,
    postal_code character varying,
    country_id uuid NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employment_id uuid NOT NULL,
    employment_action_id uuid NOT NULL,
    position_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    reports_to_employment_id uuid,
    is_primary boolean DEFAULT true NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT assignments_valid_range CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: compensations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employment_id uuid NOT NULL,
    employment_action_id uuid NOT NULL,
    annual_salary_cents bigint NOT NULL,
    currency character varying(3) NOT NULL,
    pay_frequency character varying DEFAULT 'monthly'::character varying NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT compensations_positive_salary CHECK ((annual_salary_cents > 0)),
    CONSTRAINT compensations_valid_range CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    iso_code character varying(2) NOT NULL,
    name character varying NOT NULL,
    currency character varying(3) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: emergency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    name character varying NOT NULL,
    relationship character varying,
    phone_number character varying NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: employee_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_snapshots; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.employee_snapshots AS
 SELECT employment_id,
    person_id,
    employee_number,
    status,
    employment_type,
    hire_date,
    last_working_date,
    work_email,
    legal_entity_id,
    legal_entity_name,
    country_id,
    country_code,
    currency,
    full_name,
    preferred_name,
    person_email,
    search_vector,
    assignment_id,
    assignment_effective_from,
    assignment_effective_to,
    position_id,
    position_name,
    job_id,
    job_title,
    job_level,
    team_id,
    team_name,
    grade_id,
    grade_code,
    manager_employment_id,
    manager_name,
    compensation_id,
    compensation_effective_from,
    compensation_effective_to,
    annual_salary_cents,
    pay_frequency
   FROM public.employee_snapshots_on(CURRENT_DATE) employee_snapshots_on(employment_id, person_id, employee_number, status, employment_type, hire_date, last_working_date, work_email, legal_entity_id, legal_entity_name, country_id, country_code, currency, full_name, preferred_name, person_email, search_vector, assignment_id, assignment_effective_from, assignment_effective_to, position_id, position_name, job_id, job_title, job_level, team_id, team_name, grade_id, grade_code, manager_employment_id, manager_name, compensation_id, compensation_effective_from, compensation_effective_to, annual_salary_cents, pay_frequency);


--
-- Name: employment_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employment_id uuid NOT NULL,
    action_type character varying NOT NULL,
    effective_date date NOT NULL,
    reason text,
    created_by_user_id uuid NOT NULL,
    reviewed_by_user_id uuid,
    review_decision character varying,
    reviewed_at timestamp(6) without time zone,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: employments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    legal_entity_id uuid NOT NULL,
    employee_number character varying DEFAULT ('E'::text || lpad((nextval('public.employee_number_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    employment_type character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    hire_date date NOT NULL,
    notice_period_days integer,
    resignation_date date,
    last_working_date date,
    separation_type character varying,
    separation_reason text,
    eligible_for_rehire boolean,
    work_email character varying,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT employments_valid_last_working_date CHECK (((last_working_date IS NULL) OR (last_working_date >= hire_date)))
);


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    rank integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: job_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    country_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying NOT NULL,
    title character varying NOT NULL,
    level character varying,
    description text,
    min_grade_id uuid NOT NULL,
    max_grade_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: legal_entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    location_id uuid NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT legal_entities_valid_range CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_id uuid NOT NULL,
    state character varying,
    city character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying,
    preferred_name character varying,
    full_name character varying GENERATED ALWAYS AS (((first_name)::text || COALESCE((' '::text || (last_name)::text), ''::text))) STORED,
    email character varying,
    phone_number character varying,
    dob date,
    gender character varying,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, (((((((COALESCE(first_name, ''::character varying))::text || ' '::text) || (COALESCE(last_name, ''::character varying))::text) || ' '::text) || (COALESCE(preferred_name, ''::character varying))::text) || ' '::text) || (COALESCE(email, ''::character varying))::text))) STORED,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    job_id uuid NOT NULL,
    team_id uuid NOT NULL,
    legal_entity_id uuid NOT NULL,
    location_id uuid,
    is_remote boolean DEFAULT false NOT NULL,
    required_head_count integer DEFAULT 1 NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT positions_head_count_non_negative CHECK ((required_head_count >= 0)),
    CONSTRAINT positions_location_unless_remote CHECK ((is_remote OR (location_id IS NOT NULL))),
    CONSTRAINT positions_valid_range CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: salary_bands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_bands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grade_id uuid NOT NULL,
    country_id uuid NOT NULL,
    min_cents bigint NOT NULL,
    max_cents bigint NOT NULL,
    currency character varying(3) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT salary_bands_valid_amounts CHECK (((min_cents >= 0) AND (max_cents >= min_cents))),
    CONSTRAINT salary_bands_valid_range CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_digest character varying NOT NULL,
    ip_address character varying,
    user_agent character varying,
    expires_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    email_address character varying NOT NULL,
    password_digest character varying NOT NULL,
    role character varying DEFAULT 'employee'::character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT users_valid_role CHECK (((role)::text = ANY (ARRAY[('hr'::character varying)::text, ('employee'::character varying)::text])))
);


--
-- Name: versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_type character varying NOT NULL,
    item_id uuid NOT NULL,
    event character varying NOT NULL,
    whodunnit character varying,
    object jsonb,
    object_changes jsonb,
    request_id character varying,
    ip character varying,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: assignments assignments_no_overlapping_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_no_overlapping_primary EXCLUDE USING gist (employment_id WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&) WHERE (is_primary);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: compensations compensations_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT compensations_no_overlap EXCLUDE USING gist (employment_id WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);


--
-- Name: compensations compensations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT compensations_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: emergency_contacts emergency_contacts_one_primary_per_person; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_one_primary_per_person EXCLUDE USING gist (person_id WITH =) WHERE (is_primary) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: emergency_contacts emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: employment_actions employment_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_actions
    ADD CONSTRAINT employment_actions_pkey PRIMARY KEY (id);


--
-- Name: employments employments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employments
    ADD CONSTRAINT employments_pkey PRIMARY KEY (id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: job_countries job_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_countries
    ADD CONSTRAINT job_countries_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: legal_entities legal_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_entities
    ADD CONSTRAINT legal_entities_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: salary_bands salary_bands_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_bands
    ADD CONSTRAINT salary_bands_no_overlap EXCLUDE USING gist (grade_id WITH =, country_id WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);


--
-- Name: salary_bands salary_bands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_bands
    ADD CONSTRAINT salary_bands_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: versions versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.versions
    ADD CONSTRAINT versions_pkey PRIMARY KEY (id);


--
-- Name: index_addresses_on_addressable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_addresses_on_addressable ON public.addresses USING btree (addressable_type, addressable_id);


--
-- Name: index_addresses_on_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_addresses_on_country_id ON public.addresses USING btree (country_id);


--
-- Name: index_assignments_on_employment_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_assignments_on_employment_action_id ON public.assignments USING btree (employment_action_id);


--
-- Name: index_assignments_on_employment_id_and_effective_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_assignments_on_employment_id_and_effective_from ON public.assignments USING btree (employment_id, effective_from);


--
-- Name: index_assignments_on_grade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_assignments_on_grade_id ON public.assignments USING btree (grade_id);


--
-- Name: index_assignments_on_position_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_assignments_on_position_id ON public.assignments USING btree (position_id);


--
-- Name: index_assignments_on_reports_to_employment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_assignments_on_reports_to_employment_id ON public.assignments USING btree (reports_to_employment_id);


--
-- Name: index_compensations_on_employment_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_compensations_on_employment_action_id ON public.compensations USING btree (employment_action_id);


--
-- Name: index_compensations_on_employment_id_and_effective_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_compensations_on_employment_id_and_effective_from ON public.compensations USING btree (employment_id, effective_from);


--
-- Name: index_countries_on_iso_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_countries_on_iso_code ON public.countries USING btree (iso_code);


--
-- Name: index_emergency_contacts_on_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_emergency_contacts_on_person_id ON public.emergency_contacts USING btree (person_id);


--
-- Name: index_employment_actions_on_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employment_actions_on_action_type ON public.employment_actions USING btree (action_type);


--
-- Name: index_employment_actions_on_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employment_actions_on_created_by_user_id ON public.employment_actions USING btree (created_by_user_id);


--
-- Name: index_employment_actions_on_employment_id_and_effective_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employment_actions_on_employment_id_and_effective_date ON public.employment_actions USING btree (employment_id, effective_date);


--
-- Name: index_employment_actions_on_reviewed_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employment_actions_on_reviewed_by_user_id ON public.employment_actions USING btree (reviewed_by_user_id);


--
-- Name: index_employments_on_employee_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_employments_on_employee_number ON public.employments USING btree (employee_number);


--
-- Name: index_employments_on_legal_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employments_on_legal_entity_id ON public.employments USING btree (legal_entity_id);


--
-- Name: index_employments_on_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employments_on_person_id ON public.employments USING btree (person_id);


--
-- Name: index_employments_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_employments_on_status ON public.employments USING btree (status);


--
-- Name: index_employments_on_work_email_unless_separated; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_employments_on_work_email_unless_separated ON public.employments USING btree (work_email) WHERE ((status)::text <> 'separated'::text);


--
-- Name: index_grades_on_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_grades_on_code ON public.grades USING btree (code);


--
-- Name: index_grades_on_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_grades_on_rank ON public.grades USING btree (rank);


--
-- Name: index_job_countries_on_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_countries_on_country_id ON public.job_countries USING btree (country_id);


--
-- Name: index_job_countries_on_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_countries_on_job_id ON public.job_countries USING btree (job_id);


--
-- Name: index_job_countries_on_job_id_and_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_job_countries_on_job_id_and_country_id ON public.job_countries USING btree (job_id, country_id);


--
-- Name: index_jobs_on_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_jobs_on_code ON public.jobs USING btree (code);


--
-- Name: index_jobs_on_max_grade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_jobs_on_max_grade_id ON public.jobs USING btree (max_grade_id);


--
-- Name: index_jobs_on_min_grade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_jobs_on_min_grade_id ON public.jobs USING btree (min_grade_id);


--
-- Name: index_jobs_on_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_jobs_on_title ON public.jobs USING btree (title);


--
-- Name: index_legal_entities_on_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_legal_entities_on_location_id ON public.legal_entities USING btree (location_id);


--
-- Name: index_legal_entities_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_legal_entities_on_name ON public.legal_entities USING btree (name);


--
-- Name: index_locations_on_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_locations_on_country_id ON public.locations USING btree (country_id);


--
-- Name: index_people_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_people_on_email ON public.people USING btree (email);


--
-- Name: index_people_on_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_people_on_full_name ON public.people USING gin (full_name public.gin_trgm_ops);


--
-- Name: index_people_on_preferred_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_people_on_preferred_name ON public.people USING gin (preferred_name public.gin_trgm_ops);


--
-- Name: index_people_on_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_people_on_search_vector ON public.people USING gin (search_vector);


--
-- Name: index_positions_on_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_positions_on_code ON public.positions USING btree (code);


--
-- Name: index_positions_on_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_positions_on_job_id ON public.positions USING btree (job_id);


--
-- Name: index_positions_on_legal_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_positions_on_legal_entity_id ON public.positions USING btree (legal_entity_id);


--
-- Name: index_positions_on_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_positions_on_location_id ON public.positions USING btree (location_id);


--
-- Name: index_positions_on_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_positions_on_team_id ON public.positions USING btree (team_id);


--
-- Name: index_salary_bands_on_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_salary_bands_on_country_id ON public.salary_bands USING btree (country_id);


--
-- Name: index_salary_bands_on_grade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_salary_bands_on_grade_id ON public.salary_bands USING btree (grade_id);


--
-- Name: index_sessions_on_token_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_sessions_on_token_digest ON public.sessions USING btree (token_digest);


--
-- Name: index_sessions_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sessions_on_user_id ON public.sessions USING btree (user_id);


--
-- Name: index_teams_on_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_teams_on_parent_id ON public.teams USING btree (parent_id);


--
-- Name: index_users_on_email_address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_email_address ON public.users USING btree (email_address);


--
-- Name: index_users_on_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_person_id ON public.users USING btree (person_id);


--
-- Name: index_versions_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_versions_on_created_at ON public.versions USING btree (created_at);


--
-- Name: index_versions_on_item_type_and_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_versions_on_item_type_and_item_id ON public.versions USING btree (item_type, item_id);


--
-- Name: index_versions_on_whodunnit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_versions_on_whodunnit ON public.versions USING btree (whodunnit);


--
-- Name: locations fk_rails_01b674b4b8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_rails_01b674b4b8 FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: jobs fk_rails_029a707e9a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT fk_rails_029a707e9a FOREIGN KEY (max_grade_id) REFERENCES public.grades(id);


--
-- Name: employment_actions fk_rails_03be5f4ae6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_actions
    ADD CONSTRAINT fk_rails_03be5f4ae6 FOREIGN KEY (employment_id) REFERENCES public.employments(id);


--
-- Name: positions fk_rails_096a6ce7d3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_rails_096a6ce7d3 FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: positions fk_rails_0d806d9fb0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_rails_0d806d9fb0 FOREIGN KEY (legal_entity_id) REFERENCES public.legal_entities(id);


--
-- Name: assignments fk_rails_1777eecde8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_rails_1777eecde8 FOREIGN KEY (reports_to_employment_id) REFERENCES public.employments(id);


--
-- Name: assignments fk_rails_35410cbb4b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_rails_35410cbb4b FOREIGN KEY (employment_id) REFERENCES public.employments(id);


--
-- Name: employments fk_rails_4065f5ffb5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employments
    ADD CONSTRAINT fk_rails_4065f5ffb5 FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: salary_bands fk_rails_4cee29d0f7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_bands
    ADD CONSTRAINT fk_rails_4cee29d0f7 FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: job_countries fk_rails_4e6f875802; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_countries
    ADD CONSTRAINT fk_rails_4e6f875802 FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: employments fk_rails_5028b4b534; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employments
    ADD CONSTRAINT fk_rails_5028b4b534 FOREIGN KEY (legal_entity_id) REFERENCES public.legal_entities(id);


--
-- Name: salary_bands fk_rails_5ab5a2fef8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_bands
    ADD CONSTRAINT fk_rails_5ab5a2fef8 FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: assignments fk_rails_5ec2cabe58; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_rails_5ec2cabe58 FOREIGN KEY (position_id) REFERENCES public.positions(id);


--
-- Name: jobs fk_rails_69855aaa22; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT fk_rails_69855aaa22 FOREIGN KEY (min_grade_id) REFERENCES public.grades(id);


--
-- Name: sessions fk_rails_758836b4f0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_rails_758836b4f0 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: assignments fk_rails_77a0ed0f88; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_rails_77a0ed0f88 FOREIGN KEY (employment_action_id) REFERENCES public.employment_actions(id);


--
-- Name: positions fk_rails_7c4f309ff7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_rails_7c4f309ff7 FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: compensations fk_rails_7d293efda3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT fk_rails_7d293efda3 FOREIGN KEY (employment_id) REFERENCES public.employments(id);


--
-- Name: teams fk_rails_b16e7ed972; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT fk_rails_b16e7ed972 FOREIGN KEY (parent_id) REFERENCES public.teams(id);


--
-- Name: assignments fk_rails_b307da443b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_rails_b307da443b FOREIGN KEY (grade_id) REFERENCES public.grades(id);


--
-- Name: job_countries fk_rails_c162476c3c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_countries
    ADD CONSTRAINT fk_rails_c162476c3c FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: legal_entities fk_rails_c2a4f544eb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_entities
    ADD CONSTRAINT fk_rails_c2a4f544eb FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: employment_actions fk_rails_caab2059bd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_actions
    ADD CONSTRAINT fk_rails_caab2059bd FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id);


--
-- Name: employment_actions fk_rails_d092a6eb16; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_actions
    ADD CONSTRAINT fk_rails_d092a6eb16 FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: addresses fk_rails_d873e14e27; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_rails_d873e14e27 FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: positions fk_rails_e2e7e53b76; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_rails_e2e7e53b76 FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: compensations fk_rails_ef703aee95; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT fk_rails_ef703aee95 FOREIGN KEY (employment_action_id) REFERENCES public.employment_actions(id);


--
-- Name: emergency_contacts fk_rails_f14f94033a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT fk_rails_f14f94033a FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: users fk_rails_fa67535741; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_rails_fa67535741 FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20261125140000'),
('20261125130000'),
('20261125120200'),
('20261125120100'),
('20261125120000'),
('20261125110100'),
('20261125110000');

