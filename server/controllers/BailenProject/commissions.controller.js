import { db } from '../../db/connect.js';
import { fullNameSql, getActorId, syncCommissionForListing, toNumber } from '../../utils/bailenHelpers.js';
const getError = (error) => error?.message || 'Something went wrong.';

const commissionSql = `
  SELECT bc.*, bl.unit_code, cp.buyer_name, sg.seller_group_name, ${fullNameSql('seller')} AS seller_name
  FROM bailen_commissions bc
  INNER JOIN bailen_listings bl ON bl.bailen_listing_id = bc.bailen_listing_id
  LEFT JOIN bailen_client_profiles cp ON cp.bailen_listing_id = bl.bailen_listing_id
  LEFT JOIN users seller ON seller.id = bc.seller_user_id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = bc.seller_group_id
`;

export const getCommissions = async (req, res) => {
  try {
    const [listingIds] = await db.query('SELECT bailen_listing_id FROM bailen_listings WHERE status = "sold"');
    for (const row of listingIds) await syncCommissionForListing(row.bailen_listing_id);

    const [rows] = await db.query(`${commissionSql} ORDER BY bc.updated_at DESC`);
    const [[summary]] = await db.query('SELECT COUNT(*) AS total_records, COALESCE(SUM(gross_commission),0) AS gross_commission, COALESCE(SUM(released_amount),0) AS released_amount, COALESCE(SUM(net_remaining),0) AS net_remaining FROM bailen_commissions');
    return res.json({ data: rows, summary });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const getCommissionDetails = async (req, res) => {
  try {
    const commissionId = Number(req.params.id);
    const [[commission]] = await db.query(`${commissionSql} WHERE bc.commission_id = ? LIMIT 1`, [commissionId]);
    if (!commission) return res.status(404).json({ message: 'Commission not found.' });
    await syncCommissionForListing(commission.bailen_listing_id);
    const [[freshCommission]] = await db.query(`${commissionSql} WHERE bc.commission_id = ? LIMIT 1`, [commissionId]);
    const [releases] = await db.query('SELECT * FROM bailen_commission_releases WHERE commission_id = ? ORDER BY milestone_threshold ASC, commission_release_id ASC', [commissionId]);
    return res.json({ commission: freshCommission, releases });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const releaseCommission = async (req, res) => {
  try {
    const releaseId = Number(req.params.releaseId);
    const today = new Date();
    const day = today.getDate();
    const [[settings]] = await db.query('SELECT setting_value FROM bailen_settings WHERE setting_key = "commission_release_days" LIMIT 1');
    const allowedDays = String(settings?.setting_value || '7,22').split(',').map((item) => Number(item.trim()));
    if (!allowedDays.includes(day)) return res.status(400).json({ message: `Commission releases are only allowed on ${allowedDays.join(' / ')}.` });

    const [[release]] = await db.query('SELECT * FROM bailen_commission_releases WHERE commission_release_id = ? LIMIT 1', [releaseId]);
    if (!release) return res.status(404).json({ message: 'Commission release not found.' });
    if (release.status !== 'pending') return res.status(400).json({ message: 'Only pending milestones can be released.' });

    const reference = `REL-${today.toISOString().slice(0,10).replace(/-/g,'')}-${String(releaseId).padStart(4,'0')}`;
    await db.query('UPDATE bailen_commission_releases SET status = "released", release_reference = ?, released_at = NOW(), released_by_user_id = ? WHERE commission_release_id = ?', [reference, getActorId(req), releaseId]);

    const [[totals]] = await db.query('SELECT commission_id, COALESCE(SUM(CASE WHEN status = "released" THEN gross_amount ELSE 0 END),0) AS released FROM bailen_commission_releases WHERE commission_id = ? GROUP BY commission_id', [release.commission_id]);
    const [[commission]] = await db.query('SELECT gross_commission FROM bailen_commissions WHERE commission_id = ?', [release.commission_id]);
    const released = toNumber(totals?.released);
    await db.query('UPDATE bailen_commissions SET released_amount = ?, net_remaining = GREATEST(gross_commission - ?, 0), status = CASE WHEN ? >= gross_commission THEN "released" ELSE "partially_released" END WHERE commission_id = ?', [released, released, released, release.commission_id]);
    return res.json({ message: 'Commission milestone released successfully.', reference });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};
