import { buildSellerSetupAudit } from './sellerSetupAudit.service.js';

export const checkSellerCanReactivate = async (connection, targetUserId) => {
  const [[seller]] = await connection.query('SELECT * FROM accredited_sellers WHERE user_id=? LIMIT 1 FOR UPDATE',[targetUserId]);
  if (!seller) throw Object.assign(new Error('Seller record was not found. Contact an administrator.'),{statusCode:409});
  if (Number(seller.is_system_dummy || 0) === 1) throw Object.assign(new Error('System-created seller accounts cannot be reactivated here.'),{statusCode:409});
  const groupId = Number(seller.seller_group_id || 0);
  if (!groupId) throw Object.assign(new Error('Assign this seller to an In-House Network before activating.'),{statusCode:409});
  const [[group]] = await connection.query('SELECT * FROM seller_groups WHERE seller_group_id=? LIMIT 1',[groupId]);
  if (!group || group.seller_group_type!=='in_house' || group.seller_group_status!=='active') {
    throw Object.assign(new Error('The assigned In-House Network must be active before this seller can be activated.'),{statusCode:409});
  }
  const [members] = await connection.query(`SELECT s.accredited_seller_id,s.user_id,s.accredited_seller_reports_under_user_id,s.is_system_dummy,s.accredited_seller_status,
    u.role,u.status AS user_status, TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) AS full_name
    FROM accredited_sellers s JOIN users u ON u.id=s.user_id WHERE s.seller_group_id=?`,[groupId]);
  const [links] = await connection.query(`SELECT managed.user_id AS managed_user_id,manager.user_id AS manager_user_id
    FROM accredited_seller_managed_sellers l JOIN accredited_sellers managed ON managed.accredited_seller_id=l.managed_accredited_seller_id
    JOIN accredited_sellers manager ON manager.accredited_seller_id=l.manager_accredited_seller_id WHERE managed.seller_group_id=?`,[groupId]);
  const [projects] = await connection.query(`SELECT r.seller_group_lot_project_rate_status,p.lot_project_status FROM seller_group_lot_project_rates r
    JOIN lot_projects p ON p.lot_project_id=r.lot_project_id WHERE r.seller_group_id=?`,[groupId]);
  const preview = members.map((row)=> Number(row.user_id)===Number(targetUserId) ? {...row,user_status:'active',accredited_seller_status:'active'}:row);
  const audit=buildSellerSetupAudit({group,members:preview,managerLinks:links,projects});
  const record=audit.records.find((row)=>row.userId===Number(targetUserId));
  if (!record || record.readiness!=='ready') {
    const first = record?.issues?.[0]?.message || audit.networkWarnings[0] || 'Seller setup is incomplete';
    throw Object.assign(new Error(`${first}. Check Seller Setup before activating this seller.`),{statusCode:409,code:'SELLER_SETUP_INCOMPLETE'});
  }
  return {sellerId:Number(seller.accredited_seller_id), groupId};
};
