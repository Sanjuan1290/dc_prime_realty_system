import { db } from '../db/connect.js';

const endpoint = () => {
  const url = new URL(String(process.env.REALTY_FINANCE_SALARY_ENDPOINT || ''));
  if (url.pathname !== '/api/v1/internal/finance/salary-events') throw new Error('HR salary delivery endpoint must use the approved route.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('HR salary delivery requires HTTPS outside localhost.');
  return url.toString();
};

/** One row is claimed under SQL lock. Unacknowledged delivering rows become eligible after 15 minutes. */
export const claimOutboxEvent = async pool => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT event_id, payload_json, delivery_attempts FROM hr_outbox_events
      WHERE event_type='salary.cash_released.v1'
      AND (delivery_state='pending' OR
        (delivery_state='failed' AND (last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE))) OR
        (delivery_state='delivering' AND last_attempt_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)))
      ORDER BY created_at,event_id LIMIT 1 FOR UPDATE`);
    if (!rows.length) { await connection.commit(); return null; }
    const row = rows[0];
    await connection.query(`UPDATE hr_outbox_events SET delivery_state='delivering',delivery_attempts=delivery_attempts+1,last_attempt_at=NOW() WHERE event_id=?`,[row.event_id]);
    await connection.commit();
    const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
    return { event_id:row.event_id,payload };
  } catch (e) { try { await connection.rollback(); } catch {} throw e; }
  finally { connection.release(); }
};

/** At-least-once delivery: receiver makes repeated event IDs safe. */
export const deliverOne = async ({ pool = db, send = fetch } = {}) => {
  const url = endpoint();
  const token = process.env.HR_TO_REALTY_INTEGRATION_TOKEN;
  if (!token || token.length < 32) throw new Error('HR_TO_REALTY_INTEGRATION_TOKEN must be a long secret.');
  const event = await claimOutboxEvent(pool);
  if (!event) return 'empty';
  let success = false;
  try {
    const response = await send(url, { method:'POST',headers:{ 'Authorization':`Bearer ${token}`,'Content-Type':'application/json' },
      body:JSON.stringify(event.payload), signal:AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Realty salary receiver returned HTTP ${response.status}`);
    const receipt = await response.json();
    if (receipt.event_id !== event.event_id || !['recorded','already_processed'].includes(receipt.status) || receipt.success !== true) throw new Error('Realty did not acknowledge the salary event.');
    success = true;
  } catch (e) { console.error('[hr-outbox] salary delivery failed:',event.event_id,e.message); }
  await pool.query('UPDATE hr_outbox_events SET delivery_state=?,delivered_at=IF(?=\'delivered\',NOW(),NULL) WHERE event_id=? AND delivery_state=\'delivering\'', [success?'delivered':'failed',success?'delivered':'failed',event.event_id]);
  return success?'delivered':'failed';
};

export const startSalaryOutboxWorker = () => {
  if (process.env.HR_ENABLE_SALARY_DELIVERY !== 'true' || process.env.HR_STAGING_ONLY !== 'true' || process.env.NODE_ENV === 'production') throw new Error('Outbox worker may run only in approved HR staging.');
  let busy=false;
  const tick=async()=>{ if (busy) return;busy=true;try {await deliverOne();} catch(e){console.error('[hr-outbox]',e.code || e.message)} finally {busy=false;} };
  const interval=setInterval(tick,15000);
  interval.unref?.();
  void tick();
  return () => clearInterval(interval);
};
