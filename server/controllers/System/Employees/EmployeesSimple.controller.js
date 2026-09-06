import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { buildEmployeeNameSql, cleanText, nullableText } from './employeeModule.shared.js';
import { ensureAttendanceLiteSchema, getAttendanceRuntimeSettings, getManilaDateTime } from './attendanceLite.shared.js';

const employmentTypes = new Set(['regular', 'probationary', 'part_time']);
const statuses = new Set(['active', 'inactive']);

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'That barcode code is already assigned to another employee.';
  return error?.message || 'Employee operation failed.';
};

const normalizePayload = (body = {}) => ({
  employeeCode: cleanText(body.employee_code).toUpperCase(),
  firstName: cleanText(body.first_name),
  middleName: nullableText(body.middle_name),
  lastName: cleanText(body.last_name),
  department: cleanText(body.department),
  employmentType: employmentTypes.has(String(body.employment_type)) ? String(body.employment_type) : 'regular',
  status: statuses.has(String(body.employee_status)) ? String(body.employee_status) : 'active',
});

const validatePayload = (payload) => {
  if (!payload.firstName || !payload.lastName || !payload.employeeCode || !payload.department) {
    const error = new Error('First name, last name, barcode code, and department are required.');
    error.statusCode = 400;
    throw error;
  }
};

const mapEmployee = (row) => ({
  ...row,
  barcode_code: row.employee_code,
  employment_label: row.employment_type === 'part_time' ? 'Part Time' : row.employment_type === 'probationary' ? 'Probationary' : 'Full Time',
});

export const getEmployees = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
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
      where.push(`(${buildEmployeeNameSql('e')} LIKE ? OR e.employee_code LIKE ? OR e.department LIKE ?)`);
      params.push(keyword, keyword, keyword);
    }
    if (status !== 'all') { where.push('e.employee_status = ?'); params.push(status); }
    if (department !== 'all') { where.push('e.department = ?'); params.push(department); }
    if (employmentType !== 'all') { where.push('e.employment_type = ?'); params.push(employmentType); }

    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM employees e WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(`
      SELECT e.employee_id, e.employee_code, e.first_name, e.middle_name, e.last_name,
             e.department, e.employment_type, e.employee_status, e.created_at, e.updated_at,
             ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e
      WHERE ${where.join(' AND ')}
      ORDER BY e.employee_status = 'active' DESC, e.last_name, e.first_name
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

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
      data: rows.map(mapEmployee),
      departments,
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
      SELECT e.employee_id, e.employee_code, e.first_name, e.middle_name, e.last_name,
             e.department, e.employment_type, e.employee_status, e.created_at, e.updated_at,
             ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e WHERE e.employee_id = ? LIMIT 1
    `, [employeeId]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    return res.json({ success: true, data: mapEmployee(rows[0]) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const createEmployee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const payload = normalizePayload(req.body);
    validatePayload(payload);
    const actorId = req.authUser?.id || null;
    const today = getManilaDateTime().date;

    await connection.beginTransaction();
    const [result] = await connection.query(`
      INSERT INTO employees (
        employee_code, first_name, middle_name, last_name, department,
        position, employment_type, hire_date, employee_status, created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, 'Employee', ?, ?, ?, ?, ?)
    `, [
      payload.employeeCode, payload.firstName, payload.middleName, payload.lastName,
      payload.department, payload.employmentType, today, payload.status, actorId, actorId,
    ]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create', module: 'Employees', entityType: 'employee', entityId: String(result.insertId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Created employee',
      description: `Created employee ${payload.firstName} ${payload.lastName} with barcode ${payload.employeeCode}.`,
      metadata: { department: payload.department, employmentType: payload.employmentType },
    });
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Employee created successfully.', employee_id: result.insertId });
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

    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE', [employeeId]);
    if (!rows[0]) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });

    await connection.query(`
      UPDATE employees SET employee_code = ?, first_name = ?, middle_name = ?, last_name = ?,
        department = ?, employment_type = ?, employee_status = ?, updated_by_user_id = ?
      WHERE employee_id = ?
    `, [payload.employeeCode, payload.firstName, payload.middleName, payload.lastName, payload.department, payload.employmentType, payload.status, actorId, employeeId]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Updated employee',
      description: `Updated employee ${payload.firstName} ${payload.lastName}.`,
      metadata: { previousBarcode: rows[0].employee_code, barcode: payload.employeeCode, department: payload.department, employmentType: payload.employmentType },
    });
    await connection.commit();
    return res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
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
