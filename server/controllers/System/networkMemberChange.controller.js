import {randomUUID} from 'node:crypto';
import {db} from '../../db/connect.js';
import {writeAuditLog} from './auditLogs.controller.js';
import {createOperationalReview} from '../../services/operationalReview.service.js';
import {assertGroupCurrentPathsWithinPools} from './sellerGroup.controller.js';
import {loadNetworkMembers,networkFingerprint,validateMemberPath,updateMemberParent,changeError,intId,hashState,memberName} from '../../services/networkMemberChange.service.js';
import {createSensitiveActionVerification,verifyAndConsumeSensitiveAction,maskSensitiveActionEmail,getSensitiveActionRequestIp,SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} from '../../services/sensitiveActionVerification.service.js';
import {sendEmail,isResendConfigured} from '../../services/email.service.js';

const manage=async(req,res,callback)=>{const connection=await db.getConnection();try{return await callback(connection)}catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Unable to complete this action. Check the latest status before trying again.'})}finally{connection.release()}};
const reason=req=>String(req.body?.reason||'').trim().slice(0,500);
const requireReason=req=>{if(reason(req).length<5)throw changeError('Enter a reason with at least 5 characters.',400)};
const groupKey=req=>{const id=intId(req.params.groupId);if(!id)throw changeError('Choose a valid Network.',400);return id};
const uniqueIds=value=>{if(!Array.isArray(value)||!value.length||value.length>50)throw changeError('Select between 1 and 50 members.',400);const ids=value.map(intId);if(ids.some(v=>!v)||new Set(ids).size!==ids.length)throw changeError('Your member selection is invalid or contains duplicates.',400);return ids.sort((a,b)=>a-b)};
const stateHash=state=>networkFingerprint(state);
const previewBulk=async(conn,req,lock=false)=>{
 const networkId=groupKey(req),ids=uniqueIds(req.body?.memberUserIds),targetId=intId(req.body?.newManagerUserId);
 if(!targetId)throw changeError('Choose the new manager.',400);
 const state=await loadNetworkMembers(conn,networkId,lock),target=state.map.get(targetId);
 if(!target)throw changeError('The selected manager is not in this Network. Choose another manager.');
 const roles=new Set(),items=[];
 const pathFor=managerId=>{const nodes=[],seen=new Set();let current=state.map.get(managerId);while(current&&!seen.has(Number(current.user_id))&&nodes.length<6){nodes.push(memberName(current));seen.add(Number(current.user_id));current=state.map.get(intId(current.accredited_seller_reports_under_user_id))}return nodes};
 for(const id of ids){const seller=state.map.get(id);if(!seller)throw changeError('A selected member is no longer in this Network. Refresh the list.');
  validateMemberPath(state,seller,target);roles.add(seller.role);
  const old=intId(seller.accredited_seller_reports_under_user_id);
  if(old===targetId)throw changeError(`${memberName(seller)} already reports to ${memberName(target)}. Remove them from your selection.`);
  items.push({userId:id,sellerId:Number(seller.accredited_seller_id),name:memberName(seller),role:seller.role,previousManagerId:old,previousManagerName:memberName(state.map.get(old)||{user_id:old}),newManagerId:targetId,newManagerName:memberName(target),previousPath:pathFor(old),newPath:pathFor(targetId)});
 }
 if(roles.size!==1)throw changeError('Select members of the same role for each bulk change.');
 return {groupId:networkId,networkName:state.group.seller_group_name,items,manager:{userId:targetId,name:memberName(target),role:target.role},stateHash:stateHash(state),headUserId:intId(state.group.seller_group_head_user_id),crossBranch:items.some(item=>item.previousManagerId!==targetId)};
};
export const previewNetworkMemberBulkEdit=(req,res)=>manage(req,res,async conn=>res.json({success:true,data:await previewBulk(conn,req)}));
export const confirmNetworkMemberBulkEdit=(req,res)=>manage(req,res,async conn=>{
 requireReason(req);
 const key=String(req.body?.requestKey||'');if(!/^[0-9a-f-]{36}$/i.test(key))throw changeError('Refresh the form and try again.',400);
 await conn.beginTransaction();
 const [[prior]]=await conn.query('SELECT batch_id,seller_group_id,changed_count FROM network_member_bulk_edit_batches WHERE request_key=?',[key]);
 if(prior){if(Number(prior.seller_group_id)!==groupKey(req))throw changeError('This request reference belongs to another Network. Refresh the form.',409);await conn.commit();return res.json({success:true,message:'This bulk change was already saved.',data:{batchId:prior.batch_id,changed:prior.changed_count,alreadyProcessed:true}})}
 const plan=await previewBulk(conn,req,true);
 if(req.body?.expectedStateHash!==plan.stateHash||Number(req.body?.expectedHeadUserId)!==plan.headUserId)throw changeError('Member assignments changed. Refresh the preview before continuing.');
 if(plan.crossBranch&&req.body?.confirmCrossBranch!==true)throw changeError('These changes cross a reporting branch. Review the impact and confirm before continuing.',400);
 const currentState=await loadNetworkMembers(conn,plan.groupId,false);
 for(const item of plan.items)await updateMemberParent(conn,currentState.map.get(item.userId),item.previousManagerId,currentState.map.get(item.newManagerId));
 await assertGroupCurrentPathsWithinPools(conn,plan.groupId);
 const [saved]=await conn.query('INSERT INTO network_member_bulk_edit_batches(seller_group_id,actor_user_id,reason,request_key,snapshot_hash,changed_count) VALUES(?,?,?,?,?,?)',[plan.groupId,req.authUser.id,reason(req),key,plan.stateHash,plan.items.length]);
 const batchId=Number(saved.insertId);
 for(const item of plan.items)await conn.query('INSERT INTO network_member_bulk_edit_items(batch_id,accredited_seller_id,previous_manager_user_id,new_manager_user_id) VALUES(?,?,?,?)',[batchId,item.sellerId,item.previousManagerId,item.newManagerId]);
 const review=await createOperationalReview(conn,{actor:req.authUser,actionKey:'network.members.bulk_edit',department:'marketing',entityType:'seller_group',entityId:String(plan.groupId),entityLabel:plan.networkName,beforeSnapshot:{members:plan.items.map(i=>({sellerId:i.sellerId,managerId:i.previousManagerId}))},afterSnapshot:{batchId,reason:reason(req),members:plan.items}});
 await conn.query('UPDATE network_member_bulk_edit_batches SET operational_review_id=? WHERE batch_id=?',[review.reviewId,batchId]);
 await writeAuditLog(conn,req,{action:'update',module:'Accreditation',entityType:'seller_group',entityId:String(plan.groupId),entityLabel:plan.networkName,title:'Bulk reporting assignments updated',description:`${plan.items.length} members reassigned to ${plan.manager.name}.`,metadata:{batchId,reason:reason(req),members:plan.items,reviewId:review.reviewId,crossBranch:plan.crossBranch}});
 await conn.commit();return res.json({success:true,message:`${plan.items.length} member${plan.items.length===1?'':'s'} updated successfully.`,data:{batchId,changed:plan.items.length,review}});
});

const restorePlan=async(conn,req,lock=false)=>{
 const groupId=groupKey(req),replacementId=intId(req.params.replacementId);
 if(!replacementId)throw changeError('Choose a valid replacement record.',400);
 const state=await loadNetworkMembers(conn,groupId,lock);
 const [[replacement]]=await conn.query(`SELECT * FROM seller_manager_replacements WHERE replacement_id=? AND seller_group_id=?${lock?' FOR UPDATE':''}`,[replacementId,groupId]);
 if(!replacement)throw changeError('Replacement history record not found.',404);
 const [[reversal]]=await conn.query('SELECT reversal_id FROM seller_manager_replacement_reversals WHERE replacement_id=?',[replacementId]);
 if(reversal)throw changeError('This manager replacement has already been restored.');
 const from=state.map.get(Number(replacement.outgoing_user_id)),to=state.map.get(Number(replacement.replacement_user_id));
 if(!from||!to||from.role!==replacement.outgoing_role||to.role!==replacement.outgoing_role)throw changeError('The original managers are no longer eligible for automatic restoration.');
 if(from.user_status!=='inactive'||from.accredited_seller_status!=='inactive')throw changeError('The previous manager is not in the expected inactive state. Review the account before restoring.');
 if(String(from.deactivation_reason||'')!==String(replacement.reason||''))throw changeError('The previous manager account was changed after replacement. Automatic restoration is unavailable. Review the account status first.');
 if(to.user_status!=='active'||to.accredited_seller_status!=='active')throw changeError('The replacement manager is no longer active. Automatic restoration is unavailable.');
 if(Number(from.is_system_dummy||0)||Number(to.is_system_dummy||0))throw changeError('A system account cannot be restored through this tool.');
 const [items]=await conn.query(`SELECT replacement_item_id,affected_accredited_seller_id,previous_manager_user_id,new_manager_user_id FROM seller_manager_replacement_items WHERE replacement_id=? ORDER BY affected_accredited_seller_id${lock?' FOR UPDATE':''}`,[replacementId]);
 if(items.length!==Number(replacement.direct_reports_moved))throw changeError('Replacement history is incomplete. Restoration requires an administrator review.');
 const sellers=[];
 for(const item of items){const seller=state.members.find(m=>Number(m.accredited_seller_id)===Number(item.affected_accredited_seller_id));
  if(!seller||Number(item.previous_manager_user_id)!==Number(from.user_id)||Number(item.new_manager_user_id)!==Number(to.user_id)||intId(seller.accredited_seller_reports_under_user_id)!==Number(to.user_id))throw changeError('One or more transferred members were reassigned later. Use Bulk Edit instead of automatic restoration.');
  if(seller.role!==({unit_manager:'sales_agent',sales_director:'unit_manager',division_manager:'sales_director'}[from.role]))throw changeError('A transferred member changed role. Automatic restoration is unavailable.');
  sellers.push({userId:Number(seller.user_id),sellerId:Number(seller.accredited_seller_id),name:memberName(seller),role:seller.role});
 }
 const snapshot=typeof replacement.impact_snapshot_json==='string'?JSON.parse(replacement.impact_snapshot_json):replacement.impact_snapshot_json||{};
 // Earlier replacements without a saved team snapshot cannot be automatically restored safely.
 if(!snapshot?.outgoing || !Object.hasOwn(snapshot.outgoing,'reportingParentUserId') || !Array.isArray(snapshot.downstreamHierarchy))throw changeError('This older replacement lacks the reporting snapshot needed for a safe automatic restore. Use Bulk Edit for a controlled correction.');
 if(intId(from.accredited_seller_reports_under_user_id)!==intId(snapshot.outgoing.reportingParentUserId))throw changeError('The previous manager’s Reports To assignment changed after replacement. Automatic restoration is unavailable.');
 for(const historical of snapshot.downstreamHierarchy){
  const member=state.map.get(Number(historical.userId));
  const wasDirect=Number(historical.managerId)===Number(from.user_id);
  const expectedParent=wasDirect?Number(to.user_id):Number(historical.managerId);
  if(!member||member.role!==historical.role||intId(member.accredited_seller_reports_under_user_id)!==expectedParent)throw changeError('The transferred team changed since the original replacement. Use Bulk Edit to review the current assignments.');
 }
 const headChanged=Boolean(snapshot.replacesNetworkHead);
 const currentHead=intId(state.group.seller_group_head_user_id);
 if(headChanged&&currentHead!==Number(to.user_id))throw changeError('The Network Head changed after this replacement. Automatic restoration cannot overwrite it.');
 if(!headChanged&&currentHead===Number(from.user_id))throw changeError('The previous manager is already designated Network Head. Review the hierarchy.');
 if(from.role!=='division_manager'){
  const parent=state.map.get(intId(from.accredited_seller_reports_under_user_id));
  if(!parent||parent.role!==({unit_manager:'sales_director',sales_director:'division_manager'}[from.role])||parent.user_status!=='active'||parent.accredited_seller_status!=='active')throw changeError('The previous manager no longer has an eligible reporting manager. Correct the reporting structure before restoring.');
 }else if(intId(from.accredited_seller_reports_under_user_id))throw changeError('The previous Division Manager has an invalid reporting assignment.');
 // Existing future children of the outgoing manager would make the snapshot unexpected.
 if(state.members.some(m=>intId(m.accredited_seller_reports_under_user_id)===Number(from.user_id)))throw changeError('The previous manager received new reporting assignments after replacement. Automatic restoration is unavailable.');
 const hash=hashState({network:stateHash(state),replacementId,items:items.map(i=>[i.affected_accredited_seller_id,i.previous_manager_user_id,i.new_manager_user_id]),from:Number(from.user_id),to:Number(to.user_id)});
 return {replacementId,groupId,networkName:state.group.seller_group_name,previousManager:{id:Number(from.user_id),name:memberName(from),role:from.role},replacementManager:{id:Number(to.user_id),name:memberName(to)},sellers,headChanged,currentHeadUserId:currentHead,stateHash:hash};
};
export const previewManagerRestoration=(req,res)=>manage(req,res,async conn=>res.json({success:true,data:await restorePlan(conn,req)}));
const RESTORE_ACTION='seller_manager_replacement_restore';
export const requestManagerRestorationCode=(req,res)=>manage(req,res,async conn=>{
 requireReason(req);if(!req.authUser?.email||!isResendConfigured())throw changeError('Verification email is unavailable. Contact an administrator.',503);
 const plan=await restorePlan(conn,req);if(!plan.headChanged)throw changeError('Email verification is required only for Network Head restorations.',400);
 await conn.beginTransaction();
 const payload={hash:plan.stateHash,replacementId:plan.replacementId,actorId:Number(req.authUser.id),reason:reason(req)};
 const {verificationId,code}=await createSensitiveActionVerification(conn,{userId:req.authUser.id,actionType:RESTORE_ACTION,entityType:'seller_manager_replacement',entityId:String(plan.replacementId),payload,reason:reason(req),requestIp:getSensitiveActionRequestIp(req)});
 await conn.commit();
 await sendEmail({to:req.authUser.email,subject:'Confirm Network Head restoration',text:`Your verification code: ${code}\nRestore ${plan.previousManager.name} as Network Head.\nMembers returning: ${plan.sellers.length}.\nReason: ${reason(req)}\nExpires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.`});
 return res.json({success:true,data:{verificationId,maskedEmail:maskSensitiveActionEmail(req.authUser.email)},message:'Verification code sent.'});
});
export const confirmManagerRestoration=(req,res)=>manage(req,res,async conn=>{
 requireReason(req);const key=String(req.body?.requestKey||'');if(!/^[0-9a-f-]{36}$/i.test(key))throw changeError('Refresh the restoration form and try again.',400);
 await conn.beginTransaction();
 const [[prior]]=await conn.query('SELECT reversal_id,replacement_id,restored_count FROM seller_manager_replacement_reversals WHERE request_key=?',[key]);
 if(prior){if(Number(prior.replacement_id)!==intId(req.params.replacementId))throw changeError('This request reference belongs to another replacement. Refresh the form.',409);await conn.commit();return res.json({success:true,message:'This restoration was already completed.',data:{reversalId:prior.reversal_id,restored:prior.restored_count,alreadyProcessed:true}})}
 const plan=await restorePlan(conn,req,true);
 if(req.body?.expectedStateHash!==plan.stateHash)throw changeError('The reporting structure changed. Refresh the restoration preview before continuing.');
 if(req.body?.confirmRestore!==true)throw changeError('Review and confirm restoration of the previous manager.',400);
 if(plan.headChanged){const verificationId=intId(req.body?.verificationId),code=String(req.body?.code||'');
  if(!verificationId||!/^[0-9]{6}$/.test(code))throw changeError('Enter the 6-digit email verification code.',400);
  const result=await verifyAndConsumeSensitiveAction(conn,{verificationId,userId:req.authUser.id,actionType:RESTORE_ACTION,entityType:'seller_manager_replacement',entityId:String(plan.replacementId),code,payload:{hash:plan.stateHash,replacementId:plan.replacementId,actorId:Number(req.authUser.id),reason:reason(req)}});
  if(!result.ok){await conn.commit();return res.status(result.statusCode||400).json({message:result.message})}
 }
 // Return previously transferred members only; do not touch the incoming manager's original team.
 const [[previous]]=await conn.query('SELECT accredited_seller_id,user_id,accredited_seller_reports_under_user_id FROM accredited_sellers WHERE user_id=?',[plan.previousManager.id]);
 const [[replacement]]=await conn.query('SELECT accredited_seller_id,user_id FROM accredited_sellers WHERE user_id=?',[plan.replacementManager.id]);
 for(const person of plan.sellers){const [result]=await conn.query('UPDATE accredited_sellers SET accredited_seller_reports_under_user_id=? WHERE accredited_seller_id=? AND accredited_seller_reports_under_user_id=?',[previous.user_id,person.sellerId,replacement.user_id]);
  if(result.affectedRows!==1)throw changeError('A seller changed manager while restoring. No restoration was committed.');
  await conn.query('DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id=?',[person.sellerId]);
  await conn.query('INSERT INTO accredited_seller_managed_sellers(manager_accredited_seller_id,managed_accredited_seller_id) VALUES(?,?)',[previous.accredited_seller_id,person.sellerId]);
 }
 if(plan.headChanged){const [result]=await conn.query('UPDATE seller_groups SET seller_group_head_user_id=? WHERE seller_group_id=? AND seller_group_head_user_id=?',[previous.user_id,plan.groupId,replacement.user_id]);if(result.affectedRows!==1)throw changeError('Network Head changed. Refresh and review the restoration.');}
 await conn.query(`UPDATE users SET status='active',can_login=0,deactivated_at=NULL,deactivated_by_user_id=NULL,deactivation_reason=NULL,auth_version=COALESCE(auth_version,0)+1 WHERE id=? AND status='inactive'`,[previous.user_id]);
 await conn.query('UPDATE accredited_sellers SET accredited_seller_status=? WHERE accredited_seller_id=?',['active',previous.accredited_seller_id]);
 await assertGroupCurrentPathsWithinPools(conn,plan.groupId);
 const [result]=await conn.query('INSERT INTO seller_manager_replacement_reversals(replacement_id,seller_group_id,actor_user_id,reason,request_key,snapshot_hash,restored_count) VALUES(?,?,?,?,?,?,?)',[plan.replacementId,plan.groupId,req.authUser.id,reason(req),key,plan.stateHash,plan.sellers.length]);
 const reversalId=Number(result.insertId);
 const review=await createOperationalReview(conn,{actor:req.authUser,actionKey:'seller.manager_restore',department:'marketing',entityType:'accredited_seller',entityId:String(previous.accredited_seller_id),entityLabel:plan.previousManager.name,beforeSnapshot:{replacementId:plan.replacementId,previousStatus:'inactive',members:plan.sellers,headChanged:plan.headChanged},afterSnapshot:{reversalId,previousStatus:'active',canLogin:false,membersRestored:plan.sellers,headChanged:plan.headChanged}});
 await conn.query('UPDATE seller_manager_replacement_reversals SET operational_review_id=? WHERE reversal_id=?',[review.reviewId,reversalId]);
 await writeAuditLog(conn,req,{action:'update',module:'Accreditation',entityType:'accredited_seller',entityId:String(previous.accredited_seller_id),entityLabel:plan.previousManager.name,title:'Manager replacement restored',description:`Returned ${plan.sellers.length} members to ${plan.previousManager.name}. Login remains disabled until separately authorized.`,metadata:{reversalId,replacementId:plan.replacementId,reason:reason(req),restoredMembers:plan.sellers,headChanged:plan.headChanged,reviewId:review.reviewId}});
 await conn.commit();return res.json({success:true,message:`Previous manager restored. ${plan.sellers.length} members returned. Login remains disabled pending account access review.`,data:{reversalId,restored:plan.sellers.length,review}});
});
