import {
  db,
  getErrorMessage,
  tableExists,
} from '../Lot_Projects/_shared/lotProject.shared.js'
import { writeAuditLog } from './auditLogs.controller.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const clean = (value = '') => String(value ?? '').trim()
const number = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const roundMoney = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100
const plainDate = (value) => value ? String(value).slice(0, 10) : null

const normalizeDate = (value) => {
  const text = clean(value)
  if (!ISO_DATE.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return text
}

const resolveDateRange = (req) => {
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const from = normalizeDate(req.query.from) || defaultFrom
  const to = normalizeDate(req.query.to) || defaultTo
  if (from > to) {
    const error = new Error('Report From date cannot be after To date.')
    error.statusCode = 400
    throw error
  }
  return { from, to }
}

const buildScope = (req, alias = 'project') => {
  const projectId = Number(req.query.projectId || 0)
  return projectId > 0
    ? { sql: `AND ${alias}.lot_project_id = ?`, params: [projectId], projectId }
    : { sql: '', params: [], projectId: null }
}

const sellerNameSql = `TRIM(CONCAT_WS(' ', seller_user.first_name, seller_user.middle_name, seller_user.last_name))`
const verifierNameSql = `TRIM(CONCAT_WS(' ', verifier.first_name, verifier.middle_name, verifier.last_name))`

const mapReservation = (row = {}) => ({
  id: Number(row.lot_project_reservation_history_id || 0),
  reservationDate: row.reserved_at,
  projectId: Number(row.lot_project_id || 0),
  project: row.lot_project_name || '-',
  unit: row.unit_id_snapshot || row.lot_project_listing_unit_id || '-',
  buyer: row.buyer_name_snapshot || row.buyer_full_name || '-',
  accountReference: row.account_reference || '-',
  reservationStatus: row.reservation_status || '-',
  accountStatus: row.account_status || '-',
  modeOfPayment: row.pricing_mode_snapshot || row.soa_mode_of_payment || '-',
  baseSellingPrice: number(row.base_selling_price_snapshot),
  saleDiscountAmount: number(row.sale_discount_amount_snapshot),
  dpDiscountAmount: number(row.dp_discount_amount_snapshot),
  tcp: number(row.tcp_snapshot),
  sellerId: Number(row.assigned_accredited_seller_id || 0) || null,
  seller: row.seller_name || '-',
  sellerGroup: row.seller_group_name || '-',
})

const mapCancellation = (row = {}) => ({
  id: Number(row.lot_project_reservation_history_id || 0),
  cancellationDate: row.cancelled_at,
  projectId: Number(row.lot_project_id || 0),
  project: row.lot_project_name || '-',
  unit: row.unit_id_snapshot || '-',
  buyer: row.buyer_name_snapshot || '-',
  accountReference: row.account_reference || '-',
  cancellationType: row.cancellation_type || '-',
  refundType: row.cancellation_refund_type || '-',
  reason: row.cancellation_reason || '',
  cancelledValue: number(row.cancelled_value),
  cashCollected: number(row.cash_collected_at_cancellation),
  refundAmount: number(row.refund_amount),
  discontinuedAmount: number(row.discontinued_amount),
  refundDate: row.refund_date || null,
  refundReference: row.refund_reference || '',
  cancelledBy: row.cancelled_by_name || '-',
})

const mapPayment = (row = {}) => ({
  id: Number(row.lot_project_payment_id || 0),
  paymentDate: row.lot_project_payment_date,
  projectId: Number(row.lot_project_id || 0),
  project: row.lot_project_name || '-',
  unit: row.lot_project_listing_unit_id || row.unit_id_snapshot || '-',
  buyer: row.buyer_full_name || row.buyer_name_snapshot || '-',
  accountReference: row.account_reference || '-',
  type: row.lot_project_payment_type || '-',
  method: row.lot_project_payment_method || '-',
  bank: row.lot_project_payment_bank_name || '',
  accountNumber: row.lot_project_payment_account_number || '',
  reference: row.lot_project_payment_reference_id || '',
  amount: number(row.lot_project_payment_amount),
  status: row.lot_project_payment_status || '-',
  verifiedBy: row.verified_by_name || '-',
  verifiedAt: row.lot_project_payment_verified_at || null,
  sellerId: Number(row.assigned_accredited_seller_id || 0) || null,
})

const filterSearch = (rows, search) => {
  const term = clean(search).toLowerCase()
  if (!term) return rows
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term)))
}

