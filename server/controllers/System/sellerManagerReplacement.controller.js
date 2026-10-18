import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { assertGroupCurrentPathsWithinPools } from './sellerGroup.controller.js';
import { createOperationalReview } from '../../services/operationalReview.service.js';
import { getManagerReplacementPlan, replacementFingerprint, assertReplacementApplied } from '../../services/sellerManagerReplacement.service.js';
import { createSensitiveActionVerification, verifyAndConsumeSensitiveAction, maskSensitiveActionEmail, getSensitiveActionRequestIp, SENSITIVE_ACTION_CODE_EXPIRY_MINUTES } from '../../services/sensitiveActionVerification.service.js';
import { sendEmail, isResendConfigured } from '../../services/email.service.js';

const ACTION = 'seller_manager_replacement';
const errorText=e=>e?.statusCode?e.message:'Could not replace the manager. No changes were saved.';
const parse = req=>({groupId:Number(req.params.groupId),outgoingUserId:Number(req.params.userId),replacementUserId:Number(req.body?.replacementUserId||req.query?.replacementUserId||0)});
const reason = req=>String(req.body?.reason||'').trim().slice(0,500);
const transaction = async (req,res,handler)=>{
  const connection=await db.getConnection();
  try { return await handler(connection); }
  catch(e){try{await connection.rollback()}catch{} return res.status(e.statusCode||500).json({message:errorText(e)});}
  finally {connection.release();}
};

export const previewManagerReplacement = (req,res)=>transaction(req,res,async connection=>{
  const plan=await getManagerReplacementPlan(connection,parse(req));
  return res.json({success:true,data:plan});
});

export const requestManagerReplacementCode = (req,res)=>transaction(req,res,async connection=>{
  if(reason(req).length<5) return res.status(400).json({message:'Enter a reason (at least 5 characters).'});
  if(!req.authUser?.email || !isResendConfigured()) return res.status(503).json({message:'Verification email is unavailable. Contact an administrator.'});
  await connection.beginTransaction();
  const plan=await getManagerReplacementPlan(connection,parse(req));
  if(!plan.replacement) { await connection.rollback(); return res.status(400).json({message:'Choose a replacement manager.'}); }
  const fingerprint=replacementFingerprint(plan,reason(req));
  const payload={fingerprint,actorId:Number(req.authUser.id),groupId:plan.groupId,outgoingUserId:plan.outgoing.userId,replacementUserId:plan.replacement.userId};
  const {verificationId,code}=await createSensitiveActionVerification(connection,{userId:req.authUser.id,actionType:ACTION,entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),payload,reason:reason(req),requestIp:getSensitiveActionRequestIp(req)});
  await sendEmail({to:req.authUser.email,subject:'Confirm manager replacement',text:`Your D&C Prime Realty verification code: ${code}\nReplace ${plan.outgoing.name} with ${plan.replacement.name}.\nSellers moving: ${plan.directReports.length}.\nReason: ${reason(req)}\nExpires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes. Do not share this code.`});
  await connection.commit();
  return res.json({success:true,data:{verificationId,maskedEmail:maskSensitiveActionEmail(req.authUser.email)},message:'Verification code sent.'});
});

