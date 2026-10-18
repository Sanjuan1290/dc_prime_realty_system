import crypto from 'node:crypto';
import { getRequiredParentRole, SELLER_ROLE_LABELS } from '../controllers/System/sellerHierarchyRules.js';

const ROLES = new Set(['division_manager', 'sales_director', 'unit_manager']);
const bad = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const positive = value => Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : 0;
const nameOf = row => [row?.first_name,row?.middle_name,row?.last_name].filter(Boolean).join(' ').trim() || row?.account_code || 'Seller';

/** Reads the live Network structure. No changes are made by this function. */
export async function getManagerReplacementPlan(connection, { groupId, outgoingUserId, replacementUserId = 0, lock = false }) {
  const groupKey = positive(groupId), outgoingKey = positive(outgoingUserId), replacementKey = positive(replacementUserId);
  if (!groupKey || !outgoingKey) throw bad('Choose a valid Network and manager.',400);
  const suffix = lock ? ' FOR UPDATE' : '';
  const [[group]] = await connection.query(`SELECT * FROM seller_groups WHERE seller_group_id=?${suffix}`, [groupKey]);
  if (!group || group.seller_group_type!=='in_house') throw bad('In-House Network not found.',404);
  if (group.seller_group_status!=='active') throw bad('Activate this Network before replacing a manager.');
  const [members] = await connection.query(`SELECT s.accredited_seller_id,s.user_id,s.seller_group_id,s.accredited_seller_reports_under_user_id,
      s.accredited_seller_status,s.is_system_dummy,u.role,u.status AS user_status,u.account_code,u.first_name,u.middle_name,u.last_name
    FROM accredited_sellers s INNER JOIN users u ON u.id=s.user_id WHERE s.seller_group_id=? ORDER BY s.user_id${suffix}`, [groupKey]);
  const byId = new Map(members.map(row=>[Number(row.user_id),row]));
  const outgoing = byId.get(outgoingKey);
  if (!outgoing || !ROLES.has(outgoing.role) || Number(outgoing.is_system_dummy||0)) throw bad('Choose an active Unit Manager, Sales Director, or Division Manager.');
  if (outgoing.user_status!=='active' || outgoing.accredited_seller_status!=='active') throw bad('This manager is already inactive.');
  if (replacementKey && replacementKey===outgoingKey) throw bad('Choose a different replacement manager.');
  const directReports = members.filter(row=>Number(row.accredited_seller_reports_under_user_id||0)===outgoingKey);
  const expectedChildRoles = {unit_manager:'sales_agent',sales_director:'unit_manager',division_manager:'sales_director'};
  for (const child of directReports) {
    if (child.role!==expectedChildRoles[outgoing.role]) throw bad(`${nameOf(child)} has an incorrect reporting position. Check Seller Setup first.`);
    // Inactive direct reports are moved too; they must retain their inactive status.
  }
  if (outgoing.role==='division_manager' && Number(group.seller_group_head_user_id||0)!==outgoingKey) throw bad('Only the current Network Head can be replaced as Division Manager.');
  if (outgoing.role!=='division_manager' && Number(group.seller_group_head_user_id||0)===outgoingKey) throw bad('This Network Head must be reviewed before replacement.');
  const available = members.filter(row => row.user_id!==outgoingKey && row.role===outgoing.role && row.user_status==='active'
    && row.accredited_seller_status==='active' && !Number(row.is_system_dummy||0));
  const validCandidate = row => {
    if (outgoing.role==='division_manager') return !positive(row.accredited_seller_reports_under_user_id);
    const parentId = positive(row.accredited_seller_reports_under_user_id);
    let current = row, seen=new Set();
    while(current && current.role!=='division_manager'){
      const id=Number(current.user_id);
      if(seen.has(id) || id===outgoingKey) return false;
      seen.add(id);
      const parent=byId.get(positive(current.accredited_seller_reports_under_user_id));
      if(!parent || parent.role!==getRequiredParentRole(current.role) || parent.user_status!=='active' || parent.accredited_seller_status!=='active') return false;
      current=parent;
    }
    return Number(current?.user_id||0)===Number(group.seller_group_head_user_id||0) && current?.role==='division_manager';
  };
  const candidates=available.filter(validCandidate);
  const replacement = replacementKey ? candidates.find(row=>Number(row.user_id)===replacementKey) : null;
  if(replacementKey && !replacement) throw bad('Replacement is unavailable. Select an active manager with a complete reporting setup in this Network.');
  // Ensure a directly reported child cannot become an ancestor of its own former manager.
  if(replacement && directReports.some(row=>Number(row.user_id)===replacementKey)) throw bad('The replacement cannot be someone currently reporting to this manager.');
  const impacted = directReports.map(row=>({userId:Number(row.user_id),sellerId:Number(row.accredited_seller_id),name:nameOf(row),role:row.role,previousManagerUserId:outgoingKey,nextManagerUserId:replacementKey,userStatus:row.user_status,sellerStatus:row.accredited_seller_status}));
  const descendantIds=new Set([outgoingKey]);
  for(let i=0;i<members.length;i++){
    for(const row of members) if(descendantIds.has(Number(row.accredited_seller_reports_under_user_id||0))) descendantIds.add(Number(row.user_id));
  }
  const normalized={groupId:groupKey,groupName:group.seller_group_name,role:outgoing.role,
    outgoing:{userId:outgoingKey,sellerId:Number(outgoing.accredited_seller_id),name:nameOf(outgoing),role:outgoing.role},
    replacement:replacement?{userId:replacementKey,sellerId:Number(replacement.accredited_seller_id),name:nameOf(replacement),role:replacement.role}:null,
    candidates:candidates.map(row=>({userId:Number(row.user_id),name:nameOf(row),role:row.role})),
    directReports:impacted, totalAffected:descendantIds.size-1,
    currentHeadUserId:Number(group.seller_group_head_user_id||0),
    stateHash:crypto.createHash('sha256').update(JSON.stringify(members.map(row=>[Number(row.user_id),row.role,row.user_status,row.accredited_seller_status,Number(row.accredited_seller_reports_under_user_id||0)]))).digest('hex'),
  };
  return normalized;
}

