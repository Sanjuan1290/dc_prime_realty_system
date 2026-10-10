// Resolve the *current* destination for historical Review Center links.
// Snapshots can omit groupType or contain outdated membership information.
const positiveId = (value) => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
const snapshot = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) || {} } catch { return {} }
}

export async function resolveReviewRecordLocation(connection, review) {
  const type = String(review?.entity_type || '')
  const after = snapshot(review?.after_snapshot_json)
  const before = snapshot(review?.before_snapshot_json)
  if (type === 'seller_group' || type === 'seller_group_project_rates') {
    const fromEntity = String(review?.entity_id || '').split(':')[0]
    const id = positiveId(fromEntity) || positiveId(after.groupId) || positiveId(before.groupId)
    if (!id) return { entityExists: false, recordLocation: null, recordUnavailableReason: 'This review has no valid Network ID.' }
    const [rows] = await connection.query(
      'SELECT seller_group_id, seller_group_type FROM seller_groups WHERE seller_group_id=? LIMIT 1', [id]
    )
    if (!rows?.length) return { entityExists: false, recordLocation: null, recordUnavailableReason: 'This Network no longer exists. Its review history remains available here.' }
    const networkType = rows[0].seller_group_type
    if (!['external', 'in_house'].includes(networkType)) {
      return { entityExists: true, recordLocation: null, recordUnavailableReason: 'The Network type could not be verified. Open it from Accredited Sellers instead.' }
    }
    return { entityExists: true, recordLocation: { kind: 'network', groupId: id, groupType: networkType }, recordUnavailableReason: null }
  }
  if (type === 'accredited_seller') {
    const id = positiveId(String(review?.entity_id || '').split(':')[0]) || positiveId(after.accreditedSellerId) || positiveId(before.accreditedSellerId)
    if (!id) return { entityExists: false, recordLocation: null, recordUnavailableReason: 'This review has no valid seller ID.' }
    const [rows] = await connection.query(`
      SELECT a.accredited_seller_id, a.seller_group_id, a.user_id, g.seller_group_type
      FROM accredited_sellers a
      LEFT JOIN seller_groups g ON g.seller_group_id = a.seller_group_id
      WHERE a.accredited_seller_id=? LIMIT 1`, [id])
    if (!rows?.length) return { entityExists: false, recordLocation: null, recordUnavailableReason: 'This accredited seller no longer exists. Its review history remains available here.' }
    const row = rows[0]
    const verifiedType = ['external', 'in_house'].includes(row.seller_group_type) ? row.seller_group_type : null
    return { entityExists: true,
      recordLocation: { kind: 'seller', sellerId: id, sellerUserId: Number(row.user_id), sellerGroupId: positiveId(row.seller_group_id), groupType: verifiedType },
      recordUnavailableReason: null }
  }
  return { entityExists: true, recordLocation: null, recordUnavailableReason: null }
}
