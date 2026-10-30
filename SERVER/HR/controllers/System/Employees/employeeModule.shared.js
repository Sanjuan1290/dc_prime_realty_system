
export const cleanText = (value, fallback = '') => {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
};

export const nullableText = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

export const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

export const timeOnly = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

export const buildEmployeeNameSql = (alias = 'employees') => (
  `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`
);

// Batch 6: schema is created ONLY by Batch 5 SQL migrations.
// Never create, alter or backfill tables during an HR HTTP request.
export const ensureEmployeeModuleTables = async (connection) => {
  await connection.query('SELECT employee_id FROM employees LIMIT 0');
  await connection.query('SELECT employee_attendance_id FROM employee_attendance_records LIMIT 0');
  await connection.query('SELECT employee_employment_history_id FROM employee_employment_history LIMIT 0');
};
