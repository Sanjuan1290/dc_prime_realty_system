const payrollError = (message, code = 'PAYROLL_RELEASE_ERROR', statusCode = 409, data = null) => Object.assign(
  new Error(message),
  { code, statusCode, data }
)

const clean = (value, maxLength = 1000) => String(value ?? '').trim().slice(0, maxLength)
const validDateOnly = (value) => {
  const date = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export const validatePayrollReleaseInput = ({ payroll, releasedByUserId, releaseDate, releaseReference, releaseNotes }) => {
  if (!payroll) throw payrollError('Employee payroll not found.', 'EMPLOYEE_PAYROLL_NOT_FOUND', 404)

  const status = String(payroll.payroll_status || '').toLowerCase()
  if (status === 'released') {
    throw payrollError('This payroll has already been marked as Released.', 'PAYROLL_ALREADY_RELEASED', 409)
  }
  if (!['finalized', 'corrected'].includes(status)) {
    throw payrollError('Only Finalized or formally Corrected payroll can be marked as Released.', 'PAYROLL_NOT_FINALIZED', 409)
  }
  if (!payroll.finalized_snapshot) {
    throw payrollError(
      'This Finalized payroll does not contain an immutable finalized snapshot and cannot be released through the controlled workflow.',
      'FINALIZED_SNAPSHOT_REQUIRED',
      409
    )
  }

  const actorId = Number(releasedByUserId || 0)
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw payrollError('Released By is required.', 'PAYROLL_RELEASE_ACTOR_REQUIRED', 400)
  }

  const normalizedDate = clean(releaseDate, 10)
  if (!validDateOnly(normalizedDate)) {
    throw payrollError('Select a valid Released Date.', 'INVALID_PAYROLL_RELEASE_DATE', 400)
  }

  return {
    releasedByUserId: actorId,
    releaseDate: normalizedDate,
    releaseReference: clean(releaseReference, 180) || null,
    releaseNotes: clean(releaseNotes, 2000) || null,
  }
}

export const releasePayroll = async (connection, input) => {
  const normalized = validatePayrollReleaseInput(input)
  const payrollId = Number(input.payroll.employee_payroll_id || 0)

  const [result] = await connection.query(`
    UPDATE employee_payrolls
    SET payroll_status = 'released',
        released_date = ?,
        released_at = CURRENT_TIMESTAMP,
        released_by_user_id = ?,
        release_reference = ?,
        release_notes = ?
    WHERE employee_payroll_id = ?
      AND payroll_status IN ('finalized','corrected')
  `, [
    normalized.releaseDate,
    normalized.releasedByUserId,
    normalized.releaseReference,
    normalized.releaseNotes,
    payrollId,
  ])

  if (Number(result?.affectedRows || 0) !== 1) {
    throw payrollError(
      'Payroll status changed before the release could be saved. Refresh the record and try again.',
      'PAYROLL_RELEASE_CONFLICT',
      409
    )
  }

  return normalized
}

