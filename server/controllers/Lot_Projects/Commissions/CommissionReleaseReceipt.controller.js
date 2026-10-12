import { db, getProjectBySlug, getErrorMessage } from '../_shared/lotProject.shared.js';

export const getCommissionReleaseReceipt = async (req, res) => {
  const commissionId = Number(req.params.commissionId);
  const stageId = Number(req.params.releaseId);
  if (!Number.isSafeInteger(commissionId) || commissionId < 1 || !Number.isSafeInteger(stageId) || stageId < 1) {
    return res.status(400).json({ success: false, message: 'Invalid commission or release stage.' });
  }
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    const [rows] = await connection.query(`
      SELECT receipt.lot_project_commission_receipt_id, receipt.accredited_seller_id,
        receipt.bank_name, receipt.account_number, receipt.receipt_date, receipt.reference_number,
        receipt.witness_name, receipt.total_amount,
        listing.lot_project_listing_unit_id AS unit_id, profile.buyer_full_name AS buyer_name,
        commission.commission_role, commission.commission_rate,
        commission.gross_commission_amount AS gross_commission,
        stage.release_stage, stage.release_percent, stage.release_trigger_percent,
        stage.net_release_amount
      FROM lot_project_commission_receipt_items item
      INNER JOIN lot_project_commission_receipts receipt
        ON receipt.lot_project_commission_receipt_id = item.lot_project_commission_receipt_id
      INNER JOIN lot_project_commission_releases stage
        ON stage.lot_project_commission_release_id = item.lot_project_commission_release_id
      INNER JOIN lot_project_commissions commission
        ON commission.lot_project_commission_id = stage.lot_project_commission_id
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = receipt.lot_project_listing_id
      INNER JOIN lot_project_client_profiles profile
        ON profile.lot_project_client_profile_id = receipt.lot_project_client_profile_id
      WHERE commission.lot_project_id = ? AND commission.lot_project_commission_id = ?
        AND stage.lot_project_commission_release_id = ?
        AND receipt.lot_project_commission_id = commission.lot_project_commission_id
        AND (receipt.lot_project_account_id IS NULL OR receipt.lot_project_account_id = commission.lot_project_account_id)
        AND receipt.receipt_status = 'active' AND stage.release_status = 'Released'
      LIMIT 1`, [project.lot_project_id, commissionId, stageId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, code: 'RELEASE_RECEIPT_NOT_FOUND', message: 'No Proof of Income receipt is linked to this released milestone. Check Accredited Sellers for older receipts.' });
    return res.json({ success: true, data: {
      accreditedSellerId: Number(row.accredited_seller_id),
      receipt: { receiptId: Number(row.lot_project_commission_receipt_id),
        bankName: row.bank_name, accountNumber: row.account_number,
        receiptDate: row.receipt_date, referenceNumber: row.reference_number,
        witnessName: row.witness_name, totalAmount: Number(row.total_amount),
        unitId: row.unit_id, buyerName: row.buyer_name, commissionRole: row.commission_role,
        commissionRate: Number(row.commission_rate), grossCommission: Number(row.gross_commission),
        releasePercent: Number(row.release_percent),
        cumulativeTargetPercent: Number(row.release_trigger_percent),
        releases: [{ stage: row.release_stage, releasePercent: Number(row.release_percent),
          triggerPercent: Number(row.release_trigger_percent), netAmount: Number(row.net_release_amount) }] },
    } });
  } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) }); }
  finally { connection.release(); }
};
