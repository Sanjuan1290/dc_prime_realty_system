import {createHash,createHmac,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import bcrypt from 'bcrypt';
import {db} from '../db/connect.js';
import {getPayrollDraftById} from './employeePayroll.service.js';
import {buildFundReleaseReceipt} from './payrollReceipt.service.js';
import {enqueueSalaryReversal} from './salaryOutbox.service.js';
import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';
import {getManilaDateTime} from '../controllers/System/Employees/attendanceLite.shared.js';
import {recoverySettings} from './passwordRecoveryCore.js';

const problem=(message,code='PAYROLL_UNDO_INVALID',statusCode=409)=>Object.assign(new Error(message),{code,statusCode});
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const codeHash=(id,code)=>createHmac('sha256',process.env.HR_JWT_SECRET).update(id+'\0'+code).digest('hex');
const validId=value=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw problem('Select a valid payroll.','PAYROLL_UNDO_INVALID',400);return id};
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/.test(value);

async function admin(connection,userId,password) {
  const [[user]]=await connection.query(`SELECT u.id,u.display_name_snapshot,i.login_email,i.password_hash,i.auth_version
    FROM hr_users u JOIN hr_login_identities i ON i.hr_user_id=u.id
    WHERE u.id=? AND u.account_status='active' AND i.login_state='active'
    AND EXISTS(SELECT 1 FROM hr_user_roles r WHERE r.hr_user_id=u.id AND r.role_code='hr_admin') FOR UPDATE`,[userId]);
  if(!user)throw problem('Only an active HR administrator can undo payroll.','PAYROLL_UNDO_FORBIDDEN',403);
  const valid=typeof password==='string'&&password.length>0&&password.length<=256&&await bcrypt.compare(password,user.password_hash);
  return {user,valid};
}
async function state(connection,payroll,user) {
  const [[events]]=await connection.query("SELECT COALESCE(MAX(event_revision),0) AS revision FROM hr_outbox_events WHERE aggregate_type='employee_payroll' AND aggregate_id=? AND event_type IN ('salary.cash_released.v1','salary.cash_reversed.v1')",[String(payroll.employee_payroll_id)]);
  const [[history]]=await connection.query('SELECT COALESCE(MAX(id),0) AS revision FROM hr_payroll_undo_history WHERE payroll_id=?',[payroll.employee_payroll_id]);
  return sha([payroll.employee_payroll_id,payroll.payroll_status,payroll.finalized_snapshot,payroll.finalized_at,payroll.released_date,payroll.released_at,payroll.net_fund_release,events.revision,history.revision,user.login_email,user.password_hash]);
}
function undoRequest(payroll,body) {
  if(!['finalized','corrected','released'].includes(payroll.payroll_status)||!payroll.finalized_snapshot)throw problem('Only finalized or released payroll with a saved approval can be undone.');
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(reason.length<5||reason.length>1000)throw problem('Enter an undo reason of 5–1,000 characters.','PAYROLL_UNDO_REASON_REQUIRED',400);
  let cash_date=null;
  if(payroll.payroll_status==='released') {
    if(body.cash_confirmed!==true)throw problem('Confirm that the release was recorded incorrectly or the funds were returned. An outstanding paid salary must use a separate adjustment.','PAYROLL_UNDO_CASH_CONFIRMATION',400);
    cash_date=body.cash_date;
    if(typeof cash_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(cash_date)||Number.isNaN(Date.parse(cash_date))||new Date(cash_date).toISOString().slice(0,10)!==cash_date||cash_date<payroll.released_date||cash_date>getManilaDateTime().date)throw problem('Choose a reversal date between the original release date and today.','PAYROLL_UNDO_DATE_INVALID',400);
  }
  return {reason,cash_date};
}
export async function sendPayrollUndoEmail({email,code,payrollId,employee,reason},{settings,send=fetch}) {
  const response=await send('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+settings.key,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({from:settings.from,to:[email],subject:'Confirm payroll undo — D&C Prime HR',text:`Your verification code is ${code}.\n\nUndo payroll #${payrollId} for ${employee}.\nReason: ${reason}\n\nThis code expires in 10 minutes and can be used once. If you did not request this, do not share the code. No payroll has been changed.`})});
  if(!response.ok)throw problem('The verification email could not be delivered. Request a new code.','PAYROLL_UNDO_EMAIL_FAILED',503);
}
export async function requestPayrollUndo(payrollId,userId,body,{pool=db,mailer=sendPayrollUndoEmail,settings}={}) {
  payrollId=validId(payrollId);
  const connection=await pool.getConnection();let result,delivery;
  try {
    await connection.beginTransaction();
    // The parent payroll lock serializes challenge requests, releases and undos.
    const payroll=await getPayrollDraftById(connection,payrollId,{forUpdate:true});
    const {user,valid}=await admin(connection,userId,body?.password);
    const [[rate]]=await connection.query('SELECT COUNT(*) AS n FROM hr_payroll_undo_challenges WHERE user_id=? AND requested_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)',[userId]);
    if(Number(rate.n)>=5)throw problem('Too many verification requests. Wait 15 minutes.','PAYROLL_UNDO_RATE_LIMITED',429);
    if(!valid){
      const rejected=randomUUID();
      await connection.query(`INSERT INTO hr_payroll_undo_challenges(id,payroll_id,user_id,code_hash,state_hash,identity_version,request_json,requested_at,expires_at,used_at)
        VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())`,[rejected,payrollId,userId,sha(rejected),sha(null),user.auth_version,'{}']);
      await connection.commit();
      throw problem('The administrator password is incorrect.','PAYROLL_UNDO_PASSWORD_INVALID',403);
    }
    const action=undoRequest(payroll,body),id=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0');
    const mailSettings=settings||recoverySettings('hr');
    await connection.query('UPDATE hr_payroll_undo_challenges SET used_at=UTC_TIMESTAMP() WHERE payroll_id=? AND user_id=? AND used_at IS NULL',[payrollId,userId]);
    await connection.query(`INSERT INTO hr_payroll_undo_challenges(id,payroll_id,user_id,code_hash,state_hash,identity_version,request_json,requested_at,expires_at)
      VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`,[id,payrollId,userId,codeHash(id,code),await state(connection,payroll,user),user.auth_version,JSON.stringify(action)]);
    await connection.commit();
    result={challenge_id:id,message:'A verification code was sent to your administrator email. It expires in 10 minutes.'};
    delivery={email:user.login_email,code,payrollId,employee:payroll.employee_name_snapshot,reason:action.reason,settings:mailSettings};
  }catch(error){await connection.rollback();throw error}finally{connection.release()}
  try { await mailer(delivery,{settings:delivery.settings}); }
  catch(error){await pool.query('UPDATE hr_payroll_undo_challenges SET used_at=UTC_TIMESTAMP() WHERE id=?',[result.challenge_id]);throw problem('The verification email could not be delivered. Request a new code.','PAYROLL_UNDO_EMAIL_FAILED',503)}
  return result;
}
export async function confirmPayrollUndo(payrollId,userId,body,{pool=db}={}) {
  payrollId=validId(payrollId);
  if(!uuid(body?.challenge_id)||typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw problem('Enter the six-digit email code.','PAYROLL_UNDO_CODE_INVALID',400);
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    const payroll=await getPayrollDraftById(connection,payrollId,{forUpdate:true});
    const {user,valid}=await admin(connection,userId,body.password);
    const [[challenge]]=await connection.query('SELECT *,expires_at>UTC_TIMESTAMP() AS active FROM hr_payroll_undo_challenges WHERE id=? AND payroll_id=? AND user_id=? FOR UPDATE',[body.challenge_id,payrollId,userId]);
    if(!challenge||challenge.used_at||!challenge.active||challenge.attempts>=5)throw problem('This code is expired, used or locked. Request a new code.','PAYROLL_UNDO_CODE_EXPIRED');
    if(Number(challenge.identity_version)!==Number(user.auth_version)||challenge.state_hash!==await state(connection,payroll,user))throw problem('The account or payroll changed after the code was sent. Request a new code.','PAYROLL_UNDO_STALE');
    const matches=timingSafeEqual(Buffer.from(challenge.code_hash,'hex'),Buffer.from(codeHash(challenge.id,body.code),'hex'));
    if(!valid||!matches) {
      await connection.query('UPDATE hr_payroll_undo_challenges SET attempts=attempts+1 WHERE id=?',[challenge.id]);
      await connection.commit();
      throw problem('The password or email code is incorrect. Five failed attempts lock this code.','PAYROLL_UNDO_VERIFICATION_FAILED',403);
    }
    const action=undoRequest(payroll,{...parse(challenge.request_json),cash_confirmed:true});
    const receipt=buildFundReleaseReceipt(payroll,{today:getManilaDateTime().date});
    const reversal=payroll.payroll_status==='released'?await enqueueSalaryReversal(connection,payroll,action.cash_date):null;
    const [history]=await connection.query(`INSERT INTO hr_payroll_undo_history(payroll_id,actor_user_id,actor_name,previous_status,reason,cash_date,snapshot_json,receipt_json,reversal_event_id)
      VALUES(?,?,?,?,?,?,?,?,?)`,[payrollId,userId,user.display_name_snapshot,payroll.payroll_status,action.reason,action.cash_date,JSON.stringify(payroll),JSON.stringify(receipt),reversal?.event_id||null]);
    await connection.query(`UPDATE employee_payrolls SET payroll_status='draft',finalized_snapshot_json=NULL,finalized_attendance_fingerprint=NULL,
      finalized_by_user_id=NULL,finalized_at=NULL,released_date=NULL,released_at=NULL,released_by_user_id=NULL,release_reference=NULL,release_witness_name=NULL,release_notes=NULL,calculation_version='undo-recalculation-required'
      WHERE employee_payroll_id=?`,[payrollId]);
    await connection.query('UPDATE hr_payroll_undo_challenges SET used_at=UTC_TIMESTAMP() WHERE payroll_id=? AND used_at IS NULL',[payrollId]);
    await writeAuditLog(connection,null,{actor:{id:userId,displayName:user.display_name_snapshot},action:'payroll.undone',module:'Payroll',entityType:'employee_payroll',entityId:String(payrollId),title:'Payroll returned to Draft',description:action.reason,metadata:{before:{status:payroll.payroll_status,netFundRelease:payroll.net_fund_release},after:{status:'draft',netFundRelease:payroll.net_fund_release},undoHistoryId:history.insertId,cashReversalDate:action.cash_date,financeReversalCreated:Boolean(reversal)}});
    await connection.commit();
    return {success:true,message:reversal?'Payroll returned to Draft. A salary reversal is ready for Finance export. Export the original release period and the reversal date to keep Finance complete.':'Payroll returned to Draft. Recalculate and review before finalizing again.',data:{undo_id:history.insertId,reversal_event_id:reversal?.event_id||null}};
  }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
export async function payrollUndoHistory(connection,payrollId) {
  const [rows]=await connection.query(`SELECT id,actor_name,previous_status,reason,DATE_FORMAT(cash_date,'%Y-%m-%d') AS cash_date,reversal_event_id,
    UNIX_TIMESTAMP(created_at) AS recorded_epoch FROM hr_payroll_undo_history WHERE payroll_id=? ORDER BY id DESC`,[payrollId]);
  const clock=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  return rows.map(({recorded_epoch,...row})=>({...row,recorded_at:clock.format(new Date(Number(recorded_epoch)*1000))}));
}
