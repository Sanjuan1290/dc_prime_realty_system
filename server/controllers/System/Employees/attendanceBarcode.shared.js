import crypto from 'node:crypto';

export const ATTENDANCE_BARCODE_LENGTH = 10;
export const ATTENDANCE_BARCODE_BODY_LENGTH = ATTENDANCE_BARCODE_LENGTH - 1;

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

export const computeAttendanceBarcodeCheckDigit = (body) => {
  const clean = digitsOnly(body);
  if (clean.length !== ATTENDANCE_BARCODE_BODY_LENGTH) {
    throw new Error(`Attendance barcode body must contain exactly ${ATTENDANCE_BARCODE_BODY_LENGTH} digits.`);
  }

  let sum = 0;
  let positionFromRight = 1;
  for (let index = clean.length - 1; index >= 0; index -= 1, positionFromRight += 1) {
    let digit = Number(clean[index]);
    if (positionFromRight % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
};

export const buildAttendanceBarcode = (body) => {
  const clean = digitsOnly(body).padStart(ATTENDANCE_BARCODE_BODY_LENGTH, '0').slice(-ATTENDANCE_BARCODE_BODY_LENGTH);
  return `${clean}${computeAttendanceBarcodeCheckDigit(clean)}`;
};

export const isValidAttendanceBarcode = (value) => {
  const clean = digitsOnly(value);
  if (clean.length !== ATTENDANCE_BARCODE_LENGTH || clean !== String(value ?? '').trim()) return false;

  let sum = 0;
  let positionFromRight = 0;
  for (let index = clean.length - 1; index >= 0; index -= 1, positionFromRight += 1) {
    let digit = Number(clean[index]);
    if (positionFromRight % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

export const generateAttendanceBarcodeCandidate = () => {
  const body = String(crypto.randomInt(0, 1_000_000_000)).padStart(ATTENDANCE_BARCODE_BODY_LENGTH, '0');
  return buildAttendanceBarcode(body);
};

export const generateUniqueAttendanceBarcode = async (connection, { excludeEmployeeId = null } = {}) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateAttendanceBarcodeCandidate();
    const params = [candidate];
    let sql = 'SELECT employee_id FROM employees WHERE barcode_code = ?';
    if (excludeEmployeeId) {
      sql += ' AND employee_id <> ?';
      params.push(Number(excludeEmployeeId));
    }
    sql += ' LIMIT 1';
    const [rows] = await connection.query(sql, params);
    if (!rows.length) return candidate;
  }

  const error = new Error('Unable to generate a unique attendance barcode. Please try again.');
  error.statusCode = 503;
  throw error;
};

export const backfillMissingAttendanceBarcodes = async (connection) => {
  const [rows] = await connection.query(`
    SELECT employee_id
    FROM employees
    WHERE barcode_code IS NULL OR TRIM(barcode_code) = ''
    ORDER BY employee_id ASC
    FOR UPDATE
  `);

  for (const row of rows) {
    const barcode = await generateUniqueAttendanceBarcode(connection, { excludeEmployeeId: row.employee_id });
    await connection.query(
      'UPDATE employees SET barcode_code = ? WHERE employee_id = ? AND (barcode_code IS NULL OR TRIM(barcode_code) = \'\')',
      [barcode, row.employee_id]
    );
  }

  return rows.length;
};
