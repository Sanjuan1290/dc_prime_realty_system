import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { buildEmployeeNameSql, cleanText, nullableText } from './employeeModule.shared.js';
import { ensureAttendanceLiteSchema, getAttendanceRuntimeSettings, getManilaDateTime } from './attendanceLite.shared.js';

const employmentTypes = new Set(['regular', 'probationary', 'part_time']);
const statuses = new Set(['active', 'inactive']);
const MAX_DEPARTMENT_BARCODE_NUMBER = 999;

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'That employee barcode is already assigned. Please generate the barcode again.';
  return error?.message || 'Employee operation failed.';
};

const normalizePayload = (body = {}) => ({
  firstName: cleanText(body.first_name),
  middleName: nullableText(body.middle_name),
  lastName: cleanText(body.last_name),
  department: cleanText(body.department),
  employmentType: employmentTypes.has(String(body.employment_type)) ? String(body.employment_type) : 'regular',
  status: statuses.has(String(body.employee_status)) ? String(body.employee_status) : 'active',
});

const validatePayload = (payload) => {
  if (!payload.firstName || !payload.lastName || !payload.department) {
    const error = new Error('First name, last name, and department are required.');
    error.statusCode = 400;
    throw error;
  }
};

const mapEmployee = (row) => ({
  ...row,
  barcode_code: row.employee_code,
  employment_label: row.employment_type === 'part_time' ? 'Part Time' : row.employment_type === 'probationary' ? 'Probationary' : 'Full Time',
});

const findDepartmentConfig = async (connection, department) => {
  const runtime = await getAttendanceRuntimeSettings(connection);
  const config = runtime.departmentConfigs.find((item) => item.name.toLowerCase() === String(department || '').trim().toLowerCase());
  if (!config) {
    const error = new Error('Select a configured department before generating an employee barcode. Department barcode prefixes are managed in System Settings.');
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
    const error = new Error(`${config.name} has reached the ${config.prefix}-999 barcode limit. Update the department barcode prefix in System Settings before adding another employee.`);
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
    const error = new Error(`${config.name} has reached the ${config.prefix}-999 barcode limit. Update the department barcode prefix in System Settings before adding another employee.`);
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

export const previewEmployeeBarcode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const department = cleanText(req.body.department);
    if (!department) return res.status(400).json({ message: 'Select a department first.' });
    const preview = await getBarcodePreview(connection, department);
    return res.json({
      success: true,
      message: `Next available barcode is ${preview.employeeCode}.`,
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
    validatePayload(payload);
    const actorId = req.authUser?.id || null;
    const today = getManilaDateTime().date;

    await connection.beginTransaction();
    const barcode = await allocateEmployeeBarcode(connection, payload.department);
    const [result] = await connection.query(`
      INSERT INTO employees (
        employee_code, first_name, middle_name, last_name, department,
        position, employment_type, hire_date, employee_status, created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, 'Employee', ?, ?, ?, ?, ?)
    `, [
      barcode.employeeCode, payload.firstName, payload.middleName, payload.lastName,
      barcode.department, payload.employmentType, today, payload.status, actorId, actorId,
    ]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create', module: 'Employees', entityType: 'employee', entityId: String(result.insertId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Created employee',
      description: `Created employee ${payload.firstName} ${payload.lastName} with generated barcode ${barcode.employeeCode}.`,
      metadata: { barcode: barcode.employeeCode, barcodePrefix: barcode.prefix, department: barcode.department, employmentType: payload.employmentType },
    });
    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `Employee created successfully with barcode ${barcode.employeeCode}.`,
      employee_id: result.insertId,
      data: {
        employee_id: result.insertId,
        employee_code: barcode.employeeCode,
        department: barcode.department,
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

    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE', [employeeId]);
    if (!rows[0]) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });
    if (payload.department !== rows[0].department) await findDepartmentConfig(connection, payload.department);

    await connection.query(`
      UPDATE employees SET first_name = ?, middle_name = ?, last_name = ?,
        department = ?, employment_type = ?, employee_status = ?, updated_by_user_id = ?
      WHERE employee_id = ?
    `, [payload.firstName, payload.middleName, payload.lastName, payload.department, payload.employmentType, payload.status, actorId, employeeId]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update', module: 'Employees', entityType: 'employee', entityId: String(employeeId),
      entityLabel: `${payload.firstName} ${payload.lastName}`,
      title: 'Updated employee',
      description: `Updated employee ${payload.firstName} ${payload.lastName}. Existing barcode ${rows[0].employee_code} was preserved.`,
      metadata: {
        barcode: rows[0].employee_code,
        previousDepartment: rows[0].department,
        department: payload.department,
        employmentType: payload.employmentType,
      },
    });
    await connection.commit();
    return res.json({ success: true, message: 'Employee updated successfully. The existing barcode was preserved.', data: { employee_code: rows[0].employee_code } });
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
