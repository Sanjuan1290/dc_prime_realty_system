import {randomUUID} from 'node:crypto';
import {getPool,withTransaction} from './db.js';
import {problem} from './domain.js';
import {audit} from './ledger.js';
import {summarizeUndo} from './importPolicy.js';
import {verifyPassword} from './passwords.js';
import {sendUndoVerificationEmail,undoVerificationEmailSettings} from './importUndoEmail.js';
import {
  UNDO_CODE_MAX_ATTEMPTS,
  UNDO_CODE_TTL_SECONDS,
  UNDO_CODE_SEND_LIMIT,
  UNDO_CODE_SEND_WINDOW_MINUTES,
  createUndoVerificationCode,
  hashUndoReviewToken,
  hashUndoVerificationCode,
  isUndoLocked,
  maskEmail,
  undoSecondsRemaining,
  validUndoAuthorizationId,
  verifyUndoVerificationCode,
} from './importUndoVerification.js';

export function validateBatchId(id){
  if(!/^[0-9a-f-]{36}$/.test(String(id)))throw problem('INVALID_BATCH','Choose a valid import.',400);
}
export async function lockImports(conn){
  // One short transaction at a time prevents overlapping commit/undo operations
  // from observing each other's uncommitted receipts or undoing shared payments.
  const [[lock]]=await conn.execute('SELECT id FROM finance_import_mutex WHERE id=1 FOR UPDATE');
  if(!lock)throw problem('IMPORT_NOT_READY','Imports are initializing. Please try again shortly.',503);
}
async function selectImpact(conn,batch,{lock=false}={}){
  const [rows]=await conn.execute(`SELECT t.id,t.status,t.kind,t.amount,t.source_system,t.source_transaction_id,t.source_revision_sha256,
    (t.source_system='hr' OR EXISTS(SELECT 1 FROM finance_import_items provenance JOIN finance_import_batches pb ON pb.id=provenance.batch_id WHERE provenance.transaction_id=t.id AND pb.status IN ('committed','undone') AND JSON_UNQUOTE(JSON_EXTRACT(pb.manifest_json,'$.salary_source'))='external')) AS external_salary,
    (SELECT COUNT(DISTINCT b.id) FROM finance_import_items other_item JOIN finance_import_batches b ON b.id=other_item.batch_id
      WHERE other_item.transaction_id=t.id AND b.status='committed' AND b.id<>?) AS other_imports
    FROM finance_transactions t WHERE t.id IN (
      SELECT transaction_id FROM finance_import_items WHERE batch_id=? AND transaction_id IS NOT NULL)
    ORDER BY t.id${lock?' FOR UPDATE':''}`,[batch.id,batch.id]);
  const removing=new Set(rows.filter(row=>row.status==='posted'&&!Number(row.other_imports)).map(row=>String(row.id)));
  for(const row of rows){
    if(!removing.has(String(row.id))||!row.external_salary)continue;
    const identity=/^salary:([1-9]\d*)(?::([1-9]\d*))?$/.exec(row.source_transaction_id);
    if(!identity)continue;
    const next='salary:'+identity[1]+':'+(Number(identity[2]||1)+1);
    const [[later]]=await conn.execute("SELECT id FROM finance_transactions WHERE source_system='hr' AND source_transaction_id=? AND status='posted'",[next]);
    if(later&&!removing.has(String(later.id)))throw problem('SALARY_DEPENDENT_IMPORT','Undo the later salary reversal or release import first. Its preceding payment must remain until then.',409);
  }
  return {rows,preview:summarizeUndo(batch,rows)};
}

const batchUndoTimingSql = `CASE WHEN committed_at IS NULL OR UTC_TIMESTAMP() >= DATE_ADD(committed_at, INTERVAL 24 HOUR) THEN 1 ELSE 0 END`;
const batchUndoSecondsSql = `CASE WHEN committed_at IS NULL THEN 0 ELSE GREATEST(0,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),DATE_ADD(committed_at, INTERVAL 24 HOUR))) END`;

