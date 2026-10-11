import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { buildEmployeeNameSql, cleanText, nullableText } from './employeeModule.shared.js';
import { ensureAttendanceLiteSchema, getAttendanceRuntimeSettings, getManilaDateTime } from './attendanceLite.shared.js';
import { generateUniqueAttendanceBarcode } from './attendanceBarcode.shared.js';
import {
  createInitialEmployeeRestDays,
  formatRestDays,
  getEmployeeRestDaysAsOf,
  normalizeRestDays,
  replaceEmployeeRestDays,
} from '../../../services/employeeRestDay.service.js';
import {
  applyEmploymentChange,
  createInitialEmploymentHistory,
  getEmployeeEmploymentHistory,
} from '../../../services/employeeEmploymentHistory.service.js';

const employmentTypes = new Set(['regular', 'probationary', 'contractual', 'part_time', 'intern']);
const statuses = new Set(['active', 'inactive']);
const MAX_DEPARTMENT_BARCODE_NUMBER = 999;

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'That employee code or attendance barcode is already assigned. Please try again.';
  return error?.message || 'Employee operation failed.';
};

const normalizeMoney = (value, fieldName, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be a non-negative amount.`);
    error.statusCode = 400;
    throw error;
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const normalizePayload = (body = {}) => ({
  firstName: cleanText(body.first_name),
  middleName: nullableText(body.middle_name),
  lastName: cleanText(body.last_name),
  department: cleanText(body.department),
  position: cleanText(body.position),
  employmentType: employmentTypes.has(String(body.employment_type)) ? String(body.employment_type) : 'regular',
  status: statuses.has(String(body.employee_status)) ? String(body.employee_status) : 'active',
  monthlyBasicSalary: normalizeMoney(body.monthly_basic_salary ?? body.monthly_salary, 'Monthly Basic Salary'),
  riceAllowance: normalizeMoney(body.rice_allowance, 'Rice Allowance'),
  transportationAllowance: normalizeMoney(body.transportation_allowance, 'Transportation Allowance'),
  attendanceBonus: normalizeMoney(body.attendance_bonus ?? body.attendance_bonus_amount, 'Attendance Bonus'),
  restDays: normalizeRestDays(body.rest_days),
  restDaysEffectiveFrom: cleanText(body.rest_days_effective_from),
});

const validatePayload = (payload, { requireCompensation = false } = {}) => {
  if (!payload.firstName || !payload.lastName || !payload.department) {
    const error = new Error('First name, last name, and department are required.');
    error.statusCode = 400;
    throw error;
  }
  if (requireCompensation && !payload.position) {
    const error = new Error('Position is required when creating an employee.');
    error.statusCode = 400;
    throw error;
  }
  if (!payload.restDays.length) {
    const error = new Error('Select at least one Rest Day.');
    error.statusCode = 400;
    throw error;
  }
};

const mapEmployee = (row) => ({
  ...row,
  barcode_code: row.barcode_code || null,
  employment_label: row.employment_type === 'part_time' ? 'Part Time' : row.employment_type === 'probationary' ? 'Probationary' : row.employment_type === 'contractual' ? 'Contractual' : row.employment_type === 'intern' ? 'Intern' : 'Full Time',
});

const attachCurrentRestDays = async (connection, rows = [], asOfDate) => {
  const restDayMap = await getEmployeeRestDaysAsOf(
    connection,
    rows.map((row) => row.employee_id),
    asOfDate
  );
  return rows.map((row) => ({
    ...mapEmployee(row),
    rest_days: restDayMap.get(Number(row.employee_id)) || [],
  }));
};

const findDepartmentConfig = async (connection, department) => {
  const runtime = await getAttendanceRuntimeSettings(connection);
  const config = runtime.departmentConfigs.find((item) => item.name.toLowerCase() === String(department || '').trim().toLowerCase());
  if (!config) {
    const error = new Error('Select a configured department before generating an employee code. Department code prefixes are managed in Attendance Settings.');
    error.statusCode = 400;
    throw error;
  }
  return config;
};

const getExistingMaxBarcodeNumber = async (connection, prefix) => {
  const [rows] = await connection.query(
    'SELECT employee_code FROM employees WHERE employee_code LIKE ?',
    [`${prefix}-%`]
  );
  const matcher = new RegExp(`^${prefix}-([0-9]{3})$`);
  let maxNumber = 0;
  for (const row of rows) {
    const match = matcher.exec(String(row.employee_code || '').toUpperCase());
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  return maxNumber;
};

const buildBarcodeCode = (prefix, number) => `${prefix}-${String(number).padStart(3, '0')}`;

const getBarcodePreview = async (connection, department) => {
  const config = await findDepartmentConfig(connection, department);
  const [rows] = await connection.query(
    'SELECT prefix, last_number FROM employee_barcode_sequences WHERE department = ? LIMIT 1',
    [config.name]
  );
  const sequenceNumber = rows[0] && String(rows[0].prefix || '').toUpperCase() === config.prefix
    ? Number(rows[0].last_number || 0)
    : 0;
  const existingMax = await getExistingMaxBarcodeNumber(connection, config.prefix);
  const nextNumber = Math.max(sequenceNumber, existingMax) + 1;

  if (nextNumber > MAX_DEPARTMENT_BARCODE_NUMBER) {
    const error = new Error(`${config.name} has reached the ${config.prefix}-999 employee-code limit. Update the department code prefix in Attendance Settings before adding another employee.`);
    error.statusCode = 409;
    throw error;
  }

  return {
    department: config.name,
    prefix: config.prefix,
    nextNumber,
    employeeCode: buildBarcodeCode(config.prefix, nextNumber),
  };
};

const allocateEmployeeBarcode = async (connection, department) => {
  const config = await findDepartmentConfig(connection, department);

  await connection.query(`
    INSERT INTO employee_barcode_sequences (department, prefix, last_number)
    VALUES (?, ?, 0)
    ON DUPLICATE KEY UPDATE department = VALUES(department)
  `, [config.name, config.prefix]);

  const [rows] = await connection.query(
    'SELECT prefix, last_number FROM employee_barcode_sequences WHERE department = ? LIMIT 1 FOR UPDATE',
    [config.name]
  );
  const current = rows[0] || { prefix: config.prefix, last_number: 0 };

  let sequenceNumber = Number(current.last_number || 0);
  if (String(current.prefix || '').toUpperCase() !== config.prefix) {
    sequenceNumber = 0;
    await connection.query(
      'UPDATE employee_barcode_sequences SET prefix = ?, last_number = 0 WHERE department = ?',
      [config.prefix, config.name]
    );
  }

  const existingMax = await getExistingMaxBarcodeNumber(connection, config.prefix);
  const nextNumber = Math.max(sequenceNumber, existingMax) + 1;
  if (nextNumber > MAX_DEPARTMENT_BARCODE_NUMBER) {
    const error = new Error(`${config.name} has reached the ${config.prefix}-999 employee-code limit. Update the department code prefix in Attendance Settings before adding another employee.`);
    error.statusCode = 409;
    throw error;
  }

  await connection.query(
    'UPDATE employee_barcode_sequences SET prefix = ?, last_number = ? WHERE department = ?',
    [config.prefix, nextNumber, config.name]
  );

  return {
    department: config.name,
    prefix: config.prefix,
    nextNumber,
    employeeCode: buildBarcodeCode(config.prefix, nextNumber),
  };
};

export const getEmployees = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const today = getManilaDateTime().date;
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const offset = (page - 1) * limit;
    const search = cleanText(req.query.search);
    const status = cleanText(req.query.status, 'all');
    const department = cleanText(req.query.department, 'all');
    const employmentType = cleanText(req.query.employmentType, 'all');
    const where = [`e.employee_status <> 'archived'`];
    const params = [];

    if (search) {
      const keyword = `%${search}%`;
      where.push(`(${buildEmployeeNameSql('e')} LIKE ? OR e.employee_code LIKE ? OR e.barcode_code LIKE ? OR e.department LIKE ?)`);
      params.push(keyword, keyword, keyword, keyword);
    }
    if (status !== 'all') { where.push('e.employee_status = ?'); params.push(status); }
    if (department !== 'all') { where.push('e.department = ?'); params.push(department); }
    if (employmentType !== 'all') { where.push('e.employment_type = ?'); params.push(employmentType); }

    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM employees e WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(`
      SELECT e.employee_id, e.employee_code, e.barcode_code, e.first_name, e.middle_name, e.last_name,
             e.department, e.position, e.employment_type, e.hire_date, e.employee_status, e.created_at, e.updated_at,
             ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e
      WHERE ${where.join(' AND ')}
      ORDER BY e.employee_status = 'active' DESC, e.last_name, e.first_name
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const employeesWithRestDays = await attachCurrentRestDays(connection, rows, today);

    const [summaryRows] = await connection.query(`
      SELECT COUNT(*) AS total,
             SUM(employee_status = 'active') AS active,
             SUM(employee_status = 'inactive') AS inactive
      FROM employees WHERE employee_status <> 'archived'
    `);
    const [existingDepartments] = await connection.query(`SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department <> '' ORDER BY department`);
    const runtime = await getAttendanceRuntimeSettings(connection);
    const departments = Array.from(new Set([...runtime.departments, ...existingDepartments.map((row) => row.department)])).sort();

    return res.json({
      success: true,
      data: employeesWithRestDays,
      departments,
      departmentConfigs: runtime.departmentConfigs,
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
      },
      pagination: {
        page, limit, total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    const [rows] = await connection.query(`
      SELECT e.employee_id, e.employee_code, e.barcode_code, e.first_name, e.middle_name, e.last_name,
             e.department, e.position, e.employment_type, e.hire_date, e.employee_status, e.created_at, e.updated_at,
             ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e WHERE e.employee_id = ? LIMIT 1
    `, [employeeId]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    const today = getManilaDateTime().date;
    const [employee] = await attachCurrentRestDays(connection, rows, today);
    return res.json({ success: true, data: employee });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const previewEmployeeBarcode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const department = cleanText(req.body.department);
    if (!department) return res.status(400).json({ message: 'Select a department first.' });
    const preview = await getBarcodePreview(connection, department);
    return res.json({
      success: true,
      message: `Next available employee code is ${preview.employeeCode}.`,
      data: {
        department: preview.department,
        prefix: preview.prefix,
        next_number: preview.nextNumber,
        employee_code: preview.employeeCode,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const createEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const payload = normalizePayload(req.body);
    validatePayload(payload, { requireCompensation: true });
    const actorId = req.authUser?.id || null;
    const today = getManilaDateTime().date;

    await connection.beginTransaction();
    const employeeCode = await allocateEmployeeBarcode(connection, payload.department);
    const attendanceBarcode = await generateUniqueAttendanceBarcode(connection);
    const [result] = await connection.query(`
      INSERT INTO employees (
        employee_code, barcode_code, first_name, middle_name, last_name, department,
        position, employment_type, hire_date, monthly_salary, rice_allowance,
        transportation_allowance, attendance_bonus_amount, employee_status,
        created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeCode.employeeCode, attendanceBarcode, payload.firstName, payload.middleName, payload.lastName,
      employeeCode.department, payload.position, payload.employmentType, today, payload.monthlyBasicSalary,
      payload.riceAllowance, payload.transportationAllowance, payload.attendanceBonus, payload.status, actorId, actorId,
    ]);

    await createInitialEmployeeRestDays(connection, {
      employeeId: result.insertId,
      restDays: payload.restDays,
      effectiveFrom: today,
      actorId,
    });

    const initialEmploymentHistoryId = await createInitialEmploymentHistory(connection, {
      employeeId: result.insertId,
      position: payload.position,
      department: employeeCode.department,
      employmentType: payload.employmentType,
      monthlyBasicSalary: payload.monthlyBasicSalary,
      riceAllowance: payload.riceAllowance,
      transportationAllowance: payload.transportationAllowance,
      attendanceBonus: payload.attendanceBonus,
      effectiveFrom: today,
      actorId,
      reason: 'Initial employment and compensation record created with the employee.',
    });

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create', module: 'Employees', entityType: 'employee', entityId: String(result.insertId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Created employee',
      description: `Created employee ${payload.firstName} ${payload.lastName} with employee code ${employeeCode.employeeCode} and a separate 10-digit attendance barcode.`,
      metadata: {
        employeeCode: employeeCode.employeeCode,
        attendanceBarcode,
        employeeCodePrefix: employeeCode.prefix,
        department: employeeCode.department,
        position: payload.position,
        employmentType: payload.employmentType,
        monthlyBasicSalary: payload.monthlyBasicSalary,
        riceAllowance: payload.riceAllowance,
        transportationAllowance: payload.transportationAllowance,
        attendanceBonus: payload.attendanceBonus,
        employmentHistoryId: initialEmploymentHistoryId,
        restDays: payload.restDays,
        restDaysLabel: formatRestDays(payload.restDays),
        restDaysEffectiveFrom: today,
      },
    });
    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `Employee created successfully. Employee code: ${employeeCode.employeeCode}. Attendance barcode is ready to print.`,
      employee_id: result.insertId,
      data: {
        employee_id: result.insertId,
        employee_code: employeeCode.employeeCode,
        barcode_code: attendanceBarcode,
        department: employeeCode.department,
        position: payload.position,
        employment_type: payload.employmentType,
        rest_days: payload.restDays,
        rest_days_effective_from: today,
        full_name: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' '),
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const updateEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    const payload = normalizePayload(req.body);
    validatePayload(payload);
    const actorId = req.authUser?.id || null;
    const today = getManilaDateTime().date;

    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE', [employeeId]);
    if (!rows[0]) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });

    const restDaysEffectiveFrom = payload.restDaysEffectiveFrom || today;
    const hireDate = String(rows[0].hire_date || today).slice(0, 10);
    if (restDaysEffectiveFrom < hireDate) {
      throw Object.assign(new Error('Rest Day effective date cannot be before the employee hire date.'), { statusCode: 400 });
    }
    if (restDaysEffectiveFrom > today) {
      throw Object.assign(new Error('Rest Day effective date cannot be in the future.'), { statusCode: 400 });
    }

    const restDayChange = await replaceEmployeeRestDays(connection, {
      employeeId,
      restDays: payload.restDays,
      effectiveFrom: restDaysEffectiveFrom,
      actorId,
    });

    await connection.query(`
      UPDATE employees SET first_name = ?, middle_name = ?, last_name = ?,
        employee_status = ?, updated_by_user_id = ?
      WHERE employee_id = ?
    `, [payload.firstName, payload.middleName, payload.lastName, payload.status, actorId, employeeId]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Updated employee',
      description: `Updated employee ${payload.firstName} ${payload.lastName}. Employee code and attendance barcode were preserved; the employment/compensation record was also preserved.`,
      metadata: {
        employeeCode: rows[0].employee_code,
        attendanceBarcode: rows[0].barcode_code,
        department: rows[0].department,
        position: rows[0].position,
        employmentType: rows[0].employment_type,
        compensationPreserved: true,
        previousRestDays: restDayChange.previous,
        restDays: restDayChange.current,
        restDaysEffectiveFrom: restDayChange.effectiveFrom,
        restDaysChanged: restDayChange.changed,
      },
    });
    await connection.commit();
    return res.json({
      success: true,
      message: restDayChange.changed
        ? `Employee updated successfully. Rest Days are effective ${restDayChange.effectiveFrom}. Existing employee code and attendance barcode were preserved.`
        : 'Employee updated successfully. Existing employee code and attendance barcode were preserved.',
      data: {
        employee_code: rows[0].employee_code,
        barcode_code: rows[0].barcode_code,
        rest_days: restDayChange.current,
        rest_days_effective_from: restDayChange.effectiveFrom,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const regenerateEmployeeAttendanceBarcode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ message: 'Select a valid employee.' });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query(`
      SELECT employee_id, employee_code, barcode_code, ${buildEmployeeNameSql('employees')} AS full_name
      FROM employees
      WHERE employee_id = ? AND employee_status <> 'archived'
      LIMIT 1
      FOR UPDATE
    `, [employeeId]);
    const employee = rows[0];
    if (!employee) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });

    const previousBarcode = employee.barcode_code || null;
    let barcodeCode = await generateUniqueAttendanceBarcode(connection, { excludeEmployeeId: employeeId });
    while (previousBarcode && barcodeCode === previousBarcode) {
      barcodeCode = await generateUniqueAttendanceBarcode(connection, { excludeEmployeeId: employeeId });
    }

    await connection.query(
      'UPDATE employees SET barcode_code = ?, updated_by_user_id = ? WHERE employee_id = ?',
      [barcodeCode, req.authUser?.id || null, employeeId]
    );

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employees',
      entityType: 'employee',
      entityId: String(employeeId),
      entityLabel: employee.full_name,
      title: 'Regenerated attendance barcode',
      description: `Regenerated the attendance barcode for ${employee.full_name}. The employee code ${employee.employee_code} was preserved.`,
      metadata: {
        employeeCode: employee.employee_code,
        previousAttendanceBarcode: previousBarcode,
        attendanceBarcode: barcodeCode,
      },
    });

    await connection.commit();
    return res.json({
      success: true,
      message: 'Attendance barcode regenerated. The previous printed barcode will no longer work.',
      data: { employee_id: employeeId, employee_code: employee.employee_code, barcode_code: barcodeCode },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateEmployeeStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    const status = statuses.has(String(req.body.employee_status)) ? String(req.body.employee_status) : null;
    if (!status) return res.status(400).json({ message: 'Select Active or Inactive.' });
    const [rows] = await connection.query(`SELECT employee_code, ${buildEmployeeNameSql('employees')} AS full_name FROM employees WHERE employee_id = ? LIMIT 1`, [employeeId]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    await connection.query('UPDATE employees SET employee_status = ?, updated_by_user_id = ? WHERE employee_id = ?', [status, req.authUser?.id || null, employeeId]);
    await writeAuditLog(connection, req, {
      actor: req.authUser, action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: rows[0].full_name, title: 'Changed employee status', description: `${rows[0].full_name} is now ${status}.`,
    });
    return res.json({ success: true, message: `Employee is now ${status}.`, status });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};


const changeTypeTitle = (changeType) => ({
  promotion: 'Promotion',
  salary_increase: 'Salary Increase',
  position_change: 'Position Change',
  department_transfer: 'Department Transfer',
  employment_status_change: 'Employment Status Change',
  allowance_adjustment: 'Allowance Adjustment',
  demotion: 'Demotion',
  other: 'Employment Change',
}[changeType] || 'Employment Change');

export const getEmployeeEmploymentHistoryDetails = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ message: 'Select a valid employee.' });
    }

    const [employeeRows] = await connection.query(`
      SELECT e.employee_id, e.employee_code, e.first_name, e.middle_name, e.last_name,
             e.department, e.position, e.employment_type, e.hire_date, e.employee_status,
             ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e
      WHERE e.employee_id = ? AND e.employee_status <> 'archived'
      LIMIT 1
    `, [employeeId]);
    if (!employeeRows[0]) return res.status(404).json({ message: 'Employee not found.' });

    const history = await getEmployeeEmploymentHistory(connection, employeeId);
    const current = history.find((item) => !item.effective_to) || history[0] || null;
    return res.json({ success: true, employee: mapEmployee(employeeRows[0]), current, history });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createEmployeeEmploymentChange = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const employeeId = Number(req.params.employeeId);
    const actorId = req.authUser?.id || null;
    const today = getManilaDateTime().date;
    const requestedDepartment = cleanText(req.body?.department);
    if (requestedDepartment) await findDepartmentConfig(connection, requestedDepartment);

    await connection.beginTransaction();
    const change = await applyEmploymentChange(connection, {
      employeeId,
      payload: req.body,
      actorId,
      today,
    });

    const [employeeRows] = await connection.query(`
      SELECT ${buildEmployeeNameSql('employees')} AS full_name, employee_code
      FROM employees WHERE employee_id = ? LIMIT 1
    `, [employeeId]);
    const employee = employeeRows[0] || {};
    const label = changeTypeTitle(change.after.change_type);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Compensation',
      entityType: 'employee_employment_history',
      entityId: String(change.after.employee_employment_history_id),
      entityLabel: employee.full_name || `Employee #${employeeId}`,
      title: label,
      description: `${label} recorded for ${employee.full_name || `employee #${employeeId}`} effective ${change.after.effective_from}. Previous employment/compensation history was preserved.`,
      metadata: {
        employeeId,
        employeeCode: employee.employee_code || null,
        changeType: change.after.change_type,
        reason: change.after.change_reason,
        effectiveFrom: change.after.effective_from,
        before: change.before,
        after: change.after,
      },
    });

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `${label} saved successfully. Previous employment and compensation history was preserved.`,
      data: change.after,
      before: change.before,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

