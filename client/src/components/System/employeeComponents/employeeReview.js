const WEEKDAY_NAMES = new Map([
  [0, 'Sunday'],
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
])

const titleCase = (value = '') => String(value || '')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const getWorkDayName = (value) => WEEKDAY_NAMES.get(Number(value)) || `Day ${value}`

export const buildEmployeeReviewPayload = (payload = {}) => ({
  employeeInformation: {
    employeeCode: payload.employee_code || '',
    firstName: payload.first_name || '',
    middleName: payload.middle_name || '',
    lastName: payload.last_name || '',
    email: payload.email || '',
    contactNumber: payload.contact_number || '',
    address: payload.address || '',
    department: payload.department || '',
    position: payload.position || '',
    employmentType: titleCase(payload.employment_type || ''),
    hireDate: payload.hire_date || '',
    status: titleCase(payload.employee_status || ''),
  },
  compensationAndBenefits: {
    monthlySalary: Number(payload.monthly_salary || 0),
    attendanceGraceMinutes: Number(payload.attendance_grace_minutes || 0),
    riceAllowanceAmount: Number(payload.rice_allowance || 0),
    transportationAllowanceAmount: Number(payload.transportation_allowance || 0),
    attendanceBonusAmount: Number(payload.attendance_bonus_amount || 0),
    overtimeMultiplier: Number(payload.overtime_multiplier || 0),
    nightDifferentialPercent: Number(payload.night_differential_percent || 0),
  },
  workSchedule: {
    shiftStart: payload.shift_start || '',
    shiftEnd: payload.shift_end || '',
    breakMinutes: Number(payload.break_minutes || 0),
    workDays: (payload.work_days || []).map(getWorkDayName),
  },
})
