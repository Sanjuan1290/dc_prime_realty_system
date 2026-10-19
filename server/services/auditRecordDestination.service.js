// Audit Logs read-only navigation only. Do not use historical labels or snapshots
// to infer a live destination. This module never updates a business record.
const positive = (value) => {
  const text = String(value ?? '').trim()
  if (!/^[1-9]\d*$/.test(text)) return null
  const n = Number(text)
  return Number.isSafeInteger(n) ? n : null
}

const archived = (reason = 'No verified live record is available. The original Audit Log evidence remains accessible.') => ({
  status: 'historical', reason, destination: null,
})
const destination = (path, label, kind, precision = 'exact') => ({status:'available', destination:{path,label,kind,precision}, reason:null})
const validGroupType = (kind) => kind === 'in_house' || kind === 'external'
const rolePath = (role) => `/portal/${encodeURIComponent(String(role || ''))}`

// Hard-coded SQL identifiers are deliberate allowlists, not metadata-derived names.
const accountSource = Object.freeze({
  lot_project_account: ['lot_project_accounts','lot_project_account_id'],
  lot_project_reservation: ['lot_project_accounts','lot_project_account_id'],
  lot_project_cancellation: ['lot_project_accounts','lot_project_account_id'],
  lot_project_commission_account: ['lot_project_accounts','lot_project_account_id'],
  lot_project_payment: ['lot_project_payments','lot_project_payment_id'],
  lot_project_payment_proof: ['lot_project_payments','lot_project_payment_id'],
  lot_project_signed_receipt: ['lot_project_payments','lot_project_payment_id'],
  lot_project_client_profile: ['lot_project_client_profiles','lot_project_client_profile_id'],
  lot_project_penalty_schedule: ['lot_project_payment_schedules','lot_project_payment_schedule_id'],
  lot_project_lmf_schedule: ['lot_project_payment_schedules','lot_project_payment_schedule_id'],
  lot_project_commission: ['lot_project_commissions','lot_project_commission_id'],
})

export const supportedAuditRecordTypes = Object.freeze([
  'lot_project','lot_project_settings','lot_project_listing', 'seller_group',
  'seller_group_project_rates','accredited_seller', ...Object.keys(accountSource),
])

