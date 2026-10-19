import crypto from 'node:crypto';
import { getRequiredParentRole } from '../controllers/System/sellerHierarchyRules.js';

export const changeError=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
export const intId=value=>Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value):0;
export const hashState=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const memberName=row=>[row.first_name,row.middle_name,row.last_name].filter(Boolean).join(' ').trim() || row.account_code || `#${row.user_id}`;
export async function loadNetworkMembers(conn,groupId,lock=false){
 const suffix=lock?' FOR UPDATE':'';
 const [[group]]=await conn.query(`SELECT seller_group_id,seller_group_type,seller_group_status,seller_group_head_user_id,seller_group_name FROM seller_groups WHERE seller_group_id=?${suffix}`,[groupId]);
 if(!group || group.seller_group_type!=='in_house')throw changeError('This In-House Network could not be found.',404);
 if(group.seller_group_status!=='active')throw changeError('Activate this Network before updating reporting assignments.');
 const [members]=await conn.query(`SELECT s.accredited_seller_id,s.user_id,s.seller_group_id,s.accredited_seller_reports_under_user_id,s.accredited_seller_status,s.is_system_dummy,u.role,u.status AS user_status,u.can_login,u.deactivation_reason,u.account_code,u.first_name,u.middle_name,u.last_name FROM accredited_sellers s JOIN users u ON u.id=s.user_id WHERE s.seller_group_id=? ORDER BY s.user_id${suffix}`,[groupId]);
 return {group,members,map:new Map(members.map(r=>[Number(r.user_id),r]))};
}
export const networkFingerprint=({group,members})=>hashState({head:Number(group.seller_group_head_user_id||0),status:group.seller_group_status,members:members.map(m=>[Number(m.accredited_seller_id),Number(m.user_id),m.role,m.user_status,m.accredited_seller_status,Number(m.accredited_seller_reports_under_user_id||0),Number(m.is_system_dummy||0)])});
export function validateMemberPath(state,from,to){
 if(!from || !to)throw changeError('A selected member or new manager is no longer in this Network.');
 if(Number(from.user_id)===Number(to.user_id))throw changeError('A member cannot report to themselves.');
 if(from.role==='division_manager')throw changeError('Division Managers report directly to the developer and cannot be moved with Reports To.');
 if(Number(from.is_system_dummy||0)||Number(to.is_system_dummy||0))throw changeError('System-generated accounts cannot be reassigned here.');
 if(getRequiredParentRole(from.role)!==to.role)throw changeError(`${from.role.replaceAll('_',' ')} must report to a ${String(getRequiredParentRole(from.role)||'valid manager').replaceAll('_',' ')}.`);
 if(to.user_status!=='active'||to.accredited_seller_status!=='active')throw changeError(`${memberName(to)} is inactive. Choose an active manager.`);
 let node=to,seen=new Set();
 while(node){
  const id=Number(node.user_id);
  if(seen.has(id)||id===Number(from.user_id))throw changeError('This change would create a reporting loop. Choose another manager.');
  seen.add(id);
  const parentId=intId(node.accredited_seller_reports_under_user_id);
  if(node.role==='division_manager'){
   if(parentId)throw changeError('The selected Division Manager has an invalid Reports To assignment.');
   break;
  }
  const parent=state.map.get(parentId);
  if(!parent||parent.role!==getRequiredParentRole(node.role)||parent.user_status!=='active'||parent.accredited_seller_status!=='active')throw changeError('The selected manager has an incomplete reporting structure. Check Seller Setup.');
  node=parent;
 }
}
export async function updateMemberParent(conn,seller,previousManagerId,nextManager){
 const [result]=await conn.query(`UPDATE accredited_sellers SET accredited_seller_reports_under_user_id=? WHERE accredited_seller_id=? AND accredited_seller_reports_under_user_id=?`,[nextManager.user_id,seller.accredited_seller_id,previousManagerId]);
 if(result.affectedRows!==1)throw changeError(`Reporting assignment changed for ${memberName(seller)}. Refresh and review before saving.`);
 await conn.query('DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id=?',[seller.accredited_seller_id]);
 await conn.query('INSERT INTO accredited_seller_managed_sellers(manager_accredited_seller_id,managed_accredited_seller_id) VALUES(?,?)',[nextManager.accredited_seller_id,seller.accredited_seller_id]);
}
