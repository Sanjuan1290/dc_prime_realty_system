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
  const [[latest]] = await connection.query("SELECT COALESCE(MAX(event_revision),0) AS revision FROM hr_outbox_events WHERE aggregate_type='employee_payroll' AND aggregate_id=? AND event_type IN ('salary.cash_released.v1','salary.cash_reversed.v1')",[payrollKey]);
  const revision=Number(latest.revision)+1;
  if(revision%2!==1)throw new Error('The preceding salary release has not been reversed.');
  if(revision>1){
    const [[previous]]=await connection.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.cash_date')) AS cash_date FROM hr_outbox_events WHERE aggregate_type='employee_payroll' AND aggregate_id=? AND event_revision=? AND event_type='salary.cash_reversed.v1'",[payrollKey,revision-1]);
    if(!previous||cashDate<previous.cash_date)throw Object.assign(new Error('The new release date cannot precede its prior reversal.'),{code:'PAYROLL_RELEASE_BEFORE_REVERSAL',statusCode:409});
  }
  const event = {
    schema_version:'1.0', event_id:randomUUID(),event_type:'salary.cash_released.v1',source_system:'hr',
    source_payroll_id:payrollKey,source_event_version:revision,cash_date:cashDate,
    recorded_at:new Date().toISOString(),currency:'PHP',amount:amount.toFixed(2),direction:'out',
    reference:`HR-PAYROLL-${payrollKey}-RELEASE-${revision}`,display_label:`Salary payment #${payrollKey}${revision===1?'':` (release ${revision})`}`,
  };
  await connection.query(`INSERT INTO hr_outbox_events
    (event_id,event_type,aggregate_type,aggregate_id,event_revision,payload_json,delivery_state)
    VALUES (?,'salary.cash_released.v1','employee_payroll',?,?,?,'pending')`,[event.event_id,payrollKey,revision,JSON.stringify(event)]);
  return event;
};

export const enqueueSalaryReversal = async(connection,payroll,cashDate)=>{
  if(Number(payroll.net_fund_release)===0)return null;
  const key=String(payroll.employee_payroll_id);
  const [[latest]]=await connection.query("SELECT event_type,event_revision,payload_json FROM hr_outbox_events WHERE aggregate_type='employee_payroll' AND aggregate_id=? AND event_type IN ('salary.cash_released.v1','salary.cash_reversed.v1') ORDER BY event_revision DESC LIMIT 1 FOR UPDATE",[key]);
  if(!latest||latest.event_type!=='salary.cash_released.v1')throw Object.assign(new Error('This release has no matching immutable cash event. Reconcile its history before undoing it.'),{code:'PAYROLL_UNDO_EVENT_REQUIRED',statusCode:409});
  const release=typeof latest.payload_json==='string'?JSON.parse(latest.payload_json):latest.payload_json;
  if(Number(release.amount)!==Number(payroll.net_fund_release)||release.cash_date!==payroll.released_date)throw Object.assign(new Error('Payroll and the original cash event disagree. Reconcile the release before undoing it.'),{code:'PAYROLL_UNDO_EVENT_MISMATCH',statusCode:409});
  const revision=Number(latest.event_revision)+1;
  const event={...release,event_id:randomUUID(),event_type:'salary.cash_reversed.v1',source_event_version:revision,cash_date:cashDate,recorded_at:new Date().toISOString(),direction:'in',reference:`HR-PAYROLL-${key}-REVERSAL-${revision}`,display_label:`Salary reversal #${key} (event ${revision})`};
  await connection.query("INSERT INTO hr_outbox_events(event_id,event_type,aggregate_type,aggregate_id,event_revision,payload_json,delivery_state) VALUES(?,'salary.cash_reversed.v1','employee_payroll',?,?,?,'pending')",[event.event_id,key,revision,JSON.stringify(event)]);
  return event;
};