export async function previewUndoImport(id,pool=getPool()){
  validateBatchId(id);const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[batch]]=await conn.execute(`SELECT id,file_name,status,committed_at,${batchUndoTimingSql} AS undo_locked,${batchUndoSecondsSql} AS undo_seconds_remaining,
      CASE WHEN committed_at IS NULL THEN NULL ELSE DATE_ADD(committed_at, INTERVAL 24 HOUR) END AS undo_available_until
      FROM finance_import_batches WHERE id=?`,[id]);
    if(!batch)throw problem('NOT_FOUND','Import not found.',404);
    if(batch.status!=='committed')throw problem('IMPORT_NOT_ACTIVE','This import has already been undone or is not complete.',409);
    const {preview}=await selectImpact(conn,batch);
    return {
      ...preview,
      committed_at:batch.committed_at,
      undo_locked:Number(batch.undo_locked)===1,
      undo_seconds_remaining:Number(batch.undo_seconds_remaining||0),
      undo_available_until:batch.undo_available_until,
    };
  }finally{try{await conn.rollback();}finally{conn.release();}}
}

/**
 * Re-authenticate the currently signed-in Finance Admin and email a one-use code
 * bound to this import, actor, and exact balance-impact review token.
 */
export async function requestUndoAuthorization(id,body,actor,{mailer=sendUndoVerificationEmail,settings}={}){
  validateBatchId(id);
  if(actor?.role!=='admin')throw problem('FORBIDDEN','Only a Finance Admin can authorize an old import undo.',403);
  const password=body?.current_password;
  const reviewToken=String(body?.review_token??'');
  if(typeof password!=='string'||password.length<1||password.length>128)throw problem('INVALID_ADMIN_PASSWORD','Enter your current Finance Admin password.',400);
  if(!/^[a-f0-9]{64}$/.test(reviewToken))throw problem('UNDO_REVIEW_REQUIRED','Review the balance changes before requesting an Admin Override.',409);

  const emailSettings=settings||undoVerificationEmailSettings();
  const code=createUndoVerificationCode();
  const {salt,hash}=hashUndoVerificationCode(code);
  const authorization=await withTransaction(async conn=>{
    // Use the same batch-first lock order as undoImport. This avoids a deadlock
    // between concurrent password verification and a normal/override undo.
    const [[batch]]=await conn.execute(`SELECT id,file_name,status,committed_at,${batchUndoTimingSql} AS undo_locked
      FROM finance_import_batches WHERE id=? FOR UPDATE`,[id]);
    if(!batch)throw problem('NOT_FOUND','Import not found.',404);
    if(batch.status!=='committed')throw problem('IMPORT_NOT_ACTIVE','Only completed imports can be undone.',409);
    if(Number(batch.undo_locked)!==1)throw problem('UNDO_OVERRIDE_NOT_REQUIRED','This import is still within its normal 24-hour undo window.',409);

    const [[user]]=await conn.execute(`SELECT id,email,display_name,role,password_hash,is_active FROM finance_users WHERE id=? FOR UPDATE`,[actor.id]);
    if(!user||Number(user.is_active)!==1||user.role!=='admin')throw problem('FORBIDDEN','Your Finance Admin account is no longer active or authorized.',403);
    const [[passwordAttempts]]=await conn.execute(`SELECT COUNT(*) AS total FROM finance_audit_logs
      WHERE actor_user_id=? AND action='finance.import.undo_override.password_failed'
      AND entity_type='import_batch' AND entity_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)`,[user.id,id]);
    if(Number(passwordAttempts?.total||0)>=5)throw problem('UNDO_PASSWORD_RATE_LIMITED','Too many incorrect password attempts. Wait 15 minutes before trying again.',429);
    if(!verifyPassword(password,user.password_hash)){
      await audit(conn,user.id,'finance.import.undo_override.password_failed','import_batch',id,{});
      return {password_failure:true};
    }

    const {preview}=await selectImpact(conn,batch);
    if(preview.review_token!==reviewToken)throw problem('UNDO_REVIEW_CHANGED','The payments changed since your review. Close this dialog and review the undo again.',409);

    const [[recent]]=await conn.execute(`SELECT COUNT(*) AS total FROM finance_import_undo_authorizations
      WHERE admin_user_id=? AND batch_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL ${UNDO_CODE_SEND_WINDOW_MINUTES} MINUTE)`,[user.id,id]);
    if(Number(recent?.total||0)>=UNDO_CODE_SEND_LIMIT)throw problem('UNDO_CODE_RATE_LIMITED','Too many verification codes were requested for this import. Wait 15 minutes before trying again.',429);

    await conn.execute(`UPDATE finance_import_undo_authorizations SET consumed_at=UTC_TIMESTAMP()
      WHERE batch_id=? AND admin_user_id=? AND consumed_at IS NULL`,[id,user.id]);
    const authorizationId=randomUUID();
    await conn.execute(`INSERT INTO finance_import_undo_authorizations
      (id,batch_id,admin_user_id,review_token_hash,code_salt,code_hash,expires_at,attempts,created_at)
      VALUES(?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ${UNDO_CODE_TTL_SECONDS} SECOND),0,UTC_TIMESTAMP())`,
      [authorizationId,id,user.id,hashUndoReviewToken(reviewToken),salt,hash]);
    const [[created]]=await conn.execute('SELECT expires_at FROM finance_import_undo_authorizations WHERE id=?',[authorizationId]);
    await audit(conn,user.id,'finance.import.undo_override.requested','import_batch',id,{authorization_id:authorizationId,expires_in_minutes:Math.ceil(UNDO_CODE_TTL_SECONDS/60)});
    return {id:authorizationId,email:user.email,name:user.display_name,file_name:batch.file_name,expires_at:created?.expires_at};
  });
  if(authorization?.password_failure)throw problem('INVALID_ADMIN_PASSWORD','The current Finance Admin password is incorrect.',401);

  try{
    await mailer({email:authorization.email,name:authorization.name,fileName:authorization.file_name,code,expiresMinutes:Math.ceil(UNDO_CODE_TTL_SECONDS/60)},{settings:emailSettings});
  }catch{
    await getPool().execute('UPDATE finance_import_undo_authorizations SET consumed_at=UTC_TIMESTAMP() WHERE id=? AND admin_user_id=? AND consumed_at IS NULL',[authorization.id,actor.id]);
    throw problem('UNDO_CODE_DELIVERY_FAILED','The verification email could not be sent. The code was invalidated. Check the Finance email settings and try again.',503);
  }
  return {
    authorization_id:authorization.id,
    masked_email:maskEmail(authorization.email),
    expires_at:authorization.expires_at,
    expires_in_seconds:UNDO_CODE_TTL_SECONDS,
    message:'A verification code was sent to your registered Finance Admin email.',
  };
}

