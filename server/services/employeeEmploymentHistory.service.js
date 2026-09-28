const CHANGE_TYPES = new Set([
  'hired',
  'promotion',
  'salary_increase',
  'position_change',
  'department_transfer',
  'employment_status_change',
  'allowance_adjustment',
  'demotion',
  'other',
]);

const EMPLOYMENT_TYPES = new Set(['regular', 'probationary', 'contractual', 'part_time', 'intern']);

const cleanText = (value, fallback = '') => String(value ?? '').trim() || fallback;

const money = (value, field) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${field} must be a non-negative amount.`);
    error.statusCode = 400;
    throw error;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const dateOnly = (value) => {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

const dayBefore = (dateText) => {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const EMPLOYMENT_CHANGE_TYPES = Object.freeze([...CHANGE_TYPES]);
export const EMPLOYEE_EMPLOYMENT_TYPES = Object.freeze([...EMPLOYMENT_TYPES]);

export const mapEmploymentHistoryRow = (row = {}) => ({
  ...row,
  monthly_basic_salary: Number(row.monthly_basic_salary || 0),
  rice_allowance: Number(row.rice_allowance || 0),
  transportation_allowance: Number(row.transportation_allowance || 0),
  attendance_bonus: Number(row.attendance_bonus || 0),
  effective_from: dateOnly(row.effective_from),
  effective_to: dateOnly(row.effective_to),
});

export const normalizeEmploymentChangePayload = (body = {}) => {
  const changeType = cleanText(body.change_type).toLowerCase();
  const employmentType = cleanText(body.employment_type).toLowerCase();
  const effectiveFrom = dateOnly(body.effective_from);

  if (!CHANGE_TYPES.has(changeType) || changeType === 'hired') {
    const error = new Error('Select a valid employment change type.');
    error.statusCode = 400;
    throw error;
  }
  if (!EMPLOYMENT_TYPES.has(employmentType)) {
    const error = new Error('Select a valid employment status.');
    error.statusCode = 400;
    throw error;
  }
  if (!effectiveFrom) {
    const error = new Error('Effective Date is required.');
    error.statusCode = 400;
    throw error;
  }

  const position = cleanText(body.position);
  const department = cleanText(body.department);
  const reason = cleanText(body.change_reason || body.reason);
  if (!position || !department) {
    const error = new Error('Position and Department are required.');
    error.statusCode = 400;
    throw error;
  }
  if (!reason) {
    const error = new Error('Reason / Notes is required for an employment change.');
    error.statusCode = 400;
    throw error;
  }

  return {
    changeType,
    position,
    department,
    employmentType,
    monthlyBasicSalary: money(body.monthly_basic_salary, 'Monthly Basic Salary'),
    riceAllowance: money(body.rice_allowance, 'Rice Allowance'),
    transportationAllowance: money(body.transportation_allowance, 'Transportation Allowance'),
    attendanceBonus: money(body.attendance_bonus, 'Attendance Bonus'),
    effectiveFrom,
    reason,
  };
};

export const createInitialEmploymentHistory = async (connection, {
  employeeId,
  position,
  department,
  employmentType,
  monthlyBasicSalary = 0,
  riceAllowance = 0,
  transportationAllowance = 0,
  attendanceBonus = 0,
  effectiveFrom,
  actorId = null,
  reason = 'Initial employment record.',
}) => {
  const [existing] = await connection.query(
    'SELECT employee_employment_history_id FROM employee_employment_history WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  if (existing[0]) return Number(existing[0].employee_employment_history_id);

  const [result] = await connection.query(`
    INSERT INTO employee_employment_history (
      employee_id, change_type, position, department, employment_type,
      monthly_basic_salary, rice_allowance, transportation_allowance, attendance_bonus,
      effective_from, effective_to, change_reason, previous_history_id, created_by_user_id
    ) VALUES (?, 'hired', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)
  `, [
    employeeId,
    cleanText(position, 'Employee'),
    cleanText(department, 'Unassigned'),
    EMPLOYMENT_TYPES.has(String(employmentType)) ? String(employmentType) : 'regular',
    money(monthlyBasicSalary, 'Monthly Basic Salary'),
    money(riceAllowance, 'Rice Allowance'),
    money(transportationAllowance, 'Transportation Allowance'),
    money(attendanceBonus, 'Attendance Bonus'),
    effectiveFrom,
    reason,
    actorId,
  ]);
  return Number(result.insertId);
};

export const getEmployeeEmploymentHistory = async (connection, employeeId) => {
  const [rows] = await connection.query(`
    SELECT
      h.*,
      TRIM(CONCAT_WS(' ', creator.first_name, creator.middle_name, creator.last_name)) AS created_by_name,
      TRIM(CONCAT_WS(' ', corrector.first_name, corrector.middle_name, corrector.last_name)) AS corrected_by_name
    FROM employee_employment_history h
    LEFT JOIN users creator ON creator.id = h.created_by_user_id
    LEFT JOIN users corrector ON corrector.id = h.corrected_by_user_id
    WHERE h.employee_id = ?
    ORDER BY h.effective_from DESC, h.employee_employment_history_id DESC
  `, [employeeId]);
  return rows.map(mapEmploymentHistoryRow);
};

export const getCurrentEmploymentHistory = async (connection, employeeId) => {
  const [rows] = await connection.query(`
    SELECT h.*
    FROM employee_employment_history h
    WHERE h.employee_id = ? AND h.effective_to IS NULL
    ORDER BY h.effective_from DESC, h.employee_employment_history_id DESC
    LIMIT 1
  `, [employeeId]);
  return rows[0] ? mapEmploymentHistoryRow(rows[0]) : null;
};

export const applyEmploymentChange = async (connection, {
  employeeId,
  payload,
  actorId = null,
  today,
}) => {
  if (!Number.isInteger(Number(employeeId)) || Number(employeeId) <= 0) {
    const error = new Error('Select a valid employee.');
    error.statusCode = 400;
    throw error;
  }

  const change = normalizeEmploymentChangePayload(payload);
  if (change.effectiveFrom > today) {
    const error = new Error('Effective Date cannot be in the future. Future-dated scheduling will be added with the payroll workflow.');
    error.statusCode = 400;
    throw error;
  }

  const [employeeRows] = await connection.query(
    'SELECT * FROM employees WHERE employee_id = ? AND employee_status <> \'archived\' LIMIT 1 FOR UPDATE',
    [employeeId]
  );
  const employee = employeeRows[0];
  if (!employee) {
    const error = new Error('Employee not found.');
    error.statusCode = 404;
    throw error;
  }

  let current = await getCurrentEmploymentHistory(connection, employeeId);
  if (!current) {
    await createInitialEmploymentHistory(connection, {
      employeeId,
      position: employee.position,
      department: employee.department,
      employmentType: employee.employment_type,
      monthlyBasicSalary: employee.monthly_salary,
      riceAllowance: employee.rice_allowance,
      transportationAllowance: employee.transportation_allowance,
      attendanceBonus: employee.attendance_bonus_amount,
      effectiveFrom: dateOnly(employee.hire_date) || today,
      actorId: employee.created_by_user_id || actorId,
      reason: 'Backfilled from the employee profile before the first recorded employment change.',
    });
    current = await getCurrentEmploymentHistory(connection, employeeId);
  }

  if (!current) {
    const error = new Error('Unable to resolve the current employment record.');
    error.statusCode = 409;
    throw error;
  }
  if (change.effectiveFrom <= current.effective_from) {
    const error = new Error(`Effective Date must be after the current record start date (${current.effective_from}). Use the protected historical-correction workflow for earlier dates.`);
    error.statusCode = 409;
    throw error;
  }

  const nextEffectiveTo = dayBefore(change.effectiveFrom);
  await connection.query(
    'UPDATE employee_employment_history SET effective_to = ? WHERE employee_employment_history_id = ?',
    [nextEffectiveTo, current.employee_employment_history_id]
  );

  const [insertResult] = await connection.query(`
    INSERT INTO employee_employment_history (
      employee_id, change_type, position, department, employment_type,
      monthly_basic_salary, rice_allowance, transportation_allowance, attendance_bonus,
      effective_from, effective_to, change_reason, previous_history_id, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `, [
    employeeId,
    change.changeType,
    change.position,
    change.department,
    change.employmentType,
    change.monthlyBasicSalary,
    change.riceAllowance,
    change.transportationAllowance,
    change.attendanceBonus,
    change.effectiveFrom,
    change.reason,
    current.employee_employment_history_id,
    actorId,
  ]);

  await connection.query(`
    UPDATE employees
    SET position = ?, department = ?, employment_type = ?, monthly_salary = ?,
        rice_allowance = ?, transportation_allowance = ?, attendance_bonus_amount = ?,
        updated_by_user_id = ?
    WHERE employee_id = ?
  `, [
    change.position,
    change.department,
    change.employmentType,
    change.monthlyBasicSalary,
    change.riceAllowance,
    change.transportationAllowance,
    change.attendanceBonus,
    actorId,
    employeeId,
  ]);

  const [newRows] = await connection.query(
    'SELECT * FROM employee_employment_history WHERE employee_employment_history_id = ? LIMIT 1',
    [insertResult.insertId]
  );

  return {
    before: current,
    after: mapEmploymentHistoryRow(newRows[0]),
  };
};
