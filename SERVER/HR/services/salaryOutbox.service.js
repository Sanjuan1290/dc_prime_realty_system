import { randomUUID } from 'node:crypto';

const day = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Must be called within the SAME SQL transaction as releasePayroll(). */
export const enqueueSalaryRelease = async (connection, payroll, cashDate) => {
  const id = Number(payroll?.employee_payroll_id);
  const amount = Number(payroll?.net_fund_release);
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isFinite(amount) || amount < 0 || amount > 999999999999.99 || !day(cashDate)) {
    throw Object.assign(new Error('Cannot create salary transfer event from invalid payroll cash values.'),{ code:'HR_OUTBOX_INVALID_RELEASE', statusCode:409 });
  }
  if (String(payroll.payroll_status) !== 'released') throw new Error('A non-released payroll cannot create a cash event.');
  if (amount === 0) return null; // No cash movement; existing finance report also excludes zero amounts.
  const payrollKey = String(id);
  const event = {
    schema_version:'1.0', event_id:randomUUID(),event_type:'salary.cash_released.v1',source_system:'hr',
    source_payroll_id:payrollKey,source_event_version:1,cash_date:cashDate,
    recorded_at:new Date().toISOString(),currency:'PHP',amount:amount.toFixed(2),direction:'out',
    reference:`HR-PAYROLL-${payrollKey}-RELEASE-1`,display_label:`Salary payment #${payrollKey}`,
  };
  await connection.query(`INSERT INTO hr_outbox_events
    (event_id,event_type,aggregate_type,aggregate_id,event_revision,payload_json,delivery_state)
    VALUES (?,'salary.cash_released.v1','employee_payroll',?,1,?,'pending')`,[event.event_id,payrollKey,JSON.stringify(event)]);
  return event;
};