export const getSystemReports = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const { from, to } = resolveDateRange(req)
    const projectScope = buildScope(req, 'project')
    const sellerId = Number(req.query.sellerId || 0) || null
    const search = clean(req.query.search)

    const requiredTables = [
      'lot_projects',
      'lot_project_listings',
      'lot_project_client_profiles',
      'lot_project_reservation_history',
      'lot_project_payments',
      'lot_project_commissions',
      'lot_project_commission_releases',
    ]
    const missing = []
    for (const table of requiredTables) if (!(await tableExists(connection, table))) missing.push(table)
    if (missing.length) {
      return res.status(500).json({ message: `Reports cannot load because required table(s) are missing: ${missing.join(', ')}.` })
    }

    const [projectRows] = await connection.query(
      `SELECT lot_project_id AS id, lot_project_name AS name, lot_project_slug AS slug
       FROM lot_projects
       ORDER BY lot_project_name ASC`
    )
    const [sellerRows] = await connection.query(
      `SELECT seller.accredited_seller_id AS id,
              ${sellerNameSql} AS name,
              group_row.seller_group_name AS groupName
       FROM accredited_sellers seller
       INNER JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       WHERE seller.accredited_seller_status = 'active'
       ORDER BY name ASC`
    )

    const sellerReservationSql = sellerId ? 'AND profile.assigned_accredited_seller_id = ?' : ''
    const sellerReservationParams = sellerId ? [sellerId] : []

    const [reservationRows] = await connection.query(
      `SELECT history.*,
              project.lot_project_name,
              listing.lot_project_listing_unit_id,
              account.account_reference,
              account.account_status,
              profile.buyer_full_name,
              profile.soa_mode_of_payment,
              profile.assigned_accredited_seller_id,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name
       FROM lot_project_reservation_history history
       INNER JOIN lot_projects project ON project.lot_project_id = history.lot_project_id
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = history.lot_project_listing_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = history.lot_project_account_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = history.lot_project_client_profile_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = profile.assigned_accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       WHERE DATE(history.reserved_at) BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY history.reserved_at DESC, history.lot_project_reservation_history_id DESC`,
      [from, to, ...projectScope.params, ...sellerReservationParams]
    )

    const [cancellationRows] = await connection.query(
      `SELECT history.*,
              project.lot_project_name,
              account.account_reference,
              TRIM(CONCAT_WS(' ', cancelled_user.first_name, cancelled_user.middle_name, cancelled_user.last_name)) AS cancelled_by_name
       FROM lot_project_reservation_history history
       INNER JOIN lot_projects project ON project.lot_project_id = history.lot_project_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = history.lot_project_account_id
       LEFT JOIN users cancelled_user ON cancelled_user.id = history.cancelled_by_user_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = history.lot_project_client_profile_id
       WHERE history.cancelled_at IS NOT NULL
         AND DATE(history.cancelled_at) BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY history.cancelled_at DESC, history.lot_project_reservation_history_id DESC`,
      [from, to, ...projectScope.params, ...sellerReservationParams]
    )

    const [paymentRows] = await connection.query(
      `SELECT payment.*,
              project.lot_project_name,
              listing.lot_project_listing_unit_id,
              account.account_reference,
              account.unit_id_snapshot,
              account.buyer_name_snapshot,
              profile.buyer_full_name,
              profile.assigned_accredited_seller_id,
              ${verifierNameSql} AS verified_by_name
       FROM lot_project_payments payment
       INNER JOIN lot_projects project ON project.lot_project_id = payment.lot_project_id
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = payment.lot_project_listing_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = payment.lot_project_account_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = payment.lot_project_client_profile_id
       LEFT JOIN users verifier ON verifier.id = payment.lot_project_payment_verified_by_user_id
       WHERE payment.lot_project_payment_date BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY payment.lot_project_payment_date DESC, payment.lot_project_payment_id DESC`,
      [from, to, ...projectScope.params, ...sellerReservationParams]
    )

    // Account snapshot as of the report end date. Cancellation_date is used instead
    // of the current account status so historical ranges remain meaningful.
    const [accountRows] = await connection.query(
      `SELECT account.lot_project_account_id,
              account.account_reference,
              account.account_status,
              account.reservation_date,
              account.cancellation_date,
              account.buyer_name_snapshot,
              account.unit_id_snapshot,
              project.lot_project_id,
              project.lot_project_name,
              profile.assigned_accredited_seller_id,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name,
              COALESCE(history.tcp_snapshot, profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0) AS contract_tcp,
              COALESCE(history.dp_discount_amount_snapshot, 0) AS dp_discount_amount,
              COALESCE(profile.soa_lmf_waived_amount, 0) AS lmf_waived_amount,
              COALESCE(payment_summary.verified_paid, 0) AS cumulative_paid
       FROM lot_project_accounts account
       INNER JOIN lot_projects project ON project.lot_project_id = account.lot_project_id
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = account.lot_project_listing_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
       LEFT JOIN lot_project_reservation_history history ON history.lot_project_reservation_history_id = account.lot_project_reservation_history_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = profile.assigned_accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       LEFT JOIN (
         SELECT lot_project_account_id,
                SUM(CASE WHEN lot_project_payment_status = 'Verified' AND lot_project_payment_date <= ? THEN lot_project_payment_amount ELSE 0 END) AS verified_paid
         FROM lot_project_payments
         GROUP BY lot_project_account_id
       ) payment_summary ON payment_summary.lot_project_account_id = account.lot_project_account_id
       WHERE DATE(COALESCE(account.reservation_date, account.created_at)) <= ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY project.lot_project_name, account.unit_id_snapshot`,
      [to, to, ...projectScope.params, ...sellerReservationParams]
    )

    const [commissionRows] = await connection.query(
      `SELECT commission.*,
              project.lot_project_name,
              listing.lot_project_listing_unit_id,
              profile.buyer_full_name,
              account.account_reference,
              COALESCE(history.reserved_at, account.reservation_date, commission.created_at) AS sale_date,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name
       FROM lot_project_commissions commission
       INNER JOIN lot_projects project ON project.lot_project_id = commission.lot_project_id
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = commission.lot_project_listing_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = commission.lot_project_account_id
       LEFT JOIN lot_project_reservation_history history ON history.lot_project_reservation_history_id = account.lot_project_reservation_history_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = commission.accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       WHERE DATE(COALESCE(history.reserved_at, account.reservation_date, commission.created_at)) BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerId ? 'AND commission.accredited_seller_id = ?' : ''}
       ORDER BY sale_date DESC, commission.lot_project_commission_id DESC`,
      [from, to, ...projectScope.params, ...(sellerId ? [sellerId] : [])]
    )

    const [releaseRows] = await connection.query(
      `SELECT release_row.*,
              commission.lot_project_commission_id,
              commission.accredited_seller_id,
              commission.commission_role,
              commission.gross_commission_amount,
              project.lot_project_id,
              project.lot_project_name,
              listing.lot_project_listing_unit_id,
              profile.buyer_full_name,
              account.account_reference,
              COALESCE(history.tcp_snapshot, profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0) AS contract_tcp,
              COALESCE(history.dp_discount_amount_snapshot, 0) AS dp_discount_amount,
              COALESCE(profile.soa_lmf_waived_amount, 0) AS lmf_waived_amount,
              COALESCE(payment_summary.verified_paid, 0) AS cumulative_paid,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name,
              ${verifierNameSql} AS released_by_name
       FROM lot_project_commission_releases release_row
       INNER JOIN lot_project_commissions commission ON commission.lot_project_commission_id = release_row.lot_project_commission_id
       INNER JOIN lot_projects project ON project.lot_project_id = commission.lot_project_id
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = commission.lot_project_listing_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = commission.lot_project_account_id
       LEFT JOIN lot_project_reservation_history history ON history.lot_project_reservation_history_id = account.lot_project_reservation_history_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = commission.accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       LEFT JOIN users verifier ON verifier.id = release_row.released_by_user_id
       LEFT JOIN (
         SELECT lot_project_account_id,
                SUM(CASE WHEN lot_project_payment_status = 'Verified' AND lot_project_payment_date <= ? THEN lot_project_payment_amount ELSE 0 END) AS verified_paid
         FROM lot_project_payments
         GROUP BY lot_project_account_id
       ) payment_summary ON payment_summary.lot_project_account_id = commission.lot_project_account_id
       WHERE 1 = 1
         ${projectScope.sql}
         ${sellerId ? 'AND commission.accredited_seller_id = ?' : ''}
       ORDER BY project.lot_project_name, commission.lot_project_commission_id,
                FIELD(release_row.release_stage, '1st Release','2nd Release','3rd Release','4th Release','Retention')`,
      [to, ...projectScope.params, ...(sellerId ? [sellerId] : [])]
    )

    let reservations = reservationRows.map(mapReservation)
    let cancellations = cancellationRows.map(mapCancellation)
    let payments = paymentRows.map(mapPayment)

    if (search) {
      reservations = filterSearch(reservations, search)
      cancellations = filterSearch(cancellations, search)
      payments = filterSearch(payments, search)
    }

    let accounts = accountRows.map((row) => {
      const contractValue = Math.max(number(row.contract_tcp) - number(row.dp_discount_amount) - number(row.lmf_waived_amount), 0)
      const cumulativePaid = number(row.cumulative_paid)
      const activeAsOf = !row.cancellation_date || String(row.cancellation_date).slice(0, 10) > to
      return {
        accountId: Number(row.lot_project_account_id || 0),
        accountReference: row.account_reference || '-',
        projectId: Number(row.lot_project_id || 0),
        project: row.lot_project_name || '-',
        unit: row.unit_id_snapshot || '-',
        buyer: row.buyer_name_snapshot || '-',
        sellerId: Number(row.assigned_accredited_seller_id || 0) || null,
        seller: row.seller_name || '-',
        sellerGroup: row.seller_group_name || '-',
        reservationDate: row.reservation_date,
        cancellationDate: row.cancellation_date,
        accountStatus: row.account_status,
        contractValue: roundMoney(contractValue),
        cumulativePaid: roundMoney(cumulativePaid),
        outstanding: activeAsOf ? roundMoney(Math.max(contractValue - cumulativePaid, 0)) : 0,
        activeAsOf,
      }
    })

    let commissions = commissionRows.map((row) => ({
      id: Number(row.lot_project_commission_id || 0),
      saleDate: row.sale_date,
      projectId: Number(row.lot_project_id || 0),
      project: row.lot_project_name || '-',
      unit: row.lot_project_listing_unit_id || '-',
      buyer: row.buyer_full_name || '-',
      accountReference: row.account_reference || '-',
      sellerId: Number(row.accredited_seller_id || 0) || null,
      seller: row.seller_name || row.seller_display_name_snapshot || '-',
      sellerGroup: row.seller_group_name || row.seller_group_name_snapshot || '-',
      role: row.commission_role || '-',
      grossCommission: number(row.gross_commission_amount),
      releasedCommission: number(row.released_commission_amount),
      remainingCommission: number(row.net_remaining_commission_amount),
      status: row.commission_status || '-',
    }))

    let releases = releaseRows.map((row) => {
      const effectiveTcp = Math.max(number(row.contract_tcp) - number(row.dp_discount_amount) - number(row.lmf_waived_amount), 0)
      const cumulativePaid = number(row.cumulative_paid)
      const paymentPercent = effectiveTcp > 0 ? Math.min(100, (cumulativePaid / effectiveTcp) * 100) : 0
      const status = String(row.release_status || 'Pending')
      const releasedByToDate = row.actual_release_date && String(row.actual_release_date).slice(0, 10) <= to && status === 'Released'
      const terminal = ['Cancelled', 'Forfeited on Cancellation'].includes(status)
      const held = status === 'On Hold'
      const triggerReached = paymentPercent + 0.0001 >= number(row.release_trigger_percent)
      const retentionReadyByPayment = String(row.release_stage) !== 'Retention' || paymentPercent >= 99.999
      const eligibleAsOf = !releasedByToDate && !terminal && !held && triggerReached && retentionReadyByPayment
      return {
        id: Number(row.lot_project_commission_release_id || 0),
        commissionId: Number(row.lot_project_commission_id || 0),
        projectId: Number(row.lot_project_id || 0),
        project: row.lot_project_name || '-',
        unit: row.lot_project_listing_unit_id || '-',
        buyer: row.buyer_full_name || '-',
        accountReference: row.account_reference || '-',
        sellerId: Number(row.accredited_seller_id || 0) || null,
        seller: row.seller_name || '-',
        sellerGroup: row.seller_group_name || '-',
        role: row.commission_role || '-',
        stage: row.release_stage || '-',
        triggerPercent: number(row.release_trigger_percent),
        releasePercent: number(row.release_percent),
        grossAmount: number(row.gross_release_amount),
        deductionAmount: number(row.deduction_amount),
        netAmount: number(row.net_release_amount),
        status,
        paymentPercent: roundMoney(paymentPercent),
        eligibleAsOf,
        scheduledReleaseDate: row.scheduled_release_date || null,
        actualReleaseDate: row.actual_release_date || null,
        releasedBy: row.released_by_name || '-',
      }
    })

    if (search) {
      accounts = filterSearch(accounts, search)
      commissions = filterSearch(commissions, search)
      releases = filterSearch(releases, search)
    }

    const verifiedPayments = payments.filter((row) => row.status === 'Verified')
    const releasedInRange = releases.filter((row) => {
      const actualReleaseDate = plainDate(row.actualReleaseDate)
      return row.status === 'Released' && actualReleaseDate && actualReleaseDate >= from && actualReleaseDate <= to
    })
    const eligibleUnreleased = releases.filter((row) => row.eligibleAsOf)
    const activeAccounts = accounts.filter((row) => row.activeAsOf)

    const sellerPerformanceMap = new Map()
    for (const sale of reservations) {
      const key = sale.sellerId || `name:${sale.seller}`
      const current = sellerPerformanceMap.get(key) || { sellerId: sale.sellerId, seller: sale.seller, sellerGroup: sale.sellerGroup, reservations: 0, salesAmount: 0 }
      current.reservations += 1
      current.salesAmount += sale.tcp
      sellerPerformanceMap.set(key, current)
    }
    for (const payment of verifiedPayments) {
      const account = accounts.find((item) => item.accountReference === payment.accountReference)
      const key = account?.sellerId || `name:${account?.seller || '-'}`
      const current = sellerPerformanceMap.get(key) || { sellerId: account?.sellerId || null, seller: account?.seller || '-', sellerGroup: account?.sellerGroup || '-', reservations: 0, salesAmount: 0 }
      current.collectedInRange = number(current.collectedInRange) + payment.amount
      sellerPerformanceMap.set(key, current)
    }
    for (const commission of commissions) {
      const key = commission.sellerId || `name:${commission.seller}`
      const current = sellerPerformanceMap.get(key) || { sellerId: commission.sellerId, seller: commission.seller, sellerGroup: commission.sellerGroup, reservations: 0, salesAmount: 0 }
      current.grossCommission = number(current.grossCommission) + commission.grossCommission
      sellerPerformanceMap.set(key, current)
    }
    for (const release of releasedInRange) {
      const key = release.sellerId || `name:${release.seller}`
      const current = sellerPerformanceMap.get(key) || { sellerId: release.sellerId, seller: release.seller, sellerGroup: release.sellerGroup, reservations: 0, salesAmount: 0 }
      current.releasedCommission = number(current.releasedCommission) + release.netAmount
      sellerPerformanceMap.set(key, current)
    }
    for (const release of eligibleUnreleased) {
      const key = release.sellerId || `name:${release.seller}`
      const current = sellerPerformanceMap.get(key) || { sellerId: release.sellerId, seller: release.seller, sellerGroup: release.sellerGroup, reservations: 0, salesAmount: 0 }
      current.eligibleUnreleased = number(current.eligibleUnreleased) + release.netAmount
      sellerPerformanceMap.set(key, current)
    }

    const projectBreakdownMap = new Map(projectRows.map((project) => [Number(project.id), {
      projectId: Number(project.id), project: project.name, reservations: 0, cancelled: 0, collectedInRange: 0, cumulativeCollected: 0, outstanding: 0, refunded: 0, commissionReleased: 0, eligibleUnreleased: 0,
    }]))
    for (const row of reservations) { const item = projectBreakdownMap.get(row.projectId); if (item) item.reservations += 1 }
    for (const row of cancellations) { const item = projectBreakdownMap.get(row.projectId); if (item) { item.cancelled += 1; item.refunded += row.refundAmount } }
    for (const row of verifiedPayments) { const item = projectBreakdownMap.get(row.projectId); if (item) item.collectedInRange += row.amount }
    for (const row of accounts) { const item = projectBreakdownMap.get(row.projectId); if (item) { item.cumulativeCollected += row.cumulativePaid; item.outstanding += row.outstanding } }
    for (const row of releasedInRange) { const item = projectBreakdownMap.get(row.projectId); if (item) item.commissionReleased += row.netAmount }
    for (const row of eligibleUnreleased) { const item = projectBreakdownMap.get(row.projectId); if (item) item.eligibleUnreleased += row.netAmount }

    const summary = {
      reservationCount: reservations.length,
      grossSales: roundMoney(reservations.reduce((sum, row) => sum + row.tcp, 0)),
      collectedInRange: roundMoney(verifiedPayments.reduce((sum, row) => sum + row.amount, 0)),
      cumulativeCollected: roundMoney(accounts.reduce((sum, row) => sum + row.cumulativePaid, 0)),
      outstandingAmount: roundMoney(activeAccounts.reduce((sum, row) => sum + row.outstanding, 0)),
      cancelledCount: cancellations.length,
      cancelledValue: roundMoney(cancellations.reduce((sum, row) => sum + row.cancelledValue, 0)),
      refundedAmount: roundMoney(cancellations.reduce((sum, row) => sum + row.refundAmount, 0)),
      discontinuedAmount: roundMoney(cancellations.reduce((sum, row) => sum + row.discontinuedAmount, 0)),
      commissionGenerated: roundMoney(commissions.reduce((sum, row) => sum + row.grossCommission, 0)),
      commissionReleased: roundMoney(releasedInRange.reduce((sum, row) => sum + row.netAmount, 0)),
      eligibleUnreleased: roundMoney(eligibleUnreleased.reduce((sum, row) => sum + row.netAmount, 0)),
      commissionRemaining: roundMoney(releases.filter((row) => !(row.status === 'Released' && plainDate(row.actualReleaseDate) && plainDate(row.actualReleaseDate) <= to) && !['Cancelled', 'Forfeited on Cancellation'].includes(row.status)).reduce((sum, row) => sum + row.netAmount, 0)),
    }

    return res.json({
      success: true,
      data: {
        filters: { from, to, projectId: projectScope.projectId, sellerId, search },
        generated: {
          at: new Date().toISOString(),
          by: req.authUser ? {
            id: req.authUser.id || null,
            name: [req.authUser.first_name, req.authUser.middle_name, req.authUser.last_name].filter(Boolean).join(' ').trim() || req.authUser.email || 'Administrator',
            email: req.authUser.email || null,
          } : { id: null, name: 'Administrator', email: null },
        },
        options: { projects: projectRows, sellers: sellerRows },
        summary,
        reservations,
        payments,
        outstandingAccounts: activeAccounts.filter((row) => !search || filterSearch([row], search).length),
        cancellations,
        sales: reservations,
        commissions,
        releases,
        releasedInRange,
        eligibleUnreleased,
        sellerPerformance: [...sellerPerformanceMap.values()].map((row) => ({ ...row, salesAmount: roundMoney(row.salesAmount), collectedInRange: roundMoney(row.collectedInRange), grossCommission: roundMoney(row.grossCommission), releasedCommission: roundMoney(row.releasedCommission), eligibleUnreleased: roundMoney(row.eligibleUnreleased) })).sort((a, b) => number(b.salesAmount) - number(a.salesAmount)),
        projectBreakdown: [...projectBreakdownMap.values()].filter((row) => !projectScope.projectId || row.projectId === projectScope.projectId).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' && !['projectId','reservations','cancelled'].includes(key) ? roundMoney(value) : value]))),
      },
    })
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

export const auditSystemReportExport = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const from = normalizeDate(req.body?.from)
    const to = normalizeDate(req.body?.to)
    if (!from || !to || from > to) return res.status(400).json({ message: 'A valid report date range is required.' })
    await connection.beginTransaction()
    await writeAuditLog(connection, req, {
      action: 'export',
      module: 'Reports',
      entityType: 'system_report',
      entityId: `${from}:${to}`,
      entityLabel: `Financial report ${from} to ${to}`,
      title: 'Exported financial report to PDF',
      description: `Prepared the management report for ${from} through ${to} for PDF export.`,
      metadata: {
        from,
        to,
        projectId: Number(req.body?.projectId || 0) || null,
        sellerId: Number(req.body?.sellerId || 0) || null,
        search: clean(req.body?.search) || null,
        filename: clean(req.body?.filename) || null,
      },
    })
    await connection.commit()
    return res.json({ success: true })
  } catch (error) {
    try { await connection.rollback() } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

