we are building an employee management system for 10000 employees across India, US, Australia and can expand to 20k. 
Now design design a backend in rails 8 with two kinds of users HR and Employee
- HR Manager should be able to update all the information of Employees
- Employees should be able to update their own information

Domain modeling
Person(id(uuid), first_name, last_name, full_name, preferred_name, phone_number, email, dob, gender, emergency_contact_name, emergency_contact_number, created_at, updated_at)
Locations - id(uuid), city, state, country
Address - id, line1, line2, city, state, country, postal_code, addressable
legal_entity - location_id, name, effective_from, effective_to, is_active
Team - id, name
Grade - id, name, country, lower_level, high_level, currency
Job - id, code, title, description, level, gradeRange, available_for_locations
Position - id, job_id, code, name, effective_from, effective_to, location_id, is_remote, country, team_id,
required_head_count, actual_head_count
Employment -
id PK, person_id FK, legal_entity_id FK, employee_number, employment_type, status, hire_date, notice_period_days, resignation_date, last_working_date, separation_type, separation_reason, eligible_for_rehire, work_email, reports_to
Assignment
id PK, employment_id FK, effective_from, effective_to, action_type, action_reason, is_primary, position_id FK, job_id FK, team_id FK, location_id FK, reports_to

EmployeeCompensation
id PK, employment_id FK, effective_from, effective_to, annual_salary, currency, pay_frequency, grade_id FK, change_reason (Hire, Annual increment, Promotion, Correction), approved_by, approved_at


position belongs_to team
address polymorphic belongs_to legal_entity and person
assume all pk ids are uuids

Let's first grill the model and find any problems in terms of UI views, how easy the data is collected and stored to get the below insights via UI.
a. Minimum, maximum, average salary of employees in a country
b. Average salary for the given Job Title in a country.
c. How much salary increments happened in last year in a country


