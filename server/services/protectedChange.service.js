import { buildReviewPayloadHash } from './operationalReview.service.js';
import { createInternalNotifications, notifyDepartmentHeads } from './internalNotification.service.js';
import { DEPARTMENT_HEAD_ROLE } from '../config/permissions.js';

const requestNumber=(id)=>`APR-${String(id).padStart(8,'0')}`;
const json=(value)=>JSON.stringify(value ?? null);

export const createProtectedChangeRequest=async(connection,{actor,actionKey,department,projectId=null,entityType,entityId,entityLabel=null,payload,reason,expiresHours=24})=>{
  if(!actor?.id)throw Object.assign(new Error('Authenticated requester is required.'),{statusCode:401});
  const expectedHead=DEPARTMENT_HEAD_ROLE[department]; if(!expectedHead)throw Object.assign(new Error('Invalid approval department.'),{statusCode:400});
  if(actor.role===expectedHead)return {directHeadApproval:true,status:'approved',reviewedByHeadUserId:actor.id};
  const cleanReason=String(reason||'').trim(); if(cleanReason.length<5)throw Object.assign(new Error('Enter a clear reason for this protected change.'),{statusCode:400});
  const payloadHash=buildReviewPayloadHash(payload);
  await connection.query("UPDATE protected_change_requests SET status='expired' WHERE requested_by_user_id=? AND action_key=? AND entity_type=? AND entity_id=? AND status='pending' AND expires_at<=NOW()",[actor.id,actionKey,entityType,String(entityId)]);
  const [existing]=await connection.query("SELECT protected_change_request_id,request_number,status FROM protected_change_requests WHERE requested_by_user_id=? AND action_key=? AND entity_type=? AND entity_id=? AND request_payload_hash=? AND status IN ('pending','approved') AND expires_at>NOW() ORDER BY protected_change_request_id DESC LIMIT 1 FOR UPDATE",[actor.id,actionKey,entityType,String(entityId),payloadHash]);
  if(existing[0])return {requestId:Number(existing[0].protected_change_request_id),requestNumber:existing[0].request_number,status:existing[0].status,reused:true};
  const expiresAt=new Date(Date.now()+Number(expiresHours||24)*3600000);
  const [result]=await connection.query(`INSERT INTO protected_change_requests(action_key,department,lot_project_id,entity_type,entity_id,entity_label,requested_by_user_id,request_payload_json,request_payload_hash,reason,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[actionKey,department,projectId||null,entityType,String(entityId),entityLabel,actor.id,json(payload),payloadHash,cleanReason,expiresAt]);
  const id=Number(result.insertId),number=requestNumber(id); await connection.query('UPDATE protected_change_requests SET request_number=? WHERE protected_change_request_id=?',[number,id]);
  const recipients=await notifyDepartmentHeads(connection,{department,projectId,reviewId:null,title:`Protected change approval · ${entityLabel||entityType}`,message:`${number} requires ${department} Head approval before it can be applied.`});
  if(!recipients.length){const [admins]=await connection.query("SELECT id FROM users WHERE role='system_admin' AND status='active'");await createInternalNotifications(connection,{userIds:admins.map(r=>r.id),type:'approval_has_no_head',title:`No ${department} Head available`,message:`${number} is waiting for a Head but none has project coverage.`});}
  return {requestId:id,requestNumber:number,status:'pending',expiresAt};
};

export const getProtectedChangeForUpdate=async(connection,id)=>{const [rows]=await connection.query('SELECT * FROM protected_change_requests WHERE protected_change_request_id=? LIMIT 1 FOR UPDATE',[Number(id)]);return rows[0]||null;};

export const approveProtectedChange=async(connection,{requestId,actor,approve=true,note=''})=>{
  const row=await getProtectedChangeForUpdate(connection,requestId); if(!row)throw Object.assign(new Error('Approval request not found.'),{statusCode:404});
  if(row.status!=='pending')throw Object.assign(new Error('This approval request is no longer pending.'),{statusCode:409});
  if(new Date(row.expires_at).getTime()<=Date.now()){await connection.query("UPDATE protected_change_requests SET status='expired' WHERE protected_change_request_id=?",[row.protected_change_request_id]);throw Object.assign(new Error('This approval request has expired.'),{statusCode:409});}
  if(actor?.role!==DEPARTMENT_HEAD_ROLE[row.department])throw Object.assign(new Error(`Only the ${row.department} Head can review this request.`),{statusCode:403});
  if(row.lot_project_id && !Number(actor.all_projects_access||actor.admin_all_projects||0)){const [scope]=await connection.query('SELECT 1 FROM user_project_access WHERE user_id=? AND lot_project_id=? LIMIT 1',[actor.id,row.lot_project_id]);if(!scope.length)throw Object.assign(new Error('This approval request is outside your project scope.'),{statusCode:403});}
  const next=approve?'approved':'rejected';await connection.query('UPDATE protected_change_requests SET status=?,reviewed_by_head_user_id=?,head_note=?,reviewed_at=NOW() WHERE protected_change_request_id=?',[next,actor.id,String(note||'').trim()||null,row.protected_change_request_id]);
  await createInternalNotifications(connection,{userIds:[row.requested_by_user_id],type:approve?'protected_change_approved':'protected_change_rejected',title:`${approve?'Approved':'Rejected'} · ${row.request_number}`,message:String(note||'').trim()||`${row.request_number} was ${next}.`});
  return {...row,status:next,reviewed_by_head_user_id:actor.id};
};

export const consumeProtectedChange=async(connection,{requestId,actor,actionKey,entityType,entityId,payload})=>{
  const row=await getProtectedChangeForUpdate(connection,requestId); if(!row)throw Object.assign(new Error('Approval request not found.'),{statusCode:404});
  if(row.status!=='approved')throw Object.assign(new Error('Department Head approval is required before this change can be applied.'),{statusCode:409,code:'HEAD_APPROVAL_REQUIRED'});
  if(Number(row.requested_by_user_id)!==Number(actor?.id))throw Object.assign(new Error('This approval belongs to a different requester.'),{statusCode:403});
  if(row.action_key!==actionKey||row.entity_type!==entityType||String(row.entity_id)!==String(entityId))throw Object.assign(new Error('This approval does not match the requested record/action.'),{statusCode:409});
  const hash=buildReviewPayloadHash(payload); if(hash!==row.request_payload_hash)throw Object.assign(new Error('The proposed change no longer matches what the Head approved. Request approval again.'),{statusCode:409,code:'APPROVED_PAYLOAD_CHANGED'});
  if(new Date(row.expires_at).getTime()<=Date.now())throw Object.assign(new Error('This Head approval has expired. Request a new approval.'),{statusCode:409});
  await connection.query("UPDATE protected_change_requests SET status='used',used_at=NOW() WHERE protected_change_request_id=?",[row.protected_change_request_id]);
  return row;
};
