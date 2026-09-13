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
  cancelledAt: row.cancelled_at || null,
  cancellationType: row.cancellation_type || null,
  cancelledValue: number(row.cancelled_value),
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
  sellerId: Number(row.assigned_accredited_seller_id || 0) || null,
  seller: row.seller_name || '-',
  sellerGroup: row.seller_group_name || '-',
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
              profile.assigned_accredited_seller_id,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name,
              TRIM(CONCAT_WS(' ', cancelled_user.first_name, cancelled_user.middle_name, cancelled_user.last_name)) AS cancelled_by_name
       FROM lot_project_reservation_history history
       INNER JOIN lot_projects project ON project.lot_project_id = history.lot_project_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = history.lot_project_account_id
       LEFT JOIN users cancelled_user ON cancelled_user.id = history.cancelled_by_user_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = history.lot_project_client_profile_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = profile.assigned_accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       WHERE history.cancelled_at IS NOT NULL
         AND DATE(history.cancelled_at) BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY history.cancelled_at DESC, history.lot_project_reservation_history_id DESC`,
      [from, to, ...projectScope.params, ...sellerReservationParams]
    )

    const [refundRows] = await connection.query(
      `SELECT history.*,
              project.lot_project_name,
              account.account_reference,
              profile.assigned_accredited_seller_id,
              ${sellerNameSql} AS seller_name,
              group_row.seller_group_name,
              TRIM(CONCAT_WS(' ', cancelled_user.first_name, cancelled_user.middle_name, cancelled_user.last_name)) AS cancelled_by_name
       FROM lot_project_reservation_history history
       INNER JOIN lot_projects project ON project.lot_project_id = history.lot_project_id
       LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = history.lot_project_account_id
       LEFT JOIN users cancelled_user ON cancelled_user.id = history.cancelled_by_user_id
       LEFT JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = history.lot_project_client_profile_id
       LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = profile.assigned_accredited_seller_id
       LEFT JOIN users seller_user ON seller_user.id = seller.user_id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       WHERE history.refund_amount > 0
         AND history.refund_date BETWEEN ? AND ?
         ${projectScope.sql}
         ${sellerReservationSql}
       ORDER BY history.refund_date DESC, history.lot_project_reservation_history_id DESC`,
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
              COALESCE(payment_summary.verified_paid, 0) AS cumulative_paid,
              CASE
                WHEN history.refund_amount > 0 AND history.refund_date IS NOT NULL AND history.refund_date <= ?
                  THEN history.refund_amount
                ELSE 0
              END AS refunded_to_date
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
      [to, to, to, ...projectScope.params, ...sellerReservationParams]
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
              COALESCE(history.cancelled_at, account.cancellation_date) AS cancellation_date,
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

    let reservations = reservationRows.map(mapReservation).map((row) => {
      const cancellationDate = plainDate(row.cancelledAt)
      const cancelledAsOf = Boolean(cancellationDate && cancellationDate <= to)
      const cohortCancelledValue = cancelledAsOf ? Math.min(Math.max(number(row.cancelledValue), 0), Math.max(number(row.tcp), 0)) : 0
      return {
        ...row,
        cancelledAsOf,
        cohortCancelledValue: roundMoney(cohortCancelledValue),
        netContractValue: roundMoney(Math.max(number(row.tcp) - cohortCancelledValue, 0)),
      }
    })
    let cancellations = cancellationRows.map(mapCancellation)
    let refundsPaid = refundRows.map(mapCancellation)
    let payments = paymentRows.map(mapPayment)

    if (search) {
      reservations = filterSearch(reservations, search)
      cancellations = filterSearch(cancellations, search)
      refundsPaid = filterSearch(refundsPaid, search)
      payments = filterSearch(payments, search)
    }

    let accounts = accountRows.map((row) => {
      const contractValue = Math.max(number(row.contract_tcp) - number(row.dp_discount_amount) - number(row.lmf_waived_amount), 0)
      const cumulativePaid = number(row.cumulative_paid)
      const refundedToDate = number(row.refunded_to_date)
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
        refundedToDate: roundMoney(refundedToDate),
        netCashPosition: roundMoney(cumulativePaid - refundedToDate),
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
      const currentStatus = String(row.release_status || 'Pending')
      const actualReleaseDate = plainDate(row.actual_release_date)
      const cancellationDate = plainDate(row.cancellation_date)
      const releasedByToDate = Boolean(actualReleaseDate && actualReleaseDate <= to && currentStatus === 'Released')
      const cancelledAsOf = Boolean(cancellationDate && cancellationDate <= to)
      const triggerReached = paymentPercent + 0.0001 >= number(row.release_trigger_percent)
      const retentionReadyByPayment = String(row.release_stage) !== 'Retention' || paymentPercent >= 99.999
      let statusAsOf = currentStatus
      if (releasedByToDate) statusAsOf = 'Released'
      else if (cancelledAsOf && ['Earned on Cancellation', 'Forfeited on Cancellation', 'Cancelled'].includes(currentStatus)) statusAsOf = currentStatus
      else if (currentStatus === 'On Hold') statusAsOf = 'On Hold'
      else statusAsOf = triggerReached && retentionReadyByPayment ? 'Eligible' : 'Pending'
      const eligibleAsOf = ['Eligible', 'Earned on Cancellation'].includes(statusAsOf)
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
        status: statusAsOf,
        currentStatus,
        cancellationDate,
        cancelledAsOf,
        paymentPercent: roundMoney(paymentPercent),
        eligibleAsOf,
        scheduledReleaseDate: row.scheduled_release_date || null,
        actualReleaseDate: row.actual_release_date || null,
        releaseEntryMode: row.release_entry_mode || 'live',
        historicalReleaseNote: row.historical_release_note || '',
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
    const earnedOnCancellation = releases.filter((row) => row.status === 'Earned on Cancellation')
    const forfeitedOnCancellation = releases.filter((row) => row.status === 'Forfeited on Cancellation')
    const activeAccounts = accounts.filter((row) => row.activeAsOf)
    const cohortCancelledSales = reservations.filter((row) => row.cancelledAsOf)

    const sellerPerformanceMap = new Map()
    const ensureSeller = ({ sellerId = null, seller = '-', sellerGroup = '-' } = {}) => {
      const key = sellerId || `name:${seller || '-'}`
      if (!sellerPerformanceMap.has(key)) {
        sellerPerformanceMap.set(key, {
          sellerId,
          seller: seller || '-',
          sellerGroup: sellerGroup || '-',
          reservations: 0,
          cancelledReservations: 0,
          grossContractedValue: 0,
          cancelledValue: 0,
          netActiveSales: 0,
          collectedInRange: 0,
          refundsInRange: 0,
          netCashMovement: 0,
          grossCommission: 0,
          releasedCommission: 0,
          eligibleUnreleased: 0,
        })
      }
      return sellerPerformanceMap.get(key)
    }

    for (const sale of reservations) {
      const current = ensureSeller(sale)
      current.reservations += 1
      current.grossContractedValue += sale.tcp
      current.cancelledValue += sale.cohortCancelledValue
      current.netActiveSales += sale.netContractValue
      if (sale.cancelledAsOf) current.cancelledReservations += 1
    }
    for (const payment of verifiedPayments) {
      const account = accounts.find((item) => item.accountReference === payment.accountReference)
      const current = ensureSeller(account || {})
      current.collectedInRange += payment.amount
      current.netCashMovement += payment.amount
    }
    for (const refund of refundsPaid) {
      const current = ensureSeller(refund)
      current.refundsInRange += refund.refundAmount
      current.netCashMovement -= refund.refundAmount
    }
    for (const commission of commissions) {
      const current = ensureSeller(commission)
      current.grossCommission += commission.grossCommission
    }
    for (const release of releasedInRange) {
      const current = ensureSeller(release)
      current.releasedCommission += release.netAmount
    }
    for (const release of eligibleUnreleased) {
      const current = ensureSeller(release)
      current.eligibleUnreleased += release.netAmount
    }

    const projectBreakdownMap = new Map(projectRows.map((project) => [Number(project.id), {
      projectId: Number(project.id),
      project: project.name,
      reservations: 0,
      cohortCancelled: 0,
      grossContractedValue: 0,
      cohortCancelledValue: 0,
      netActiveContractValue: 0,
      cancellationActivity: 0,
      cancellationActivityValue: 0,
      collectedInRange: 0,
      refundsInRange: 0,
      netCashMovement: 0,
      cumulativeCollected: 0,
      cumulativeRefunded: 0,
      netCumulativeCash: 0,
      outstanding: 0,
      discontinued: 0,
      commissionGenerated: 0,
      commissionReleased: 0,
      eligibleUnreleased: 0,
    }]))
    for (const row of reservations) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) {
        item.reservations += 1
        item.grossContractedValue += row.tcp
        item.cohortCancelledValue += row.cohortCancelledValue
        item.netActiveContractValue += row.netContractValue
        if (row.cancelledAsOf) item.cohortCancelled += 1
      }
    }
    for (const row of cancellations) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) {
        item.cancellationActivity += 1
        item.cancellationActivityValue += row.cancelledValue
        item.discontinued += row.discontinuedAmount
      }
    }
    for (const row of verifiedPayments) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) {
        item.collectedInRange += row.amount
        item.netCashMovement += row.amount
      }
    }
    for (const row of refundsPaid) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) {
        item.refundsInRange += row.refundAmount
        item.netCashMovement -= row.refundAmount
      }
    }
    for (const row of accounts) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) {
        item.cumulativeCollected += row.cumulativePaid
        item.cumulativeRefunded += row.refundedToDate
        item.netCumulativeCash += row.netCashPosition
        item.outstanding += row.outstanding
      }
    }
    for (const row of commissions) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) item.commissionGenerated += row.grossCommission
    }
    for (const row of releasedInRange) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) item.commissionReleased += row.netAmount
    }
    for (const row of eligibleUnreleased) {
      const item = projectBreakdownMap.get(row.projectId)
      if (item) item.eligibleUnreleased += row.netAmount
    }

    const grossContractedValue = roundMoney(reservations.reduce((sum, row) => sum + row.tcp, 0))
    const cohortCancelledValue = roundMoney(cohortCancelledSales.reduce((sum, row) => sum + row.cohortCancelledValue, 0))
    const netActiveContractValue = roundMoney(reservations.reduce((sum, row) => sum + row.netContractValue, 0))
    const collectedInRange = roundMoney(verifiedPayments.reduce((sum, row) => sum + row.amount, 0))
    const refundsPaidInRange = roundMoney(refundsPaid.reduce((sum, row) => sum + row.refundAmount, 0))
    const cumulativeCollected = roundMoney(accounts.reduce((sum, row) => sum + row.cumulativePaid, 0))
    const cumulativeRefunded = roundMoney(accounts.reduce((sum, row) => sum + row.refundedToDate, 0))

    const summary = {
      reservationCount: reservations.length,
      grossContractedValue,
      grossSales: grossContractedValue,
      cohortCancelledCount: cohortCancelledSales.length,
      cohortCancelledValue,
      netActiveContractValue,
      collectedInRange,
      refundsPaidInRange,
      netCashMovement: roundMoney(collectedInRange - refundsPaidInRange),
      cumulativeCollected,
      cumulativeRefunded,
      netCumulativeCash: roundMoney(cumulativeCollected - cumulativeRefunded),
      outstandingAmount: roundMoney(activeAccounts.reduce((sum, row) => sum + row.outstanding, 0)),
      cancellationActivityCount: cancellations.length,
      cancellationActivityValue: roundMoney(cancellations.reduce((sum, row) => sum + row.cancelledValue, 0)),
      cancelledCount: cancellations.length,
      cancelledValue: roundMoney(cancellations.reduce((sum, row) => sum + row.cancelledValue, 0)),
      refundedAmount: refundsPaidInRange,
      discontinuedAmount: roundMoney(cancellations.reduce((sum, row) => sum + row.discontinuedAmount, 0)),
      commissionGenerated: roundMoney(commissions.reduce((sum, row) => sum + row.grossCommission, 0)),
      commissionReleased: roundMoney(releasedInRange.reduce((sum, row) => sum + row.netAmount, 0)),
      commissionEarnedOnCancellation: roundMoney(earnedOnCancellation.reduce((sum, row) => sum + row.netAmount, 0)),
      commissionForfeitedOnCancellation: roundMoney(forfeitedOnCancellation.reduce((sum, row) => sum + row.netAmount, 0)),
      eligibleUnreleased: roundMoney(eligibleUnreleased.reduce((sum, row) => sum + row.netAmount, 0)),
      commissionRemaining: roundMoney(releases.filter((row) => !['Released', 'Cancelled', 'Forfeited on Cancellation'].includes(row.status)).reduce((sum, row) => sum + row.netAmount, 0)),
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
        refundsPaid,
        sales: reservations,
        commissions,
        releases,
        releasedInRange,
        eligibleUnreleased,
        sellerPerformance: [...sellerPerformanceMap.values()].map((row) => ({
          ...row,
          grossContractedValue: roundMoney(row.grossContractedValue),
          cancelledValue: roundMoney(row.cancelledValue),
          netActiveSales: roundMoney(row.netActiveSales),
          salesAmount: roundMoney(row.netActiveSales),
          collectedInRange: roundMoney(row.collectedInRange),
          refundsInRange: roundMoney(row.refundsInRange),
          netCashMovement: roundMoney(row.netCashMovement),
          grossCommission: roundMoney(row.grossCommission),
          releasedCommission: roundMoney(row.releasedCommission),
          eligibleUnreleased: roundMoney(row.eligibleUnreleased),
          cancellationRate: row.reservations > 0 ? roundMoney((row.cancelledReservations / row.reservations) * 100) : 0,
        })).sort((a, b) => number(b.netActiveSales) - number(a.netActiveSales)),
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