export async function undoImport(id,body,actor){
  validateBatchId(id);
  if(actor?.role!=='admin')throw problem('FORBIDDEN','Only a Finance Admin can undo an import.',403);
  const reason=String(body?.reason??'').trim(),token=String(body?.review_token??'');
  const authorizationId=String(body?.authorization_id??'');
  const verificationCode=String(body?.verification_code??'').trim();
  if(reason.length<5||reason.length>500)throw problem('INVALID_REASON','Enter a reason between 5 and 500 characters.');
  if(!/^[a-f0-9]{64}$/.test(token))throw problem('UNDO_REVIEW_REQUIRED','Review the balance changes before undoing this import.',409);
  return withTransaction(async conn=>{
    await lockImports(conn);
    const [[batch]]=await conn.execute(`SELECT id,file_name,status,committed_at,undo_result_json,${batchUndoTimingSql} AS undo_locked
      FROM finance_import_batches WHERE id=? FOR UPDATE`,[id]);
    if(!batch)throw problem('NOT_FOUND','Import not found.',404);
    if(batch.status==='undone')return {batch_id:id,status:'undone',already_undone:true,result:typeof batch.undo_result_json==='string'?JSON.parse(batch.undo_result_json):batch.undo_result_json};
    if(batch.status!=='committed')throw problem('IMPORT_NOT_ACTIVE','Only completed imports can be undone.',409);
    // Re-check the current account inside the same transaction. The session
    // middleware is also checked, but this closes a role-disable race.
    const [[currentAdmin]]=await conn.execute('SELECT id,role,is_active FROM finance_users WHERE id=? FOR UPDATE',[actor.id]);
    if(!currentAdmin||Number(currentAdmin.is_active)!==1||currentAdmin.role!=='admin')throw problem('FORBIDDEN','Your Finance Admin account is no longer active or authorized.',403);
    const {rows,preview}=await selectImpact(conn,batch,{lock:true});
    if(preview.review_token!==token)throw problem('UNDO_REVIEW_CHANGED','The payments changed since your review. Close this dialog and review the undo again.',409);

    let override=null;
    if(Number(batch.undo_locked)===1){
      if(!validUndoAuthorizationId(authorizationId))throw problem('UNDO_VERIFICATION_REQUIRED','This import is older than 24 hours. Complete Admin password and email verification before undoing it.',401);
      const [[challenge]]=await conn.execute(`SELECT id,batch_id,admin_user_id,review_token_hash,code_salt,code_hash,expires_at,attempts,consumed_at,
        (expires_at>UTC_TIMESTAMP()) AS is_valid FROM finance_import_undo_authorizations WHERE id=? AND batch_id=? AND admin_user_id=? FOR UPDATE`,
        [authorizationId,id,actor.id]);
      if(!challenge||challenge.consumed_at||!Number(challenge.is_valid)||Number(challenge.attempts)>=UNDO_CODE_MAX_ATTEMPTS){
        throw problem('UNDO_VERIFICATION_EXPIRED','The Admin verification has expired or was already used. Request a new code.',401);
      }
      if(challenge.review_token_hash!==hashUndoReviewToken(token))throw problem('UNDO_VERIFICATION_MISMATCH','The balance review changed after the verification code was sent. Review the import again and request a new code.',409);
      if(!verifyUndoVerificationCode(verificationCode,challenge.code_salt,challenge.code_hash)){
        const attemptsRemaining=Math.max(0,UNDO_CODE_MAX_ATTEMPTS-Number(challenge.attempts)-1);
        await conn.execute(`UPDATE finance_import_undo_authorizations SET attempts=attempts+1,
          consumed_at=CASE WHEN attempts+1>=? THEN UTC_TIMESTAMP() ELSE consumed_at END WHERE id=?`,[UNDO_CODE_MAX_ATTEMPTS,authorizationId]);
        await audit(conn,actor.id,'finance.import.undo_override.code_failed','import_batch',id,{authorization_id:authorizationId,attempts_remaining:attemptsRemaining});
        return {authorization_failure:'UNDO_VERIFICATION_INVALID',attempts_remaining:attemptsRemaining};
      }
      override={authorization_id:authorizationId};
    }

    for(const row of rows){
      if(!['hr','realty'].includes(row.source_system))throw problem('IMPORT_CHANGED','This import contains an unexpected payment source. Review its history before continuing.',409);
      if(Number(row.other_imports)>0||row.status!=='posted')continue;
      if(!['income','expense'].includes(row.kind))throw problem('IMPORT_CHANGED','A payment has changed. Review its history before continuing.',409);
      await conn.execute("UPDATE finance_transactions SET status='void',void_reason=?,voided_by=?,voided_at=UTC_TIMESTAMP() WHERE id=? AND status='posted'",[`Import undone: ${id}`,actor.id,row.id]);
    }
    if(override){
      await conn.execute('UPDATE finance_import_undo_authorizations SET consumed_at=UTC_TIMESTAMP() WHERE id=? AND consumed_at IS NULL',[authorizationId]);
      await audit(conn,actor.id,'finance.import.undo_override.used','import_batch',id,{authorization_id:authorizationId});
    }
    const result={...preview.impact,reason,...(override?{admin_override:true,authorization_id:override.authorization_id}:{admin_override:false})};
    await conn.execute("UPDATE finance_import_batches SET status='undone',undone_by=?,undone_at=UTC_TIMESTAMP(),undo_reason=?,undo_result_json=? WHERE id=?",[actor.id,reason,JSON.stringify(result),id]);
    await audit(conn,actor.id,'finance.import.undone','import_batch',id,result);
    return {batch_id:id,status:'undone',result};
  }).then(result=>{
    if(result?.authorization_failure==='UNDO_VERIFICATION_INVALID'){
      throw problem('UNDO_VERIFICATION_INVALID',result.attempts_remaining>0?`The verification code is incorrect. ${result.attempts_remaining} attempt(s) remaining.`:'The verification code is incorrect. Request a new code.',401);
    }
    return result;
  });
}

export const importUndoPolicy = Object.freeze({isUndoLocked,undoSecondsRemaining});
