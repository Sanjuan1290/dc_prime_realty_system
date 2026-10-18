/** Archive browsing and protected, time-based deletion. Requires migration 20261018. */
import crypto from 'node:crypto';
import { bcrypt, db, getAuthenticatedUser, getErrorMessage } from '../Lot_Projects/_shared/lotProject.shared.js';
import { sendEmail } from '../../services/email.service.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { normalizeIpAddress } from '../../utils/requestIp.js';
import { redactReportMetadata } from '../../utils/auditReportValidation.js';

const PAGE = 25;
const errorWith = (message, statusCode = 403) => Object.assign(new Error(message), { statusCode });
const fail = (res, e) => res.status(e.statusCode || 500).json({ message: e.statusCode ? e.message : getErrorMessage(e) });
const parseJson = v => { try { return typeof v === 'string' ? JSON.parse(v) : (v || {}); } catch { return {}; } };
const admin = async (req, owner = false) => {
  const user = await getAuthenticatedUser(req);
  if (!user) throw errorWith('Please sign in again.',401);
  if (owner ? user.role !== 'super_admin' : !['super_admin','system_admin'].includes(user.role)) throw errorWith('Only an authorized administrator can perform this action.');
  return user;
};
const requireInstalled = async c => {
  const [[r]] = await c.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('audit_archive_settings','audit_archive_holds','audit_archive_purge_codes','audit_archive_purge_receipts')");
  if(Number(r.n)!==4)throw errorWith('Archive Management needs its database update. Please run the supplied SQL migration.',503);
};
const getSettings = async c => {
  await requireInstalled(c);
  const [[s]]=await c.query('SELECT archive_days,auto_delete_enabled FROM audit_archive_settings WHERE id=1');
  if(!s)throw errorWith('The archive settings have not been initialized.',503);
  return {archiveDays:Number(s.archive_days),autoDeleteEnabled:Boolean(s.auto_delete_enabled)};
};
const batchSql=`SELECT b.audit_log_archive_batch_id AS id,b.created_at AS archivedAt,b.record_count AS recordCount,b.export_filename AS filename,b.export_sha256 AS fileHash,b.archived_by_name AS archivedBy,
 DATE_ADD(b.created_at,INTERVAL s.archive_days DAY) AS eligibleAfter,
 (b.created_at < DATE_SUB(NOW(),INTERVAL s.archive_days DAY)) AS expired,
 EXISTS(SELECT 1 FROM audit_archive_holds h WHERE h.batch_id=b.audit_log_archive_batch_id AND h.released_at IS NULL) AS manuallyHeld,
 EXISTS(SELECT 1 FROM audit_logs_archive a WHERE a.audit_log_archive_batch_id=b.audit_log_archive_batch_id AND
  (a.entity_type IN ('audit_case','operational_review') OR JSON_EXTRACT(a.metadata_json,'$.operationalReviewId') IS NOT NULL OR JSON_EXTRACT(a.metadata_json,'$.operational_review_id') IS NOT NULL
   OR JSON_EXTRACT(a.metadata_json,'$.reviewId') IS NOT NULL OR JSON_EXTRACT(a.metadata_json,'$.review_id') IS NOT NULL OR JSON_EXTRACT(a.metadata_json,'$.auditCaseId') IS NOT NULL OR JSON_EXTRACT(a.metadata_json,'$.audit_case_id') IS NOT NULL))
 OR EXISTS (SELECT 1 FROM audit_logs_archive a JOIN operational_reviews r ON r.entity_type=a.entity_type AND r.entity_id=a.entity_id JOIN audit_cases ac ON ac.operational_review_id=r.operational_review_id WHERE a.audit_log_archive_batch_id=b.audit_log_archive_batch_id AND ac.status <> 'closed') AS linkedCase
 FROM audit_log_archive_batches b CROSS JOIN audit_archive_settings s`;
const mapBatch = b => ({...b,id:Number(b.id),recordCount:Number(b.recordCount),expired:!!b.expired,manuallyHeld:!!b.manuallyHeld,linkedCase:!!b.linkedCase,
 status:b.manuallyHeld||b.linkedCase?'Protected':b.expired?'Ready to delete':'Keep until expiry'});
