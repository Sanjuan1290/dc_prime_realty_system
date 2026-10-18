import crypto from 'node:crypto';

export const sellerChangeError = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
export const isSellerChangeStageUntouched = (row = {}) =>
  (row.release_status === 'Pending' || (row.release_status === 'On Hold' && row.release_stage === 'Retention'))
  && !row.actual_release_date && !row.released_by_user_id && !row.release_recorded_at
  && !row.cancellation_settled_at && !row.external_receipt_hold_source_release_id
  && !(Number(row.deduction_amount || 0) > 0)
  && !row.external_agent_receipt_status?.match?.(/submitted/i)
  && !row.historical_release_note;
export const isNetworkProfitStageUntouched = (row = {}) =>
  row.release_status === 'Pending'
  && !row.actual_release_date && !row.released_by_user_id
  && !row.release_recorded_at && !row.payment_reference && !row.receipt_date;
export const safeJsonHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sellerChangePayload = ({ accountId, listingId, currentSellerId, newSellerId, fingerprint, reason }) => ({
  accountId: Number(accountId), listingId: Number(listingId), currentSellerId: Number(currentSellerId),
  newSellerId: Number(newSellerId), fingerprint: String(fingerprint), reason: String(reason).trim(),
});
export const sellerChangeSnapshot = (rows = []) => rows.map(row => ({
  commissionId: Number(row.commissionId || row.lot_project_commission_id || 0),
  accreditedSellerId: Number(row.accreditedSellerId || row.accredited_seller_id || 0),
  sellerName: row.sellerName || row.seller_display_name_snapshot || row.seller_name || '',
  role: row.role || row.commission_role || '',
  rate: Number(row.rate ?? row.commission_rate ?? 0),
  grossCommission: Number(row.grossCommission ?? row.gross_commission_amount ?? 0),
  commissionBase: Number(row.commissionBase ?? row.commission_base_amount ?? 0),
}));
