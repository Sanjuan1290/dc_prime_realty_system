import { parseSalaryEvent, payloadHash } from './salaryEventContract.js';
const error = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });

const existingEvent = async (db, event) => {
  const [rows] = await db.query(`SELECT event_id, source_payroll_id, payload_sha256
    FROM finance_external_salary_event_inbox
    WHERE event_id=? OR (source_payroll_id=? AND source_event_version=?) LIMIT 2`,
    [event.event_id, event.source_payroll_id, event.source_event_version]);
  return rows;
};
const replyExisting = (rows, event, digest) => {
  if (!rows.length) return null;
  if (rows.length === 1 && rows[0].event_id === event.event_id && rows[0].source_payroll_id === event.source_payroll_id && rows[0].payload_sha256 === digest) return { status: 'already_processed', event_id: event.event_id };
  throw error('SALARY_EVENT_CONFLICT', 'Existing salary event identity has different financial data.');
};

/** Inbox + local expense projection commit in one Realty DB transaction. */
export const recordSalaryEvent = async (pool, raw) => {
  const event = parseSalaryEvent(raw);
  const digest = payloadHash(event);
  const db = await pool.getConnection();
  let transactionOpen = false;
  try {
    await db.beginTransaction(); transactionOpen = true;
    const duplicate = replyExisting(await existingEvent(db, event), event, digest);
    if (duplicate) { await db.commit(); transactionOpen = false; return duplicate; }
    if(event.source_event_version>1){
      const [[previous]]=await db.query('SELECT payload_json FROM finance_external_salary_event_inbox WHERE source_payroll_id=? AND source_event_version=? FOR UPDATE',[event.source_payroll_id,event.source_event_version-1]);
      if(!previous)throw error('SALARY_EVENT_PREDECESSOR_REQUIRED','The preceding salary cash event must arrive first.');
      const original=typeof previous.payload_json==='string'?JSON.parse(previous.payload_json):previous.payload_json;
      if(event.cash_date<original.cash_date||(event.event_type==='salary.cash_reversed.v1'&&event.amount!==original.amount))throw error('SALARY_EVENT_REVERSAL_MISMATCH','The reversal must match the prior release amount and cash sequence.');
    }
    await db.query(`INSERT INTO finance_external_salary_event_inbox
      (event_id,source_system,source_payroll_id,source_event_version,event_type,payload_sha256,payload_json)
      VALUES (?,'hr',?,?,?,?,?)`,
      [event.event_id,event.source_payroll_id,event.source_event_version,event.event_type,digest,JSON.stringify(event)]);
    if(event.source_event_version===1)await db.query(`INSERT INTO finance_external_salary_entries
      (event_id,source_payroll_id,cash_date,kind,amount,reference,recorded_at)
      VALUES (?,?,?,'expense',?,?,?)`,
      [event.event_id,event.source_payroll_id,event.cash_date,event.amount,event.reference,new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(event.recorded_at))]);
    await db.commit(); transactionOpen = false;
    return { status: 'recorded', event_id: event.event_id };
  } catch (e) {
    if (transactionOpen) { try { await db.rollback(); } catch {} }
    if (e?.code === 'ER_DUP_ENTRY' || Number(e?.errno) === 1062) {
      const existing = replyExisting(await existingEvent(db,event),event,digest);
      if (existing) return existing;
    }
    throw e;
  } finally { db.release(); }
};