const loadBatch = async(c,id,lock=false) => {
  const n=Number(id);if(!Number.isSafeInteger(n)||n<1)throw errorWith('Select a valid archive file.',400);
  const [rows]=await c.query(`${batchSql} WHERE b.audit_log_archive_batch_id=? ${lock?'FOR UPDATE':''}`,[n]);
  if(!rows.length)throw errorWith('Archive file not found.',404);return mapBatch(rows[0]);
};
const pageNumber = val => Math.max(1,Math.min(100000,parseInt(val,10)||1));
export const listArchivedRecords = async(req,res) => {
  let c;try {await admin(req);c=await db.getConnection();
    const parts=[],params=[],search=String(req.query.search||'').trim().slice(0,120),page=pageNumber(req.query.page);
    if(search){parts.push('(a.title LIKE ? OR a.actor_name LIKE ? OR a.description LIKE ? OR a.entity_label LIKE ?)');params.push(...Array(4).fill(`%${search}%`));}
    for(const key of ['module','action'])if(req.query[key]&&req.query[key]!=='all'){parts.push(`a.${key}=?`);params.push(String(req.query[key]).slice(0,100));}
    for(const [key,op] of [['from','>='],['to','<=']])if(req.query[key]){parts.push(`DATE(a.audit_log_created_at) ${op} ?`);params.push(String(req.query[key]));}
    const where=parts.length?`WHERE ${parts.join(' AND ')}`:'';
    const [rows]=await c.query(`SELECT a.original_audit_log_id AS id,a.audit_log_archive_batch_id AS batchId,a.action,a.module,a.title,a.description,a.entity_type AS entityType,a.entity_id AS entityId,a.entity_label AS entityLabel,a.actor_name AS actorName,a.actor_email AS actorEmail,a.actor_role AS actorRole,a.metadata_json AS metadata,a.ip_address AS ipAddress,a.user_agent AS userAgent,a.audit_log_created_at AS createdAt,a.archived_at AS archivedAt FROM audit_logs_archive a ${where} ORDER BY a.audit_log_created_at DESC,a.original_audit_log_id DESC LIMIT ? OFFSET ?`,[...params,PAGE,(page-1)*PAGE]);
    const [[counter]]=await c.query(`SELECT COUNT(*) AS total FROM audit_logs_archive a ${where}`,params);
    const [modules]=await c.query('SELECT DISTINCT module FROM audit_logs_archive ORDER BY module');
    return res.json({success:true,data:rows.map(r=>({...r,metadata:redactReportMetadata(parseJson(r.metadata)),ipAddress:normalizeIpAddress(r.ipAddress)||'',batchId:Number(r.batchId)})),modules:modules.map(x=>x.module),pagination:{page,total:Number(counter.total),totalPages:Math.max(1,Math.ceil(counter.total/PAGE))}});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
export const listArchiveBatches = async(req,res) => {
  let c;try{await admin(req);c=await db.getConnection();const settings=await getSettings(c),page=pageNumber(req.query.page);
    const [rows]=await c.query(`${batchSql} ORDER BY b.created_at DESC,b.audit_log_archive_batch_id DESC LIMIT ? OFFSET ?`,[PAGE,(page-1)*PAGE]);
    const [[counter]]=await c.query('SELECT COUNT(*) AS total FROM audit_log_archive_batches');
    return res.json({success:true,data:rows.map(mapBatch),settings,pagination:{page,total:Number(counter.total),totalPages:Math.max(1,Math.ceil(counter.total/PAGE))}});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
export const readArchiveSettings = async(req,res) => {
  let c;try{await admin(req);c=await db.getConnection();return res.json({success:true,data:await getSettings(c)});}catch(e){return fail(res,e);}finally{c?.release();}
};
export const updateArchiveSettings = async(req,res) => {
  let c;try{await admin(req,true);c=await db.getConnection();await getSettings(c);
    const days=Number(req.body.archiveDays),enabled=req.body.autoDeleteEnabled;
    if(!Number.isInteger(days)||days<90||days>3650||typeof enabled!=='boolean')throw errorWith('Choose 90 to 3,650 days and turn automatic cleanup on or off.',400);
    await c.query('UPDATE audit_archive_settings SET archive_days=?,auto_delete_enabled=? WHERE id=1',[days,enabled?1:0]);
    await writeAuditLog(c,req,{action:'update',module:'Audit Logs',entityType:'audit_archive_settings',entityId:'1',title:'Changed archive retention settings',description:`Keep archived files for ${days} days; automatic cleanup ${enabled?'enabled':'disabled'}.`});
    return res.json({success:true,message:'Archive settings saved.'});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
export const previewArchiveRemoval = async(req,res) => {
  let c;try{await admin(req,true);c=await db.getConnection();await getSettings(c);const b=await loadBatch(c,req.query.batchId);
    return res.json({success:true,data:{...b,canDelete:b.status==='Ready to delete',reason:b.status==='Protected'?'This file is protected by a review or an investigation hold.':!b.expired?'This file has not reached its deletion date.':'This entire file and its stored CSV would be deleted.'}});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
const hash=(code,id)=>{const key=String(process.env.AUDIT_ARCHIVE_CODE_SECRET||process.env.JWT_SECRET||'');if(!key)throw errorWith('Email verification needs AUDIT_ARCHIVE_CODE_SECRET or JWT_SECRET.',503);return crypto.createHmac('sha256',key).update(`remove-archive:${id}:${code}`).digest('hex');};
const checkHash=(actual,expected)=>{const a=Buffer.from(actual,'hex'),b=Buffer.from(String(expected||''),'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);};
export const requestArchiveRemoval = async(req,res) => {
  let c;try{const user=await admin(req,true);c=await db.getConnection();await getSettings(c);
    if(process.env.AUDIT_ARCHIVE_PURGE_ENABLED!=='true')throw errorWith('Permanent deletion is disabled on the server until the developer enables it.');
    const b=await loadBatch(c,req.body.batchId),reason=String(req.body.reason||'').trim().slice(0,1000);
    if(b.status!=='Ready to delete')throw errorWith('This file is still protected or has not reached its deletion date.',409);
    if(reason.length<15)throw errorWith('Provide a reason of at least 15 characters.',400);
    if(req.body.confirmText!==`DELETE ${b.id}`)throw errorWith(`Type DELETE ${b.id} to confirm.`,400);
    if(!req.body.password||!await bcrypt.compare(String(req.body.password),user.password_hash))throw errorWith('Incorrect administrator password.',401);
    if(!user.email)throw errorWith('This account does not have a verified email address.',400);
    const [recent]=await c.query('SELECT created_at FROM audit_archive_purge_codes WHERE requested_by=? ORDER BY id DESC LIMIT 1',[user.id]);
    if(recent.length && Date.now()-new Date(recent[0].created_at).getTime()<60000)throw errorWith('Please wait one minute before requesting another code.',429);
    const code=String(crypto.randomInt(100000,1000000));
    await c.beginTransaction();
    const [result]=await c.query('INSERT INTO audit_archive_purge_codes(batch_id,requested_by,reason,code_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',[b.id,user.id,reason,hash(code,b.id)]);
    await sendEmail({to:user.email,subject:'Confirm permanent deletion of archived audit records',text:`Verification code: ${code}\nArchive file: ${b.id}\nRecords: ${b.recordCount}\nReason: ${reason}\nThis code expires in 10 minutes. Never share it.`});
    await c.commit();return res.json({success:true,data:{verificationId:Number(result.insertId)},message:'We sent a verification code to your email.'});
  }catch(e){try{await c?.rollback();}catch{}return fail(res,e);}finally{c?.release();}
};
/** Call within an open transaction. Uses database trigger guard; rechecks eligibility under lock. */
export const deleteArchiveWithinTransaction = async(c,id,who,reason,verificationId=null) => {
  const b=await loadBatch(c,id,true);
  if(b.status!=='Ready to delete')throw errorWith('This file is protected or not expired. No records were deleted.',409);
  const [[count]]=await c.query('SELECT COUNT(*) AS n FROM audit_logs_archive WHERE audit_log_archive_batch_id=?',[b.id]);
  if(Number(count.n)!==b.recordCount)throw errorWith('Record count mismatch. Deletion cancelled.',409);
  const [[events]]=await c.query('SELECT COUNT(*) AS n FROM audit_log_archive_events WHERE audit_log_archive_batch_id=?',[b.id]);
  await c.query('INSERT INTO audit_archive_purge_receipts(batch_id,record_count,event_count,file_hash,archive_created_at,deleted_by,reason,verification_id) VALUES(?,?,?,?,?,?,?,?)',[b.id,b.recordCount,Number(events.n),b.fileHash,b.archivedAt,who,reason,verificationId]);
  try{await c.query('SET @audit_archive_purge_operation=1');
    await c.query('DELETE FROM audit_log_archive_events WHERE audit_log_archive_batch_id=?',[b.id]);
    await c.query('DELETE FROM audit_archive_holds WHERE batch_id=?',[b.id]);
    await c.query('DELETE FROM audit_logs_archive WHERE audit_log_archive_batch_id=?',[b.id]);
    const [removed]=await c.query('DELETE FROM audit_log_archive_batches WHERE audit_log_archive_batch_id=?',[b.id]);
    if(removed.affectedRows!==1)throw errorWith('Archive file changed during deletion.',409);
  }finally{await c.query('SET @audit_archive_purge_operation=NULL');}
  return {batchId:b.id,recordCount:b.recordCount};
};
export const confirmArchiveRemoval=async(req,res)=>{
  let c;try{const user=await admin(req,true);c=await db.getConnection();await getSettings(c);
    if(process.env.AUDIT_ARCHIVE_PURGE_ENABLED!=='true')throw errorWith('Permanent deletion is not enabled.');
    const id=Number(req.body.verificationId),code=String(req.body.code||'');
    if(!Number.isSafeInteger(id)||!/^\d{6}$/.test(code))throw errorWith('Enter the six-digit code from your email.',400);
    await c.beginTransaction();const [rows]=await c.query('SELECT *, expires_at <= NOW() AS is_expired FROM audit_archive_purge_codes WHERE id=? AND requested_by=? FOR UPDATE',[id,user.id]);
    const v=rows[0];if(!v||v.status!=='pending'||Number(v.is_expired)===1)throw errorWith('The code is expired, already used, or invalid.',400);
    const tries=Number(v.attempt_count)+1;
    if(!checkHash(hash(code,v.batch_id),v.code_hash)){
      await c.query('UPDATE audit_archive_purge_codes SET attempt_count=?,status=? WHERE id=?',[tries,tries>=5?'locked':'pending',id]);await c.commit();
      return res.status(401).json({message:tries>=5?'Too many attempts. Start again.':`Incorrect code. ${5-tries} attempts left.`});
    }
    const result=await deleteArchiveWithinTransaction(c,v.batch_id,user.id,v.reason,id);
    await c.query("UPDATE audit_archive_purge_codes SET status='used' WHERE id=?",[id]);await c.commit();
    try{await writeAuditLog(db,req,{action:'delete',module:'Audit Logs',entityType:'audit_archive_file',entityId:String(result.batchId),title:'Deleted an expired archive file',description:`File ${result.batchId} with ${result.recordCount} records was permanently removed.`});}catch{}
    return res.json({success:true,message:'Archive file deleted. A permanent deletion receipt has been recorded.'});
  }catch(e){try{await c?.rollback();}catch{}return fail(res,e);}finally{if(c){try{await c.query('SET @audit_archive_purge_operation=NULL');}catch{}c.release();}}
};
export const setArchiveProtection=async(req,res)=>{
  let c;try{const user=await admin(req,true);c=await db.getConnection();await getSettings(c);const b=await loadBatch(c,req.body.batchId),reason=String(req.body.reason||'').trim().slice(0,1000);
    if(reason.length<15)throw errorWith('Explain the reason in at least 15 characters.',400);
    if(req.body.protected===true){if(b.manuallyHeld)throw errorWith('This file is already protected.',409);await c.query('INSERT INTO audit_archive_holds(batch_id,reason,created_by) VALUES(?,?,?)',[b.id,reason,user.id]);}
    else if(req.body.protected===false){await c.query('UPDATE audit_archive_holds SET released_at=NOW(),released_by=?,release_reason=? WHERE batch_id=? AND released_at IS NULL',[user.id,reason,b.id]);}
    else throw errorWith('Choose whether to protect this file.',400);
    await writeAuditLog(c,req,{action:'system',module:'Audit Logs',entityType:'audit_archive_file',entityId:String(b.id),title:req.body.protected?'Protected an archive file':'Removed manual protection',description:reason});
    return res.json({success:true,message:req.body.protected?'Archive file protected.':'Manual protection removed.'});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
export const listArchiveDeletionHistory=async(req,res)=>{
  let c;try{await admin(req);c=await db.getConnection();await getSettings(c);
    const [rows]=await c.query('SELECT batch_id AS batchId,record_count AS recordCount,deleted_at AS deletedAt,reason FROM audit_archive_purge_receipts ORDER BY deleted_at DESC LIMIT 100');
    return res.json({success:true,data:rows});
  }catch(e){return fail(res,e);}finally{c?.release();}
};
export const runArchiveCleanup=async()=>{
  if(process.env.AUDIT_ARCHIVE_PURGE_ENABLED!=='true'||process.env.AUDIT_ARCHIVE_AUTO_PURGE_ENABLED!=='true')return {disabled:true};
  const c=await db.getConnection();const removed=[];
  try{const s=await getSettings(c);if(!s.autoDeleteEnabled)return {disabled:true};
    const [rows]=await c.query(`SELECT * FROM (${batchSql}) eligible WHERE eligible.expired=1 AND eligible.manuallyHeld=0 AND eligible.linkedCase=0 ORDER BY eligible.archivedAt ASC LIMIT 5`);
    for(const b0 of rows){const b=mapBatch(b0);if(b.status!=='Ready to delete')continue;
      try{await c.beginTransaction();removed.push(await deleteArchiveWithinTransaction(c,b.id,null,'Scheduled removal after retention period'));await c.commit();}
      catch(e){await c.rollback();throw e;}
      finally{await c.query('SET @audit_archive_purge_operation=NULL');}
    }
    return {removed};
  }finally{c.release();}
};