export async function resolveAuditRecordDestination(db, log, actorRole, hasPermission = () => false) {
  const type = String(log?.entity_type || log?.entityType || '')
  const rawId = String(log?.entity_id ?? log?.entityId ?? '').trim()
  const id = positive(rawId)
  const root = rolePath(actorRole)
  if (!type || !rawId) return archived('This Audit Log does not identify a unique live record.')
  if (String(log?.action || '').toLowerCase() === 'delete') return archived('This event records a deletion. Open the saved Audit Log evidence instead of a potentially reused current record.')
  if (!supportedAuditRecordTypes.includes(type)) return archived('This feature has no verified record-specific page. The Audit Log retains its recorded details.')

  const check = (permission, path, label, kind, precision = 'exact') => hasPermission(permission) ? destination(path,label,kind,precision) : archived('Your account does not have permission to open this record. The Audit Log remains available.')
  const lookup = async (sql, args) => {
    const [rows] = await db.query(sql, args)
    return rows || []
  }
  if (type === 'lot_project' || type === 'lot_project_settings') {
    if (!id) return archived()
    const rows = await lookup('SELECT lot_project_id, lot_project_slug FROM lot_projects WHERE lot_project_id=? LIMIT 1', [id])
    if (!rows.length || !rows[0].lot_project_slug) return archived()
    const slug = encodeURIComponent(rows[0].lot_project_slug)
    return check(type === 'lot_project_settings' ? 'lot_project.settings.view' : 'lot_project.dashboard.view', `/portal/lot-projects/${slug}${type === 'lot_project_settings' ? '/settings' : ''}`, type === 'lot_project_settings' ? 'Project Settings' : 'Project Workspace','project')
  }
  if (type === 'seller_group' || type === 'seller_group_project_rates') {
    const match = rawId.match(/^([1-9]\d*)(?::([1-9]\d*))?$/)
    if (!match) return archived('The Network reference is not a unique supported ID.')
    const groupId = positive(match[1]), projectId = positive(match[2])
    if (type === 'seller_group_project_rates' && !projectId) return archived('The specific project commission structure was not recorded in the Audit Log reference.')
    const group = await lookup('SELECT seller_group_id, seller_group_type FROM seller_groups WHERE seller_group_id=? LIMIT 1', [groupId])
    if (!group.length || !validGroupType(group[0].seller_group_type)) return archived()
    if (projectId) {
      const rates = await lookup('SELECT 1 FROM seller_group_lot_project_rates WHERE seller_group_id=? AND lot_project_id=? LIMIT 1',[groupId,projectId])
      if (!rates.length) return archived('The original Network project rates are no longer available.')
    }
    const kind = group[0].seller_group_type === 'in_house' ? 'in-house' : 'external'
    return check('system.seller_groups.view', `${root}/accredited/groups/${kind}/${groupId}${projectId ? `?project=${projectId}` : ''}`, 'Network Details', 'network')
  }
  if (type === 'accredited_seller') {
    if (!id) return archived()
    const rows = await lookup('SELECT s.accredited_seller_id, s.user_id, s.seller_group_id, g.seller_group_type FROM accredited_sellers s LEFT JOIN seller_groups g ON g.seller_group_id=s.seller_group_id WHERE s.accredited_seller_id=? LIMIT 1',[id])
    if (!rows.length) return archived()
    const s = rows[0]
    const groupId = positive(s.seller_group_id), userId = positive(s.user_id)
    if (s.seller_group_type === 'in_house' && groupId && userId) return check('system.accredited.view',`${root}/accredited/groups/in-house/${groupId}/members/${userId}`,'Seller Profile','seller')
    return check('system.accredited.view',`${root}/accredited/sellers/${id}`,'Seller Profile','seller')
  }
  if (type === 'lot_project_listing') {
    if (!id) return archived()
    const rows = await lookup('SELECT l.lot_project_listing_id, p.lot_project_slug FROM lot_project_listings l JOIN lot_projects p ON p.lot_project_id=l.lot_project_id WHERE l.lot_project_listing_id=? LIMIT 1',[id])
    if (!rows.length || !rows[0].lot_project_slug) return archived()
    return check('lot_project.listing_profile.view',`/portal/lot-projects/${encodeURIComponent(rows[0].lot_project_slug)}/listings/${id}`,'Listing Profile','listing')
  }
  // Exact buyer-account ID, not matching Unit ID or buyer name.
  if (!id) return archived('This record does not have a unique numeric ID.')
  const [table, primaryKey] = accountSource[type]
  const rows = await lookup(`SELECT * FROM ${table} WHERE ${primaryKey}=? LIMIT 1`, [id])
  if (!rows.length) return archived()
  const row = rows[0]
  let accountId = type === 'lot_project_client_profile' ? null : positive(row.lot_project_account_id)
  if (['lot_project_account','lot_project_reservation','lot_project_cancellation','lot_project_commission_account'].includes(type)) accountId = id
  if (type === 'lot_project_client_profile') {
    // A profile may have multiple generations. Never pick one by LIMIT 1.
    const accounts = await lookup('SELECT lot_project_account_id FROM lot_project_accounts WHERE lot_project_client_profile_id=? LIMIT 2',[id])
    if (accounts.length !== 1) return archived('The client profile does not resolve to exactly one buyer account. Review saved evidence instead.')
    accountId=positive(accounts[0].lot_project_account_id)
  }
  if (!accountId) return archived('This event cannot be tied to one buyer account without guessing.')
  const accounts = await lookup('SELECT a.lot_project_account_id, a.lot_project_listing_id, p.lot_project_slug FROM lot_project_accounts a JOIN lot_projects p ON p.lot_project_id=a.lot_project_id WHERE a.lot_project_account_id=? LIMIT 1',[accountId])
  if (!accounts.length || !positive(accounts[0].lot_project_listing_id) || !accounts[0].lot_project_slug) return archived()
  const a = accounts[0]
  if (positive(row.lot_project_listing_id) && positive(row.lot_project_listing_id) !== positive(a.lot_project_listing_id)) return archived('The record and buyer account reference different listings.')
  const path = `/portal/lot-projects/${encodeURIComponent(a.lot_project_slug)}/listings/${positive(a.lot_project_listing_id)}/accounts/${accountId}`
  const exactAccount = ['lot_project_account','lot_project_reservation','lot_project_cancellation','lot_project_commission_account'].includes(type)
  return check('lot_project.listing_profile.view',path,exactAccount ? 'Buyer Account' : 'Related Buyer Account','buyer-account',exactAccount ? 'exact' : 'parent-record')
}