export const confirmManagerReplacement = (req,res)=>transaction(req,res,async connection=>{
  const verificationId=Number(req.body?.verificationId||0),code=String(req.body?.code||'').trim();
  if(!verificationId || !/^\d{6}$/.test(code) || reason(req).length<5) return res.status(400).json({message:'Enter your reason and the 6-digit email code.'});
  const {groupId,outgoingUserId,replacementUserId}=parse(req);
  await connection.beginTransaction();
  // Lock the network and all current members so stale previews cannot be confirmed.
  const plan=await getManagerReplacementPlan(connection,{groupId,outgoingUserId,replacementUserId,lock:true});
  if (!plan.replacement) { await connection.rollback(); return res.status(400).json({message:'Choose a replacement manager.'}); }
  const payload={fingerprint:replacementFingerprint(plan,reason(req)),actorId:Number(req.authUser.id),groupId:plan.groupId,outgoingUserId:plan.outgoing.userId,replacementUserId:plan.replacement.userId};
  const verified=await verifyAndConsumeSensitiveAction(connection,{verificationId,userId:req.authUser.id,actionType:ACTION,entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),code,payload});
  if(!verified.ok){await connection.commit();return res.status(verified.statusCode||400).json({message:verified.message});}
  const rows=plan.directReports;
  // No historical sales, payment or commission rows are touched.
  for(const row of rows){
    await connection.query('UPDATE accredited_sellers SET accredited_seller_reports_under_user_id=? WHERE accredited_seller_id=? AND accredited_seller_reports_under_user_id=?',[plan.replacement.userId,row.sellerId,plan.outgoing.userId]);
    await connection.query('DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id=?',[row.sellerId]);
    await connection.query('INSERT INTO accredited_seller_managed_sellers(manager_accredited_seller_id,managed_accredited_seller_id) VALUES(?,?)',[plan.replacement.sellerId,row.sellerId]);
  }
  if(plan.role==='division_manager') await connection.query('UPDATE seller_groups SET seller_group_head_user_id=? WHERE seller_group_id=? AND seller_group_head_user_id=?',[plan.replacement.userId,plan.groupId,plan.outgoing.userId]);
  await connection.query(`UPDATE users SET status='inactive',can_login=0,deactivated_at=NOW(),deactivated_by_user_id=?,deactivation_reason=?,auth_version=COALESCE(auth_version,0)+1 WHERE id=?`,[req.authUser.id,reason(req),plan.outgoing.userId]);
  await connection.query(`UPDATE accredited_sellers SET accredited_seller_status='inactive' WHERE accredited_seller_id=?`,[plan.outgoing.sellerId]);
  await assertReplacementApplied(connection,plan);
  // Verify fixed project commission rates remain valid after changing the Network Head.
  await assertGroupCurrentPathsWithinPools(connection,plan.groupId);
  const [saved]=await connection.query(`INSERT INTO seller_manager_replacements
   (seller_group_id,outgoing_user_id,replacement_user_id,outgoing_role,reason,created_by_user_id,verification_id,direct_reports_moved,impact_snapshot_json)
   VALUES(?,?,?,?,?,?,?,?,?)`,[plan.groupId,plan.outgoing.userId,plan.replacement.userId,plan.role,reason(req),req.authUser.id,verificationId,rows.length,JSON.stringify(plan)]);
  const replacementId=Number(saved.insertId);
  for(const row of rows) await connection.query(`INSERT INTO seller_manager_replacement_items(replacement_id,affected_accredited_seller_id,previous_manager_user_id,new_manager_user_id) VALUES(?,?,?,?)`,[replacementId,row.sellerId,row.previousManagerUserId,row.nextManagerUserId]);
  const review=await createOperationalReview(connection,{actor:req.authUser,actionKey:'seller.manager_replace',department:'marketing',entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,beforeSnapshot:{manager:plan.outgoing,reportingSellers:rows,accountStatus:'active'},afterSnapshot:{manager:plan.replacement,reportingSellers:rows,formerManagerStatus:'inactive',replacementId}});
  await writeAuditLog(connection,req,{action:'update',module:'Accreditation',entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,title:'Replaced and deactivated manager',description:`Reassigned ${rows.length} direct reports to ${plan.replacement.name}.`,metadata:{replacementId,groupId:plan.groupId,role:plan.role,fromUserId:plan.outgoing.userId,toUserId:plan.replacement.userId,fromManagerName:plan.outgoing.name,toManagerName:plan.replacement.name,affected:rows,reason:reason(req),verificationId,reviewId:review.reviewId,reviewNumber:review.reviewNumber}});
  await connection.query('UPDATE seller_manager_replacements SET operational_review_id=? WHERE replacement_id=?',[review.reviewId,replacementId]);
  await connection.commit();
  return res.json({success:true,message:'Manager replaced and team moved.',data:{replacementId,review,affected:rows.length}});
});

export const getManagerReplacementHistory = (req,res)=>transaction(req,res,async connection=>{
  const groupId=Number(req.params.groupId);
  if(!Number.isSafeInteger(groupId) || groupId<1) return res.status(400).json({message:'Select a valid Network.'});
  const page=Math.max(1,Math.min(10000,Number(req.query.page)||1));
  const limit=15;
  const [rows]=await connection.query(`SELECT replacement_id,outgoing_role,reason,created_at,direct_reports_moved,operational_review_id,
    old.account_code AS old_account_code, new_manager.account_code AS new_account_code,
    CONCAT_WS(' ',old.first_name,old.last_name) AS outgoing_name, CONCAT_WS(' ',new_manager.first_name,new_manager.last_name) AS replacement_name
    FROM seller_manager_replacements history
    INNER JOIN users old ON old.id=history.outgoing_user_id
    INNER JOIN users new_manager ON new_manager.id=history.replacement_user_id
    WHERE seller_group_id=? ORDER BY replacement_id DESC LIMIT ? OFFSET ?`,[groupId,limit,(page-1)*limit]);
  return res.json({success:true,data:rows,page});
});
