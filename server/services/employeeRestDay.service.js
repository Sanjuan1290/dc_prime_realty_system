import { dateOnly } from '../controllers/System/Employees/employeeModule.shared.js';

export const REST_DAY_NAMES = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const REST_DAY_SET = new Set(REST_DAY_NAMES);
const REST_DAY_ORDER = new Map(REST_DAY_NAMES.map((day, index) => [day, index]));

export const normalizeRestDays = (value) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(new Set(
    source
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => REST_DAY_SET.has(item))
  )).sort((left, right) => REST_DAY_ORDER.get(left) - REST_DAY_ORDER.get(right));
};

export const formatRestDays = (days = []) => normalizeRestDays(days)
  .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
  .join(', ');

export const previousDate = (value) => {
  const date = dateOnly(value);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

export const getEmployeeRestDaysAsOf = async (connection, employeeIds = [], asOfDate) => {
  const ids = Array.from(new Set(employeeIds.map(Number).filter(Boolean)));
  const date = dateOnly(asOfDate);
  const result = new Map(ids.map((id) => [id, []]));
  if (!ids.length || !date) return result;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(`
    SELECT employee_id, day_of_week, effective_from, effective_to
    FROM employee_rest_day_assignments
    WHERE employee_id IN (${placeholders})
      AND effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY employee_id,
      FIELD(day_of_week, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday')
  `, [...ids, date, date]);

  for (const row of rows) {
    const employeeId = Number(row.employee_id);
    if (!result.has(employeeId)) result.set(employeeId, []);
    result.get(employeeId).push(String(row.day_of_week));
  }

  return result;
};

export const getRestDayAssignmentsForRange = async (connection, employeeIds = [], dateFrom, dateTo) => {
  const ids = Array.from(new Set(employeeIds.map(Number).filter(Boolean)));
  const from = dateOnly(dateFrom);
  const to = dateOnly(dateTo);
  if (!ids.length || !from || !to) return [];

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(`
    SELECT
      employee_rest_day_id,
      employee_id,
      day_of_week,
      effective_from,
      effective_to
    FROM employee_rest_day_assignments
    WHERE employee_id IN (${placeholders})
      AND effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY employee_id, effective_from,
      FIELD(day_of_week, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday')
  `, [...ids, to, from]);

  return rows.map((row) => ({
    ...row,
    employee_id: Number(row.employee_id),
    employee_rest_day_id: Number(row.employee_rest_day_id),
    effective_from: dateOnly(row.effective_from),
    effective_to: dateOnly(row.effective_to),
  }));
};

export const createInitialEmployeeRestDays = async (
  connection,
  { employeeId, restDays, effectiveFrom, actorId = null }
) => {
  const normalized = normalizeRestDays(restDays);
  const from = dateOnly(effectiveFrom);
  if (!employeeId || !from || !normalized.length) {
    throw Object.assign(new Error('Select at least one Rest Day.'), { statusCode: 400 });
  }

  for (const day of normalized) {
    await connection.query(`
      INSERT INTO employee_rest_day_assignments (
        employee_id, day_of_week, effective_from, effective_to,
        created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, NULL, ?, ?)
    `, [employeeId, day, from, actorId, actorId]);
  }
};

export const replaceEmployeeRestDays = async (
  connection,
  { employeeId, restDays, effectiveFrom, actorId = null }
) => {
  const normalized = normalizeRestDays(restDays);
  const from = dateOnly(effectiveFrom);
  if (!employeeId || !from || !normalized.length) {
    throw Object.assign(new Error('Select at least one Rest Day and an effective date.'), { statusCode: 400 });
  }

  const currentMap = await getEmployeeRestDaysAsOf(connection, [employeeId], from);
  const previous = normalizeRestDays(currentMap.get(Number(employeeId)) || []);
  const unchanged = previous.length === normalized.length
    && previous.every((day, index) => day === normalized[index]);

  if (unchanged) {
    return { changed: false, previous, current: normalized, effectiveFrom: from };
  }

  const endDate = previousDate(from);

  // A new effective-date change replaces any schedule changes already queued on
  // or after this date, while preserving every historical period before it.
  await connection.query(`
    DELETE FROM employee_rest_day_assignments
    WHERE employee_id = ? AND effective_from >= ?
  `, [employeeId, from]);

  await connection.query(`
    UPDATE employee_rest_day_assignments
    SET effective_to = ?, updated_by_user_id = ?
    WHERE employee_id = ?
      AND effective_from < ?
      AND (effective_to IS NULL OR effective_to >= ?)
  `, [endDate, actorId, employeeId, from, from]);

  for (const day of normalized) {
    await connection.query(`
      INSERT INTO employee_rest_day_assignments (
        employee_id, day_of_week, effective_from, effective_to,
        created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, NULL, ?, ?)
    `, [employeeId, day, from, actorId, actorId]);
  }

  return { changed: true, previous, current: normalized, effectiveFrom: from };
};

