import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import {
  buildEmployeeNameSql,
  cleanText,
  dateOnly,
  ensureEmployeeModuleTables,
  nullableText,
  positiveNumber,
  roundMoney,
  upsertEmployeeSchedules,
} from './employeeModule.shared.js';

const validEmploymentTypes = new Set(['regular', 'probationary', 'contractual', 'part_time', 'intern']);
const validStatuses = new Set(['active', 'inactive', 'archived']);
const errorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Employee code or email already exists.';
  return error?.message || 'Employee operation failed.';
};

const normalizePayload = (body = {}) => ({
  linkedUserId: body.linked_user_id ? Number(body.linked_user_id) : null,
  employeeCode: cleanText(body.employee_code).toUpperCase(),
  firstName: cleanText(body.first_name),
  middleName: nullableText(body.middle_name),
  lastName: cleanText(body.last_name),
  email: nullableText(body.email)?.toLowerCase() || null,
  contactNumber: nullableText(body.contact_number),
  address: nullableText(body.address),
  department: nullableText(body.department),
  position: cleanText(body.position),
  employmentType: validEmploymentTypes.has(body.employment_type) ? body.employment_type : 'regular',
  hireDate: dateOnly(body.hire_date),
  monthlySalary: roundMoney(positiveNumber(body.monthly_salary)),
  payrollDivisor: Math.max(positiveNumber(body.payroll_divisor, 26), 1),
  graceMinutes: Math.min(Math.max(Math.trunc(positiveNumber(body.attendance_grace_minutes)), 0), 180),
  status: validStatuses.has(body.employee_status) ? body.employee_status : 'active',
  schedules: body.schedules,
  work_days: body.work_days,
  shift_start: body.shift_start,
  shift_end: body.shift_end,
  break_minutes: body.break_minutes,
});

const getNextEmployeeCode = async (connection) => {
  const [rows] = await connection.query('SELECT COALESCE(MAX(employee_id), 0) + 1 AS next_id FROM employees');
  return `EMP-${String(Number(rows[0]?.next_id || 1)).padStart(4, '0')}`;
};

const hydrateSchedules = async (connection, employees) => {
  const ids = employees.map((employee) => Number(employee.employee_id)).filter(Boolean);
  if (!ids.length) return employees.map((employee) => ({ ...employee, schedules: [], work_days: [] }));
  const [schedules] = await connection.query(
    `SELECT * FROM employee_work_schedules WHERE employee_id IN (${ids.map(() => '?').join(',')}) ORDER BY employee_id, weekday`,
    ids
  );
  const byEmployee = new Map();
  for (const schedule of schedules) {
    if (!byEmployee.has(Number(schedule.employee_id))) byEmployee.set(Number(schedule.employee_id), []);
    byEmployee.get(Number(schedule.employee_id)).push({
      ...schedule,
      is_work_day: Boolean(schedule.is_work_day),
    });
  }
  return employees.map((employee) => {
    const employeeSchedules = byEmployee.get(Number(employee.employee_id)) || [];
    return {
      ...employee,
      monthly_salary: Number(employee.monthly_salary || 0),
      payroll_divisor: Number(employee.payroll_divisor || 26),
      attendance_grace_minutes: Number(employee.attendance_grace_minutes || 0),
      schedules: employeeSchedules,
      work_days: employeeSchedules.filter((schedule) => schedule.is_work_day).map((schedule) => Number(schedule.weekday)),
    };
  });
};

