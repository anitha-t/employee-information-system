// API responses exactly as Rails sends them (snake_case), so tests also
// exercise the client's key conversion.

export const hrMe = {
  user: { id: 'u-hr', email_address: 'hr@acme.example', role: 'hr' },
  person: { id: 'p-hr', full_name: 'Hema Rao', preferred_name: null, display_name: 'Hema Rao' },
  employment: null,
}

export const employeeMe = {
  user: { id: 'u-emp', email_address: 'priya@acme.example', role: 'employee' },
  person: { id: 'p-emp', full_name: 'Priya Sharma', preferred_name: 'Anu', display_name: 'Anu' },
  employment: {
    id: 'e-emp', employee_number: 'E000123', status: 'active', legal_entity: 'Acme India Pvt Ltd', country: 'IN',
    job_title: 'Software Engineer', team: 'Platform', manager: 'Ravi Kumar',
  },
}

export const profile = {
  id: 'p-emp', lock_version: 3, first_name: 'Priya', last_name: 'Sharma', full_name: 'Priya Sharma',
  preferred_name: 'Anu', email: 'anu@example.com', phone_number: '+919800000000', dob: '1990-05-01', gender: 'female',
  addresses: [{
    id: 'a1', address_type: 'home', line1: '12 MG Road', line2: null, city: 'Bengaluru', state: 'KA', postal_code: '560001',
    country: { id: 'c-in', iso_code: 'IN', name: 'India' },
  }],
  emergency_contacts: [{ id: 'ec1', name: 'Ravi', relationship: 'spouse', phone_number: '+919811111111', is_primary: true }],
}

export const countries = [
  { id: 'c-au', iso_code: 'AU', name: 'Australia', currency: 'AUD' },
  { id: 'c-in', iso_code: 'IN', name: 'India', currency: 'INR' },
  { id: 'c-us', iso_code: 'US', name: 'United States', currency: 'USD' },
]

export function employee(overrides: Record<string, unknown> = {}) {
  return {
    employment_id: 'emp-1', employee_number: 'E000001', status: 'active', employment_type: 'full_time',
    hire_date: '2020-01-06', last_working_date: null, work_email: 'priya@acme.example',
    person: { id: 'p1', full_name: 'Priya Sharma', display_name: 'Priya Sharma', email: 'priya@example.com' },
    legal_entity: { id: 'le-in', name: 'Acme India Pvt Ltd' },
    country: { id: 'c-in', iso_code: 'IN', currency: 'INR' },
    position: { id: 'pos-1', name: 'Software Engineer, Platform (IN)' },
    job: { id: 'job-swe', title: 'Software Engineer', level: 'IC2' },
    team: { id: 't-platform', name: 'Platform' },
    grade: { id: 'g2', code: 'G2' },
    manager: { employment_id: 'emp-9', display_name: 'Ravi Kumar' },
    annual_salary: { amount: '1850000.00', currency: 'INR' },
    pay_frequency: 'monthly',
    ...overrides,
  }
}

export const employeesPage = (data: unknown[], meta: Record<string, unknown> = {}) => ({
  data,
  meta: { page: 1, per_page: 25, total_count: data.length, as_of: '2026-11-25', ...meta },
})

export const legalEntities = [
  {
    id: 'le-in', name: 'Acme India Pvt Ltd', is_active: true, effective_from: '2016-01-01', effective_to: null,
    location: { id: 'loc-blr', city: 'Bengaluru', state: 'KA' }, country: countries[1], addresses: [],
  },
  {
    id: 'le-us', name: 'Acme Inc', is_active: true, effective_from: '2016-01-01', effective_to: null,
    location: { id: 'loc-sf', city: 'San Francisco', state: 'CA' }, country: countries[2], addresses: [],
  },
]

export const grades = [1, 2, 3, 4, 5].map((rank) => ({ id: `g${rank}`, code: `G${rank}`, name: `Grade ${rank}`, rank, is_active: true }))

const gradeRef = (rank: number) => ({ id: `g${rank}`, code: `G${rank}`, rank })

export const jobs = [
  { id: 'job-swe', code: 'SWE', title: 'Software Engineer', level: 'IC2', description: null, is_active: true,
    min_grade: gradeRef(1), max_grade: gradeRef(3), countries: ['IN', 'US'] },
  { id: 'job-staff', code: 'STAFF', title: 'Staff Engineer', level: 'IC4', description: null, is_active: true,
    min_grade: gradeRef(4), max_grade: gradeRef(5), countries: ['IN'] },
]

export function position(id: string, jobId: string, overrides: Record<string, unknown> = {}) {
  const job = jobs.find((candidate) => candidate.id === jobId)!
  return {
    id, code: id.toUpperCase(), name: `${job.title}, Platform (IN)`, is_remote: false, effective_from: '2016-01-01',
    effective_to: null, required_head_count: 3, filled_head_count: 1, vacancies: 2,
    job: { id: job.id, code: job.code, title: job.title }, team: { id: 't-platform', name: 'Platform' },
    legal_entity: { id: 'le-in', name: 'Acme India Pvt Ltd' }, country: { id: 'c-in', iso_code: 'IN', currency: 'INR' },
    location: { id: 'loc-blr', city: 'Bengaluru', state: 'KA' },
    ...overrides,
  }
}

export const salaryBand = {
  id: 'band-g2', currency: 'INR', effective_from: '2016-01-01', effective_to: null,
  country: { id: 'c-in', iso_code: 'IN' }, grade: gradeRef(2),
  min: { amount: '840000.00', currency: 'INR' }, max: { amount: '1400000.00', currency: 'INR' },
}

export const hireResponse = {
  id: 'action-1', lock_version: 0, action_type: 'hire', effective_date: '2026-12-01', reason: null,
  employment: { id: 'emp-new', employee_number: 'E010001', status: 'active', person: { id: 'p-new', display_name: 'Meera Iyer' } },
}

export const apiError = (code: string, message: string, details: Record<string, string[]> = {}) => ({
  error: { code, message, details },
})
