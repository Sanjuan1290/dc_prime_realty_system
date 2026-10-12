// Hire-date corrections are a separate audited operation; ordinary salary and role history
// remains immutable and existing paid payroll is never recalculated silently.
const errorWithStatus = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export const normalizeHireDate = (value) => {
  const input = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input ? null : input;
};

const dateOnly = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
};

/** Runs inside the caller's transaction, after locking the employee row. */
export const correctEmployeeHireDate = async (connection, {
  employeeId, previousHireDate, newHireDate, reason, actorId, today,
}) => {
  const previous = dateOnly(previousHireDate);
  const next = normalizeHireDate(newHireDate);
  if (!next || next > today) throw errorWithStatus('Enter a valid hire date that is not in the future.');
  if (next === previous) return { changed: false, previous, current: next, hasDraft: false };
  const note = String(reason || '').trim();
  if (note.length < 5 || note.length > 500) {
    throw errorWithStatus('Enter a short reason for changing the hire date (5–500 characters).');
  }

  const [payrollRows] = await connection.query(`
    SELECT payroll_status FROM employee_payrolls
    WHERE employee_id = ? AND payroll_status IN ('finalized', 'corrected', 'released')
    LIMIT 1 FOR UPDATE
  `, [employeeId]);
  if (payrollRows.length) {
    throw errorWithStatus('Hire date cannot be changed because this employee already has finalized or released payroll. Contact an administrator for a reviewed correction.', 409);
  }

  const [attendanceRows] = await connection.query(`
    SELECT MIN(attendance_date) AS first_attendance_date
    FROM employee_attendance_records WHERE employee_id = ?
  `, [employeeId]);
  const firstAttendance = attendanceRows[0]?.first_attendance_date;
  if (firstAttendance && next > dateOnly(firstAttendance)) {
    throw errorWithStatus(`Hire date cannot be later than the first recorded attendance (${dateOnly(firstAttendance)}).`, 409);
  }

  const [historyRows] = await connection.query(`
    SELECT employee_employment_history_id, change_type, effective_from, effective_to
    FROM employee_employment_history
    WHERE employee_id = ? ORDER BY effective_from ASC, employee_employment_history_id ASC
    FOR UPDATE
  `, [employeeId]);
  const first = historyRows[0];
  if (!first || first.change_type !== 'hired' || dateOnly(first.effective_from) !== previous) {
    throw errorWithStatus('The original employment record needs a reviewed correction before changing the hire date.', 409);
  }
  if (historyRows.length > 1 && next >= dateOnly(historyRows[1].effective_from)) {
    throw errorWithStatus(`Hire date must be earlier than the next recorded employment change (${dateOnly(historyRows[1].effective_from)}).`, 409);
  }
  if (first.effective_to && next > dateOnly(first.effective_to)) {
    throw errorWithStatus('Hire date cannot be after the end of the initial employment record.', 409);
  }

  const [restRows] = await connection.query(`
    SELECT employee_rest_day_id, effective_from, effective_to
    FROM employee_rest_day_assignments
    WHERE employee_id = ? ORDER BY effective_from ASC FOR UPDATE
  `, [employeeId]);
  // The first schedule should move with the hire date, while later schedule changes stay as recorded.
  // Never retime other history or create overlapping date ranges.
  if (restRows.length) {
    const initial = restRows.filter((row) => dateOnly(row.effective_from) === previous);
    if (!initial.length || restRows.some((row) => dateOnly(row.effective_from) < previous)) {
      throw errorWithStatus('The rest-day history needs review before the hire date can be changed.', 409);
    }
    if (initial.some((row) => row.effective_to && next > dateOnly(row.effective_to))) {
      throw errorWithStatus('Hire date falls after the original rest-day schedule ended.', 409);
    }
    const later = restRows.find((row) => dateOnly(row.effective_from) > previous);
    if (later && next >= dateOnly(later.effective_from)) {
      throw errorWithStatus(`Hire date must be before the next rest-day schedule change (${dateOnly(later.effective_from)}).`, 409);
    }
    await connection.query(`
      UPDATE employee_rest_day_assignments
      SET effective_from = ?, updated_by_user_id = ?
      WHERE employee_id = ? AND effective_from = ?
    `, [next, actorId, employeeId, previous]);
  }

  await connection.query(`
    UPDATE employee_employment_history
    SET effective_from = ?, corrected_by_user_id = ?, corrected_at = NOW(), correction_reason = ?
    WHERE employee_employment_history_id = ?
  `, [next, actorId, `Hire-date correction: ${note}`, first.employee_employment_history_id]);

  const [draftRows] = await connection.query(`
    SELECT employee_payroll_id FROM employee_payrolls
    WHERE employee_id = ? AND payroll_status = 'draft' LIMIT 1
  `, [employeeId]);
  return { changed: true, previous, current: next, reason: note, hasDraft: draftRows.length > 0 };
};