export const getEmployees = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const offset = (page - 1) * limit;
    const search = cleanText(req.query.search);
    const status = cleanText(req.query.status, 'all');
    const department = cleanText(req.query.department, 'all');
    const employmentType = cleanText(req.query.employmentType, 'all');

    const where = ['1 = 1'];
    const params = [];
    if (search) {
      const keyword = `%${search}%`;
      where.push(`(${buildEmployeeNameSql('e')} LIKE ? OR e.employee_code LIKE ? OR e.position LIKE ? OR e.department LIKE ? OR e.email LIKE ?)`);
      params.push(keyword, keyword, keyword, keyword, keyword);
    }
    if (status !== 'all') {
      where.push('e.employee_status = ?');
      params.push(status);
    }
    if (department !== 'all') {
      where.push('e.department = ?');
      params.push(department);
    }
    if (employmentType !== 'all') {
      where.push('e.employment_type = ?');
      params.push(employmentType);
    }

    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM employees e WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(
      `
        SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name,
          TRIM(CONCAT_WS(' ', creator.first_name, creator.middle_name, creator.last_name)) AS created_by_name
        FROM employees e
        LEFT JOIN users creator ON creator.id = e.created_by_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.employee_status = 'active' DESC, e.last_name, e.first_name
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );
    const data = await hydrateSchedules(connection, rows);

    const [summaryRows] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(employee_status = 'active') AS active,
        SUM(employee_status = 'inactive') AS inactive,
        SUM(employee_status = 'archived') AS archived,
        COALESCE(SUM(CASE WHEN employee_status = 'active' THEN monthly_salary ELSE 0 END), 0) AS monthly_payroll,
        SUM(hire_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_this_month
      FROM employees
    `);
    const [departmentRows] = await connection.query(`SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department <> '' ORDER BY department`);

    return res.json({
      success: true,
      data,
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
        archived: Number(summaryRows[0]?.archived || 0),
        monthlyPayroll: Number(summaryRows[0]?.monthly_payroll || 0),
        newThisMonth: Number(summaryRows[0]?.new_this_month || 0),
      },
      departments: departmentRows.map((row) => row.department),
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) {
    return res.status(500).json({ message: errorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const employeeId = Number(req.params.employeeId);
    const [rows] = await connection.query(`SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name FROM employees e WHERE e.employee_id = ? LIMIT 1`, [employeeId]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    const [employee] = await hydrateSchedules(connection, rows);
    return res.json({ success: true, data: employee });
  } catch (error) {
    return res.status(500).json({ message: errorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const payload = normalizePayload(req.body);
    if (!payload.firstName || !payload.lastName || !payload.position || !payload.hireDate) {
      return res.status(400).json({ message: 'First name, last name, position, and hire date are required.' });
    }
    if (payload.monthlySalary <= 0) return res.status(400).json({ message: 'Monthly salary must be greater than zero.' });

    await connection.beginTransaction();
    if (!payload.employeeCode) payload.employeeCode = await getNextEmployeeCode(connection);
    const actorId = req.authUser?.id || null;
    const [result] = await connection.query(
      `
        INSERT INTO employees (
          linked_user_id, employee_code, first_name, middle_name, last_name, email,
          contact_number, address, department, position, employment_type, hire_date,
          monthly_salary, payroll_divisor, attendance_grace_minutes, employee_status,
          created_by_user_id, updated_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.linkedUserId, payload.employeeCode, payload.firstName, payload.middleName, payload.lastName,
        payload.email, payload.contactNumber, payload.address, payload.department, payload.position,
        payload.employmentType, payload.hireDate, payload.monthlySalary, payload.payrollDivisor,
        payload.graceMinutes, payload.status, actorId, actorId,
      ]
    );
    await upsertEmployeeSchedules(connection, result.insertId, payload);
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create', module: 'Employees', entityType: 'employee', entityId: String(result.insertId),
      entityLabel: `${payload.firstName} ${payload.lastName}`, title: 'Created employee',
      description: `Created employee ${payload.employeeCode} - ${payload.firstName} ${payload.lastName}.`,
      metadata: { position: payload.position, department: payload.department, monthlySalary: payload.monthlySalary },
    });
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Employee added successfully.', employeeId: result.insertId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: errorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const employeeId = Number(req.params.employeeId);
    const payload = normalizePayload(req.body);
    if (!employeeId) return res.status(400).json({ message: 'Invalid employee id.' });
    if (!payload.firstName || !payload.lastName || !payload.position || !payload.hireDate) {
      return res.status(400).json({ message: 'First name, last name, position, and hire date are required.' });
    }
    if (payload.monthlySalary <= 0) return res.status(400).json({ message: 'Monthly salary must be greater than zero.' });

    await connection.beginTransaction();
    const [currentRows] = await connection.query('SELECT * FROM employees WHERE employee_id = ? LIMIT 1', [employeeId]);
    if (!currentRows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Employee not found.' });
    }
    const employeeCode = payload.employeeCode || currentRows[0].employee_code;
    await connection.query(
      `
        UPDATE employees SET
          linked_user_id = ?, employee_code = ?, first_name = ?, middle_name = ?, last_name = ?, email = ?,
          contact_number = ?, address = ?, department = ?, position = ?, employment_type = ?, hire_date = ?,
          monthly_salary = ?, payroll_divisor = ?, attendance_grace_minutes = ?, employee_status = ?, updated_by_user_id = ?
        WHERE employee_id = ?
      `,
      [
        payload.linkedUserId, employeeCode, payload.firstName, payload.middleName, payload.lastName,
        payload.email, payload.contactNumber, payload.address, payload.department, payload.position,
        payload.employmentType, payload.hireDate, payload.monthlySalary, payload.payrollDivisor,
        payload.graceMinutes, payload.status, req.authUser?.id || null, employeeId,
      ]
    );
    await upsertEmployeeSchedules(connection, employeeId, payload);
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: `${payload.firstName} ${payload.lastName}`, title: 'Updated employee',
      description: `Updated employee ${employeeCode}.`,
      metadata: {
        previousMonthlySalary: Number(currentRows[0].monthly_salary || 0),
        monthlySalary: payload.monthlySalary,
        status: payload.status,
      },
    });
    await connection.commit();
    return res.json({ success: true, message: 'Employee saved successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: errorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateEmployeeStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const employeeId = Number(req.params.employeeId);
    const status = validStatuses.has(req.body.employee_status) ? req.body.employee_status : null;
    if (!employeeId || !status) return res.status(400).json({ message: 'Employee and valid status are required.' });
    const [rows] = await connection.query(`SELECT employee_code, ${buildEmployeeNameSql('employees')} AS full_name, employee_status FROM employees WHERE employee_id = ? LIMIT 1`, [employeeId]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    await connection.query('UPDATE employees SET employee_status = ?, updated_by_user_id = ? WHERE employee_id = ?', [status, req.authUser?.id || null, employeeId]);
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: rows[0].full_name, title: 'Changed employee status',
      description: `${rows[0].employee_code} changed from ${rows[0].employee_status} to ${status}.`,
      metadata: { previousStatus: rows[0].employee_status, status },
    });
    return res.json({ success: true, message: `Employee status changed to ${status}.`, status });
  } catch (error) {
    return res.status(500).json({ message: errorMessage(error) });
  } finally {
    connection.release();
  }
};