export function replacementFingerprint(plan, reason) {
  return crypto.createHash('sha256').update(JSON.stringify({
    groupId:plan.groupId,outgoing:plan.outgoing.userId,replacement:plan.replacement?.userId,
    head:plan.currentHeadUserId, stateHash:plan.stateHash, affected:plan.directReports.map(row=>[row.userId,row.previousManagerUserId]),reason:String(reason||'').trim(),
  })).digest('hex');
}

export async function assertReplacementApplied(connection, plan) {
  const [[old]] = await connection.query('SELECT status FROM users WHERE id=?',[plan.outgoing.userId]);
  if(old?.status!=='inactive') throw bad('Manager deactivation was not saved.');
  const [rows]=await connection.query(`SELECT s.user_id,s.accredited_seller_reports_under_user_id,s.accredited_seller_status,u.status AS user_status
    FROM accredited_sellers s JOIN users u ON u.id=s.user_id WHERE s.user_id IN (${plan.directReports.length?plan.directReports.map(()=>'?').join(','):'0'})`,plan.directReports.map(row=>row.userId));
  if(rows.length!==plan.directReports.length || rows.some(row=>Number(row.accredited_seller_reports_under_user_id)!==plan.replacement.userId )) throw bad('Team assignments did not save correctly. Nothing was changed.');
  const [[group]]=await connection.query('SELECT seller_group_head_user_id FROM seller_groups WHERE seller_group_id=?',[plan.groupId]);
  if(plan.role==='division_manager' && Number(group?.seller_group_head_user_id)!==plan.replacement.userId) throw bad('Network Head did not update. Nothing was changed.');
}

export const managerRoleLabels = SELLER_ROLE_LABELS;
