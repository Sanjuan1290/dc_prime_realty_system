import { db } from '../../db/connect.js';
import { buildSellerSetupAudit } from '../../services/sellerSetupAudit.service.js';

// Read-only owner-administrator report: does not modify seller, group or financial records.
export const getSellerSetupAudit = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.groupId || 0);
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return res.status(400).json({ message: 'Select a valid Network.' });
    const [groups] = await connection.query('SELECT * FROM seller_groups WHERE seller_group_id = ? LIMIT 1', [groupId]);
    const group = groups[0];
    if (!group) return res.status(404).json({ message: 'Network not found.' });
    if (group.seller_group_type !== 'in_house') return res.status(400).json({ message: 'Seller setup checks are for In-House Networks.' });
    const [members] = await connection.query(`
      SELECT s.accredited_seller_id, s.user_id, s.accredited_seller_reports_under_user_id,
             s.is_system_dummy, s.accredited_seller_status,
             u.role, u.status AS user_status, u.account_code,
             TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name
      FROM accredited_sellers s JOIN users u ON u.id = s.user_id
      WHERE s.seller_group_id = ? ORDER BY s.accredited_seller_id`, [groupId]);
    const [managerLinks] = await connection.query(`
      SELECT managed.user_id AS managed_user_id, manager.user_id AS manager_user_id
      FROM accredited_seller_managed_sellers link
      JOIN accredited_sellers managed ON managed.accredited_seller_id = link.managed_accredited_seller_id
      JOIN accredited_sellers manager ON manager.accredited_seller_id = link.manager_accredited_seller_id
      WHERE managed.seller_group_id = ?`, [groupId]);
    const [projects] = await connection.query(`
      SELECT rates.seller_group_lot_project_rate_status, project.lot_project_status
      FROM seller_group_lot_project_rates rates
      JOIN lot_projects project ON project.lot_project_id = rates.lot_project_id
      WHERE rates.seller_group_id = ?`, [groupId]);
    const [assignedCounts] = await connection.query(`
      SELECT profile.assigned_accredited_seller_id, COUNT(*) AS buyer_count
      FROM lot_project_client_profiles profile
      JOIN accredited_sellers s ON s.accredited_seller_id = profile.assigned_accredited_seller_id
      WHERE s.seller_group_id = ? GROUP BY profile.assigned_accredited_seller_id`, [groupId]);
    return res.json({success:true, data:buildSellerSetupAudit({group,members,managerLinks,projects,assignedCounts})});
  } catch(error) {
    return res.status(500).json({message:'Could not check seller assignments. Try again.'});
  } finally {connection.release();}
};
