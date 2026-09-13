import {
  db,
  getErrorMessage,
  tableExists,
  columnExists,
  getProjectBySlug,
  getListingLookupWhere,
  getComputedSoaTerms,
  getUserFullName,
  rebuildListingPaymentAllocationsChronologically,
  todayDateOnly,
} from '../_shared/lotProject.shared.js'
import { getListingPricingForMode } from '../_shared/listingPricing.js'
import {
  insertReservationDocuments,
  replaceReservationSchedules,
} from './ReserveListing.controller.js'
import { replaceReservationCommissions } from '../Commissions/commissionHierarchy.service.js'
import { writeAuditLog } from '../../System/auditLogs.controller.js'
import { sendEmail } from '../../../services/email.service.js'
import { syncCommissionProgressForListing } from '../../../services/commissionProgress.service.js'
import {
  createSensitiveActionVerification,
  getSensitiveActionRequestIp,
  maskSensitiveActionEmail,
  SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
  verifyAndConsumeSensitiveAction,
} from '../../../services/sensitiveActionVerification.service.js'

const CORRECTION_TABLE = 'lot_project_reservation_corrections'
const clean = (value = '') => String(value ?? '').trim()
const number = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const bool = (value) => value === true || Number(value || 0) === 1 || String(value || '').toLowerCase() === 'true'
const dateOnly = (value) => {
  if (!value) return null
  const text = String(value)
  return text.length >= 10 ? text.slice(0, 10) : text
}
const money = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100


const CONTROLLED_CORRECTION_ACTION = 'lot_project_controlled_unit_correction'
const CONTROLLED_CORRECTION_ENTITY = 'lot_project_account'
const escapeHtml = (value = '') => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const buildControlledCorrectionPayload = ({ actor, source, bundle, destination, computation, reason }) => ({
  action: CONTROLLED_CORRECTION_ACTION,
  actorId: Number(actor?.id || 0),
  accountId: Number(bundle?.lot_project_account_id || 0),
  clientProfileId: Number(bundle?.lot_project_client_profile_id || 0),
  sourceListingId: Number(source?.lot_project_listing_id || 0),
  sourceUnitId: clean(source?.lot_project_listing_unit_id),
  destinationListingId: Number(destination?.lot_project_listing_id || 0),
  destinationUnitId: clean(destination?.lot_project_listing_unit_id),
  reason: clean(reason),
  terms: {
    modeOfPayment: clean(computation?.terms?.modeOfPayment),
    saleDiscountPercentage: number(computation?.terms?.saleDiscountPercentage),
    reservationFee: number(computation?.terms?.reservationFee),
    reservationFeeAppliedToDownpayment: Boolean(computation?.terms?.reservationFeeAppliedToDownpayment),
    legalMiscFeeMode: clean(computation?.terms?.legalMiscFeeMode),
    startingDate: dateOnly(computation?.terms?.startingDate),
    firstDueDate: dateOnly(computation?.terms?.firstDueDate),
    downpaymentPercentage: number(computation?.terms?.downpaymentPercentage),
    downpaymentInputMode: clean(computation?.terms?.downpaymentInputMode),
    downpaymentAmount: computation?.terms?.downpaymentAmount == null ? null : number(computation.terms.downpaymentAmount),
    downpaymentTerms: number(computation?.terms?.downpaymentTerms),
    monthlyTerms: number(computation?.terms?.monthlyTerms),
    annualInterestRate: number(computation?.terms?.annualInterestRate),
    interestRateOverridden: Boolean(computation?.terms?.interestRateOverridden),
    dpDiscountPercentage: number(computation?.terms?.dpDiscountPercentage),
    dailyPenaltyRate: number(computation?.terms?.dailyPenaltyRate),
    penaltyGraceDays: number(computation?.terms?.penaltyGraceDays),
    penaltyEffectiveFrom: dateOnly(computation?.terms?.penaltyEffectiveFrom),
    sellerId: Number(computation?.terms?.sellerId || 0),
    saleChannel: clean(computation?.terms?.saleChannel),
  },
  pricing: {
    baseSellingPrice: money(computation?.pricing?.baseSellingPrice),
    netSellingPrice: money(computation?.pricing?.netSellingPrice),
    lmfAmount: money(computation?.pricing?.lmfAmount),
    tcp: money(computation?.pricing?.tcp),
  },
})

const sendControlledCorrectionCodeEmail = async ({ actor, code, source, destination, bundle, reason }) => {
  const companyName = clean(process.env.COMPANY_NAME) || 'D&C Prime Realty'
  const actorName = getUserFullName(actor) || 'Super Admin'
  const buyerName = bundle?.buyer_full_name || bundle?.buyer_name_snapshot || 'Buyer'
  await sendEmail({
    to: actor.email,
    subject: `Controlled unit correction code - ${source.lot_project_listing_unit_id} to ${destination.lot_project_listing_unit_id}`,
    text: [
      `Hello ${actorName},`, '',
      `Your verification code is ${code}.`,
      `Buyer: ${buyerName}`,
      `Account: ${bundle?.account_reference || '-'}`,
      `Wrong unit: ${source.lot_project_listing_unit_id}`,
      `Correct unit: ${destination.lot_project_listing_unit_id}`,
      `Reason: ${reason}`,
      `This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.`, '',
      'This correction moves an account with verified financial activity. Do not share this code.', '', companyName,
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>${escapeHtml(companyName)}</h2><p>Hello ${escapeHtml(actorName)},</p><p>Use this code to authorize a controlled reservation correction for <strong>${escapeHtml(buyerName)}</strong>.</p><div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:18px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;text-align:center">${code}</div><p><strong>Account:</strong> ${escapeHtml(bundle?.account_reference || '-')}<br/><strong>Wrong unit:</strong> ${escapeHtml(source.lot_project_listing_unit_id)}<br/><strong>Correct unit:</strong> ${escapeHtml(destination.lot_project_listing_unit_id)}<br/><strong>Reason:</strong> ${escapeHtml(reason)}</p><p>This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.</p><p style="color:#92400e"><strong>This account already has verified payment activity. Confirm the buyer and both units before using the code.</strong></p></div>`,
  })
}

const ensureCorrectionSchema = async (connection) => {
  if (!(await tableExists(connection, CORRECTION_TABLE))) {
    const error = new Error('Reservation correction database migration is incomplete. Run server/migrations/20260908_reservation_corrections.sql.')
    error.statusCode = 500
    throw error
  }
}

const listingSelectSql = (hasAnnualInterest = true) => `
  SELECT
    l.lot_project_listing_id,
    l.lot_project_id,
    l.lot_project_listing_unit_id,
    l.lot_project_listing_status,
    l.lot_project_listing_sold_substatus,
    l.lot_project_listing_area_sqm,
    l.lot_project_listing_price_per_sqm,
    l.lot_project_listing_installment_price_per_sqm,
    l.lot_project_listing_cash_price_per_sqm,
    l.lot_project_listing_lmf_rate,
    l.lot_project_listing_reservation_fee,
    l.lot_project_listing_net_selling_price,
    l.lot_project_listing_lmf_amount,
    l.lot_project_listing_tcp,
    ${hasAnnualInterest ? 'l.annual_interest_rate' : '0 AS annual_interest_rate'},
    l.current_account_id
  FROM lot_project_listings l
`

const getSourceListing = async (connection, projectId, listingLookup, { forUpdate = false } = {}) => {
  const lookup = getListingLookupWhere(listingLookup, 'l')
  const hasAnnualInterest = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate')
  const [rows] = await connection.query(
    `${listingSelectSql(hasAnnualInterest)}
     WHERE l.lot_project_id = ? AND ${lookup.sql}
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [projectId, ...lookup.params]
  )
  return rows[0] || null
}

const getListingById = async (connection, projectId, listingId, { forUpdate = false } = {}) => {
  const hasAnnualInterest = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate')
  const [rows] = await connection.query(
    `${listingSelectSql(hasAnnualInterest)}
     WHERE l.lot_project_id = ? AND l.lot_project_listing_id = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [projectId, listingId]
  )
  return rows[0] || null
}

const getCurrentAccountBundle = async (connection, sourceListing, { forUpdate = false } = {}) => {
  const accountId = Number(sourceListing?.current_account_id || 0)
  if (!accountId) return null

  const [rows] = await connection.query(
    `SELECT
       account.*,
       profile.*,
       history.reservation_status,
       history.reserved_at AS history_reserved_at,
       history.unit_id_snapshot AS history_unit_id_snapshot,
       history.tcp_snapshot,
       history.price_per_sqm_snapshot,
       history.base_selling_price_snapshot,
       history.net_selling_price_snapshot,
       history.lmf_amount_snapshot,
       history.sale_discount_percentage_snapshot,
       history.sale_discount_amount_snapshot,
       history.dp_discount_percentage_snapshot,
       history.dp_discount_amount_snapshot
     FROM lot_project_accounts account
     INNER JOIN lot_project_client_profiles profile
       ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
     LEFT JOIN lot_project_reservation_history history
       ON history.lot_project_reservation_history_id = account.lot_project_reservation_history_id
     WHERE account.lot_project_account_id = ?
       AND account.lot_project_listing_id = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [accountId, sourceListing.lot_project_listing_id]
  )
  return rows[0] || null
}

const getCorrectionSafety = async (connection, bundle) => {
  const hardReasons = []
  if (!bundle) {
    hardReasons.push('No current buyer account is linked to this listing.')
    return { eligible: false, controlledEligible: false, reasons: hardReasons, hardReasons, paymentCount: 0, cancelledPaymentCount: 0, uploadedFileCount: 0, releasedCommissionCount: 0 }
  }

  if (String(bundle.account_status || '') !== 'active') {
    hardReasons.push('Only an active buyer account can use Administrative Reservation Correction.')
  }
  if (String(bundle.lot_project_client_profile_status || '') !== 'active') {
    hardReasons.push('The current buyer profile is not active.')
  }
  if (bundle.reservation_status && String(bundle.reservation_status) !== 'active') {
    hardReasons.push('The reservation is already in a cancellation workflow.')
  }

  const profileId = Number(bundle.lot_project_client_profile_id || 0)
  const accountId = Number(bundle.lot_project_account_id || 0)

  let paymentCount = 0
  let cancelledPaymentCount = 0
  if (await tableExists(connection, 'lot_project_payments')) {
    const hasAccountId = await columnExists(connection, 'lot_project_payments', 'lot_project_account_id')
    const [rows] = await connection.query(
      `SELECT
         COALESCE(SUM(CASE WHEN lot_project_payment_status = 'Verified' THEN 1 ELSE 0 END), 0) AS verified_total,
         COALESCE(SUM(CASE WHEN lot_project_payment_status = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_total
       FROM lot_project_payments
       WHERE ${hasAccountId ? 'lot_project_account_id = ?' : 'lot_project_client_profile_id = ?'}`,
      [hasAccountId ? accountId : profileId]
    )
    paymentCount = Number(rows[0]?.verified_total || 0)
    cancelledPaymentCount = Number(rows[0]?.cancelled_total || 0)
  }

  let uploadedFileCount = 0
  if (await tableExists(connection, 'lot_project_client_document_files')) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM lot_project_client_document_files
       WHERE lot_project_account_id = ? AND file_status <> 'removed'`,
      [accountId]
    )
    uploadedFileCount += Number(rows[0]?.total || 0)
  }
  if (await tableExists(connection, 'lot_project_client_documents')) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM lot_project_client_documents
       WHERE lot_project_client_profile_id = ?
         AND NULLIF(TRIM(COALESCE(lot_project_client_document_file_url, '')), '') IS NOT NULL`,
      [profileId]
    )
    uploadedFileCount += Number(rows[0]?.total || 0)
  }
  if (uploadedFileCount > 0) hardReasons.push('Uploaded buyer documents exist. Unit-specific files must not be silently moved.')

  let releasedCommissionCount = 0
  if ((await tableExists(connection, 'lot_project_commission_releases')) && (await tableExists(connection, 'lot_project_commissions'))) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM lot_project_commission_releases release_row
       INNER JOIN lot_project_commissions commission
         ON commission.lot_project_commission_id = release_row.lot_project_commission_id
       WHERE commission.lot_project_client_profile_id = ?
         AND release_row.release_status = 'Released'`,
      [profileId]
    )
    releasedCommissionCount = Number(rows[0]?.total || 0)
    if (releasedCommissionCount > 0) hardReasons.push('Commission has already been released for this buyer account.')
  }

  if (await tableExists(connection, 'lot_project_commission_receipts')) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_commission_receipts WHERE lot_project_client_profile_id = ?`,
      [profileId]
    )
    if (Number(rows[0]?.total || 0) > 0) hardReasons.push('Commission receipt records already exist for this buyer account.')
  }

  if (await tableExists(connection, 'lot_project_soa_statements')) {
    const hasAccountId = await columnExists(connection, 'lot_project_soa_statements', 'lot_project_account_id')
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_soa_statements
       WHERE ${hasAccountId ? 'lot_project_account_id = ?' : 'lot_project_client_profile_id = ?'}
         AND COALESCE(sent_count, 0) > 0`,
      [hasAccountId ? accountId : profileId]
    )
    if (Number(rows[0]?.total || 0) > 0) hardReasons.push('An SOA statement has already been sent for this buyer account.')
  }

  if (await tableExists(connection, 'lot_project_penalty_reliefs')) {
    const hasAccountId = await columnExists(connection, 'lot_project_penalty_reliefs', 'lot_project_account_id')
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_penalty_reliefs
       WHERE ${hasAccountId ? 'lot_project_account_id = ?' : 'lot_project_client_profile_id = ?'}`,
      [hasAccountId ? accountId : profileId]
    )
    if (Number(rows[0]?.total || 0) > 0) hardReasons.push('Penalty adjustment history already exists for this buyer account.')
  }

  const simplePaymentReason = paymentCount > 0
    ? 'This buyer account has a verified payment. Use Controlled Unit Correction with Super Admin password and email verification.'
    : null
  const reasons = [...(simplePaymentReason ? [simplePaymentReason] : []), ...hardReasons]
  return {
    eligible: hardReasons.length === 0 && paymentCount === 0,
    controlledEligible: hardReasons.length === 0 && paymentCount > 0,
    reasons,
    hardReasons,
    paymentCount,
    cancelledPaymentCount,
    uploadedFileCount,
    releasedCommissionCount,
  }
}

const normalizeTerms = (bundle, destinationListing, overrides = {}) => {
  const modeOfPayment = clean(overrides.modeOfPayment || bundle.soa_mode_of_payment).toLowerCase() === 'cash' ? 'cash' : 'installment'
  const interestRateOverridden = overrides.interestRateOverridden !== undefined
    ? bool(overrides.interestRateOverridden)
    : bool(bundle.soa_interest_rate_overridden)
  const annualInterestRate = interestRateOverridden
    ? number(overrides.annualInterestRate ?? bundle.soa_annual_interest_rate)
    : number(destinationListing.annual_interest_rate)
  const downpaymentInputMode = clean(overrides.downpaymentInputMode || bundle.soa_downpayment_input_mode) === 'amount' ? 'amount' : 'percentage'
  const legalMiscFeeMode = clean(overrides.legalMiscFeeMode || bundle.soa_legal_misc_fee_mode) === 'separate_soa_row'
    ? 'separate_soa_row'
    : 'include_in_monthly'
  const saleDiscountPercentage = number(overrides.saleDiscountPercentage ?? bundle.soa_sale_discount_percentage)
  const dpDiscountPercentage = number(overrides.dpDiscountPercentage ?? bundle.soa_dp_discount_percentage)
  const downpaymentPercentage = number(overrides.downpaymentPercentage ?? bundle.soa_downpayment_percentage, 30)
  const downpaymentAmount = downpaymentInputMode === 'amount'
    ? number(overrides.downpaymentAmount ?? bundle.soa_downpayment_amount)
    : null

  const terms = {
    buyerName: bundle.buyer_full_name || bundle.buyer_name_snapshot || '',
    sellerId: Number(overrides.sellerId || bundle.assigned_accredited_seller_id || 0),
    saleChannel: bundle.sale_channel || 'distributed',
    modeOfPayment,
    saleDiscountPercentage,
    reservationFee: number(overrides.reservationFee ?? destinationListing.lot_project_listing_reservation_fee),
    reservationFeeAppliedToDownpayment: overrides.reservationFeeAppliedToDownpayment !== undefined
      ? bool(overrides.reservationFeeAppliedToDownpayment)
      : bool(bundle.soa_reservation_fee_applied_to_downpayment),
    legalMiscFeeMode,
    startingDate: dateOnly(overrides.startingDate || bundle.soa_starting_date || bundle.reservation_date),
    firstDueDate: dateOnly(overrides.firstDueDate || bundle.soa_first_due_date || bundle.soa_starting_date || bundle.reservation_date),
    downpaymentPercentage,
    downpaymentInputMode,
    downpaymentAmount,
    downpaymentTerms: Math.max(0, Math.round(number(overrides.downpaymentTerms ?? bundle.soa_downpayment_terms, 3))),
    monthlyTerms: Math.max(1, Math.round(number(overrides.monthlyTerms ?? bundle.soa_monthly_terms, 36))),
    annualInterestRate,
    interestRateOverridden,
    dpDiscountPercentage,
    dailyPenaltyRate: number(overrides.dailyPenaltyRate ?? bundle.soa_penalty_rate_percent, 0.05),
    penaltyGraceDays: Math.max(0, Math.round(number(overrides.penaltyGraceDays ?? bundle.soa_penalty_grace_days, 0))),
    penaltyEffectiveFrom: dateOnly(overrides.penaltyEffectiveFrom ?? bundle.soa_penalty_effective_from),
  }

  if (!terms.sellerId) throw Object.assign(new Error('The current reservation does not have a valid assigned seller.'), { statusCode: 409 })
  if (terms.saleDiscountPercentage < 0 || terms.saleDiscountPercentage > 100) throw Object.assign(new Error('Sale discount percentage must be between 0 and 100.'), { statusCode: 400 })
  if (terms.dpDiscountPercentage < 0 || terms.dpDiscountPercentage > 100) throw Object.assign(new Error('Downpayment discount percentage must be between 0 and 100.'), { statusCode: 400 })
  if (terms.downpaymentPercentage < 0 || terms.downpaymentPercentage > 100) throw Object.assign(new Error('Downpayment percentage must be between 0 and 100.'), { statusCode: 400 })
  if (terms.annualInterestRate < 0 || terms.annualInterestRate > 100) throw Object.assign(new Error('Annual interest rate must be between 0 and 100.'), { statusCode: 400 })
  if (terms.reservationFee < 0) throw Object.assign(new Error('Reservation fee cannot be negative.'), { statusCode: 400 })
  return terms
}

const buildDestinationComputation = (bundle, destinationListing, overrides = {}) => {
  const terms = normalizeTerms(bundle, destinationListing, overrides)
  const pricing = getListingPricingForMode(
    destinationListing,
    terms.modeOfPayment,
    terms.saleDiscountPercentage,
    destinationListing.lot_project_listing_lmf_rate
  )
  if (pricing.pricePerSqm <= 0 || pricing.baseSellingPrice <= 0) {
    throw Object.assign(new Error(`The destination listing does not have a valid ${terms.modeOfPayment} price per SQM.`), { statusCode: 409 })
  }

  const scheduleListing = {
    ...destinationListing,
    lot_project_listing_price_per_sqm: pricing.pricePerSqm,
    commissionBase: pricing.baseSellingPrice,
    soa_selected_price_per_sqm: pricing.pricePerSqm,
    soa_selected_base_selling_price: pricing.baseSellingPrice,
    soa_selected_net_selling_price: pricing.netSellingPrice,
    soa_selected_lmf_amount: pricing.lmfAmount,
    soa_selected_tcp: pricing.tcp,
    lot_project_listing_lmf_rate: pricing.legalMiscRate,
    lot_project_listing_net_selling_price: pricing.netSellingPrice,
    lot_project_listing_lmf_amount: pricing.lmfAmount,
    lot_project_listing_tcp: pricing.tcp,
    annual_interest_rate: number(destinationListing.annual_interest_rate),
  }
  terms.legalMiscFeeAmount = pricing.lmfAmount

  const computedTerms = getComputedSoaTerms({
    ...scheduleListing,
    buyer_full_name: terms.buyerName,
    soa_mode_of_payment: terms.modeOfPayment,
    soa_reservation_fee: terms.reservationFee,
    soa_reservation_fee_applied_to_downpayment: terms.reservationFeeAppliedToDownpayment ? 1 : 0,
    soa_starting_date: terms.startingDate,
    soa_first_due_date: terms.firstDueDate,
    soa_downpayment_percentage: terms.downpaymentPercentage,
    soa_downpayment_input_mode: terms.downpaymentInputMode,
    soa_downpayment_amount: terms.downpaymentAmount,
    soa_downpayment_terms: terms.downpaymentTerms,
    soa_monthly_terms: terms.monthlyTerms,
    soa_annual_interest_rate: terms.annualInterestRate,
    soa_interest_rate_overridden: terms.interestRateOverridden ? 1 : 0,
    soa_dp_discount_percentage: terms.dpDiscountPercentage,
    soa_legal_misc_fee_mode: terms.legalMiscFeeMode,
    soa_legal_misc_fee_amount: pricing.lmfAmount,
  }, [])

  if (terms.downpaymentInputMode === 'amount' && number(terms.downpaymentAmount) > number(computedTerms.principalTcp)) {
    throw Object.assign(new Error('The carried downpayment amount is larger than the corrected unit contract principal. Adjust the downpayment amount before confirming.'), { statusCode: 400 })
  }

  return { terms, pricing, computedTerms, scheduleListing }
}

const buildBeforeSnapshot = (sourceListing, bundle) => {
  const currentComputedTerms = getComputedSoaTerms({
    ...sourceListing,
    ...bundle,
    lot_project_listing_tcp: number(bundle.soa_selected_tcp || bundle.tcp_snapshot || sourceListing.lot_project_listing_tcp),
    lot_project_listing_lmf_amount: number(bundle.soa_selected_lmf_amount || bundle.lmf_amount_snapshot || sourceListing.lot_project_listing_lmf_amount),
    lot_project_listing_reservation_fee: number(bundle.soa_reservation_fee || sourceListing.lot_project_listing_reservation_fee),
  }, [])
  return ({
  listingId: Number(sourceListing.lot_project_listing_id),
  unitId: sourceListing.lot_project_listing_unit_id,
  accountId: Number(bundle.lot_project_account_id),
  accountReference: bundle.account_reference,
  buyerProfileId: Number(bundle.lot_project_client_profile_id),
  buyerName: bundle.buyer_full_name || bundle.buyer_name_snapshot,
  reservationHistoryId: Number(bundle.lot_project_reservation_history_id || 0) || null,
  reservedAt: bundle.history_reserved_at || bundle.reservation_date,
  modeOfPayment: bundle.soa_mode_of_payment,
  sellerId: Number(bundle.assigned_accredited_seller_id || 0) || null,
  saleChannel: bundle.sale_channel,
  pricePerSqm: number(bundle.soa_selected_price_per_sqm || bundle.price_per_sqm_snapshot),
  baseSellingPrice: number(bundle.soa_selected_base_selling_price || bundle.base_selling_price_snapshot),
  saleDiscountPercentage: number(bundle.soa_sale_discount_percentage || bundle.sale_discount_percentage_snapshot),
  saleDiscountAmount: number(bundle.soa_sale_discount_amount || bundle.sale_discount_amount_snapshot),
  netSellingPrice: number(bundle.soa_selected_net_selling_price || bundle.net_selling_price_snapshot),
  lmfAmount: number(bundle.soa_selected_lmf_amount || bundle.lmf_amount_snapshot),
  tcp: number(bundle.soa_selected_tcp || bundle.tcp_snapshot),
  reservationFee: number(bundle.soa_reservation_fee),
  dpDiscountPercentage: number(bundle.soa_dp_discount_percentage),
  dpDiscountAmount: number(bundle.dp_discount_amount_snapshot),
  downpaymentPercentage: number(bundle.soa_downpayment_percentage),
  downpaymentInputMode: bundle.soa_downpayment_input_mode,
  downpaymentAmount: number(bundle.soa_downpayment_amount),
  downpaymentTerms: number(bundle.soa_downpayment_terms),
  monthlyTerms: number(bundle.soa_monthly_terms),
  annualInterestRate: number(bundle.soa_annual_interest_rate),
  estimatedMonthlyAmortization: number(currentComputedTerms.monthlyAmortization),
})
}

const buildAfterSnapshot = (destinationListing, bundle, computation) => ({
  listingId: Number(destinationListing.lot_project_listing_id),
  unitId: destinationListing.lot_project_listing_unit_id,
  accountId: Number(bundle.lot_project_account_id),
  accountReference: bundle.account_reference,
  buyerProfileId: Number(bundle.lot_project_client_profile_id),
  buyerName: bundle.buyer_full_name || bundle.buyer_name_snapshot,
  reservationHistoryId: Number(bundle.lot_project_reservation_history_id || 0) || null,
  reservedAt: bundle.history_reserved_at || bundle.reservation_date,
  modeOfPayment: computation.terms.modeOfPayment,
  sellerId: computation.terms.sellerId,
  saleChannel: computation.terms.saleChannel,
  areaSqm: number(destinationListing.lot_project_listing_area_sqm),
  pricePerSqm: computation.pricing.pricePerSqm,
  baseSellingPrice: computation.pricing.baseSellingPrice,
  saleDiscountPercentage: computation.pricing.saleDiscountPercentage,
  saleDiscountAmount: computation.pricing.saleDiscountAmount,
  netSellingPrice: computation.pricing.netSellingPrice,
  lmfAmount: computation.pricing.lmfAmount,
  tcp: computation.pricing.tcp,
  reservationFee: computation.terms.reservationFee,
  dpDiscountPercentage: computation.terms.dpDiscountPercentage,
  dpDiscountAmount: computation.computedTerms.downpaymentDiscountTotal,
  downpaymentPercentage: computation.terms.downpaymentPercentage,
  downpaymentInputMode: computation.terms.downpaymentInputMode,
  downpaymentAmount: computation.terms.downpaymentAmount,
  downpaymentTerms: computation.terms.downpaymentTerms,
  monthlyTerms: computation.terms.monthlyTerms,
  annualInterestRate: computation.terms.annualInterestRate,
  estimatedMonthlyAmortization: computation.computedTerms.monthlyAmortization,
})

const mapDestination = (row) => ({
  id: Number(row.lot_project_listing_id),
  unitId: row.lot_project_listing_unit_id,
  status: row.lot_project_listing_status,
  soldSubstatus: row.lot_project_listing_sold_substatus,
  areaSqm: number(row.lot_project_listing_area_sqm),
  installmentPricePerSqm: number(row.lot_project_listing_installment_price_per_sqm ?? row.lot_project_listing_price_per_sqm),
  cashPricePerSqm: number(row.lot_project_listing_cash_price_per_sqm ?? row.lot_project_listing_price_per_sqm),
  legalMiscRate: number(row.lot_project_listing_lmf_rate),
  reservationFee: number(row.lot_project_listing_reservation_fee),
  annualInterestRate: number(row.annual_interest_rate),
})

const getAvailableDestinations = async (connection, projectId, sourceListingId) => {
  const hasAnnualInterest = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate')
  const [rows] = await connection.query(
    `${listingSelectSql(hasAnnualInterest)}
     WHERE l.lot_project_id = ?
       AND l.lot_project_listing_id <> ?
       AND l.lot_project_listing_status = 'available'
       AND l.current_account_id IS NULL
     ORDER BY l.lot_project_listing_unit_id ASC`,
    [projectId, sourceListingId]
  )
  return rows.map(mapDestination)
}

const loadCorrectionContext = async (connection, project, listingLookup, { forUpdate = false } = {}) => {
  const source = await getSourceListing(connection, project.lot_project_id, listingLookup, { forUpdate })
  if (!source) throw Object.assign(new Error('Source listing not found.'), { statusCode: 404 })
  if (String(source.lot_project_listing_status) !== 'sold' || String(source.lot_project_listing_sold_substatus || 'active') !== 'active') {
    throw Object.assign(new Error('Only a Sold / Active reservation can use Administrative Reservation Correction.'), { statusCode: 409 })
  }
  const bundle = await getCurrentAccountBundle(connection, source, { forUpdate })
  const safety = await getCorrectionSafety(connection, bundle)
  return { source, bundle, safety }
}

export const getReservationCorrectionOptions = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await ensureCorrectionSchema(connection)
    const { source, bundle, safety } = await loadCorrectionContext(connection, project, clean(req.params.listingId))
    const destinations = (safety.eligible || safety.controlledEligible)
      ? await getAvailableDestinations(connection, project.lot_project_id, source.lot_project_listing_id)
      : []

    return res.json({
      success: true,
      data: {
        eligible: safety.eligible,
        controlledEligible: safety.controlledEligible,
        correctionMode: safety.controlledEligible ? 'controlled' : safety.eligible ? 'simple' : 'blocked',
        paymentCount: safety.paymentCount,
        cancelledPaymentCount: safety.cancelledPaymentCount,
        blockers: safety.reasons,
        hardBlockers: safety.hardReasons,
        source: {
          id: Number(source.lot_project_listing_id),
          unitId: source.lot_project_listing_unit_id,
          buyerName: bundle?.buyer_full_name || bundle?.buyer_name_snapshot || '-',
          accountReference: bundle?.account_reference || '-',
          reservedAt: bundle?.history_reserved_at || bundle?.reservation_date || null,
          areaSqm: number(source.lot_project_listing_area_sqm),
          tcp: number(bundle?.soa_selected_tcp || bundle?.tcp_snapshot || source.lot_project_listing_tcp),
        },
        terms: bundle ? normalizeTerms(bundle, source, {}) : null,
        destinations,
      },
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

export const previewReservationCorrection = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await ensureCorrectionSchema(connection)
    const { source, bundle, safety } = await loadCorrectionContext(connection, project, clean(req.params.listingId))
    if (!safety.eligible && !safety.controlledEligible) return res.status(409).json({ message: safety.reasons.join(' '), blockers: safety.reasons })

    const destinationId = Number(req.body.destinationListingId || 0)
    if (!destinationId) return res.status(400).json({ message: 'Correct destination unit is required.' })
    const destination = await getListingById(connection, project.lot_project_id, destinationId)
    if (!destination) return res.status(404).json({ message: 'Destination listing not found.' })
    if (String(destination.lot_project_listing_status) !== 'available' || Number(destination.current_account_id || 0)) {
      return res.status(409).json({ message: 'The selected destination unit is no longer available.' })
    }

    const computation = buildDestinationComputation(bundle, destination, req.body.terms || {})
    return res.json({
      success: true,
      data: {
        before: buildBeforeSnapshot(source, bundle),
        after: buildAfterSnapshot(destination, bundle, computation),
        carriedTerms: computation.terms,
        correctionMode: safety.controlledEligible ? 'controlled' : 'simple',
        verifiedPaymentCount: safety.paymentCount,
      },
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

export const requestControlledReservationCorrectionCode = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const actor = req.authUser
    if (!actor?.id || !actor.email) return res.status(400).json({ message: 'The Super Admin account must have an email address.' })
    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      return res.status(500).json({ message: 'Sensitive-action verification table is missing. Apply the latest database schema first.' })
    }
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    const destinationId = Number(req.body.destinationListingId || 0)
    const reason = clean(req.body.reason)
    if (!destinationId) return res.status(400).json({ message: 'Correct destination unit is required.' })
    if (reason.length < 5) return res.status(400).json({ message: 'A clear correction reason is required.' })

    await ensureCorrectionSchema(connection)
    await connection.beginTransaction()
    const { source, bundle, safety } = await loadCorrectionContext(connection, project, clean(req.params.listingId), { forUpdate: true })
    if (!safety.controlledEligible) {
      throw Object.assign(new Error(safety.hardReasons.length ? safety.hardReasons.join(' ') : 'Controlled correction is only required when verified payments exist.'), { statusCode: 409 })
    }
    const destination = await getListingById(connection, project.lot_project_id, destinationId, { forUpdate: true })
    if (!destination || String(destination.lot_project_listing_status) !== 'available' || Number(destination.current_account_id || 0)) {
      throw Object.assign(new Error('The selected destination unit is no longer available.'), { statusCode: 409 })
    }
    const computation = buildDestinationComputation(bundle, destination, req.body.terms || {})
    const payload = buildControlledCorrectionPayload({ actor, source, bundle, destination, computation, reason })
    const { verificationId, code } = await createSensitiveActionVerification(connection, {
      userId: actor.id,
      actionType: CONTROLLED_CORRECTION_ACTION,
      entityType: CONTROLLED_CORRECTION_ENTITY,
      entityId: bundle.lot_project_account_id,
      payload,
      reason,
      requestIp: getSensitiveActionRequestIp(req),
    })
    await sendControlledCorrectionCodeEmail({ actor, code, source, destination, bundle, reason })
    await connection.commit()
    return res.json({
      success: true,
      message: `A verification code was sent to ${maskSensitiveActionEmail(actor.email)}.`,
      data: { verificationId, maskedEmail: maskSensitiveActionEmail(actor.email), expiresInMinutes: SENSITIVE_ACTION_CODE_EXPIRY_MINUTES },
    })
  } catch (error) {
    try { await connection.rollback() } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

const updateOptionalColumns = async (connection, tableName, idColumn, idValue, values) => {
  const assignments = []
  const params = []
  for (const [column, value] of Object.entries(values)) {
    if (!(await columnExists(connection, tableName, column))) continue
    assignments.push(`${column} = ?`)
    params.push(value)
  }
  if (!assignments.length) return
  params.push(idValue)
  await connection.query(`UPDATE ${tableName} SET ${assignments.join(', ')} WHERE ${idColumn} = ?`, params)
}

export const correctReservationUnit = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    const listingLookup = clean(req.params.listingId)
    const destinationId = Number(req.body.destinationListingId || 0)
    const reason = clean(req.body.reason)
    if (!destinationId) return res.status(400).json({ message: 'Correct destination unit is required.' })
    if (reason.length < 5) return res.status(400).json({ message: 'A clear correction reason is required.' })

    await ensureCorrectionSchema(connection)
    await connection.beginTransaction()

    // Resolve the source, then lock both inventory rows in stable ID order so
    // simultaneous reservation/correction requests cannot claim the same unit.
    const sourceLookup = await getSourceListing(connection, project.lot_project_id, listingLookup)
    if (!sourceLookup) throw Object.assign(new Error('Source listing not found.'), { statusCode: 404 })
    const sourceId = Number(sourceLookup.lot_project_listing_id)
    if (sourceId === destinationId) throw Object.assign(new Error('Choose a different destination unit.'), { statusCode: 400 })

    const lockIds = [sourceId, destinationId].sort((a, b) => a - b)
    const [lockedRows] = await connection.query(
      `SELECT lot_project_listing_id FROM lot_project_listings
       WHERE lot_project_id = ? AND lot_project_listing_id IN (?, ?)
       ORDER BY lot_project_listing_id FOR UPDATE`,
      [project.lot_project_id, lockIds[0], lockIds[1]]
    )
    if (lockedRows.length !== 2) throw Object.assign(new Error('One of the selected units no longer exists in this project.'), { statusCode: 409 })

    const { source, bundle, safety } = await loadCorrectionContext(connection, project, listingLookup, { forUpdate: true })
    if (!safety.eligible && !safety.controlledEligible) throw Object.assign(new Error(safety.reasons.join(' ')), { statusCode: 409 })
    const destination = await getListingById(connection, project.lot_project_id, destinationId, { forUpdate: true })
    if (!destination || String(destination.lot_project_listing_status) !== 'available' || Number(destination.current_account_id || 0)) {
      throw Object.assign(new Error('The selected destination unit is no longer available.'), { statusCode: 409 })
    }

    const computation = buildDestinationComputation(bundle, destination, req.body.terms || {})
    let correctionAuthorization = null
    if (safety.controlledEligible) {
      const actor = req.authUser
      if (String(actor?.role || '').toLowerCase() !== 'super_admin') {
        throw Object.assign(new Error('Controlled Unit Correction can only be completed by an exact Super Admin.'), { statusCode: 403 })
      }
      const verificationId = Number(req.body.verificationId || req.body.verification_id || 0)
      const code = clean(req.body.code || req.body.verificationCode || req.body.verification_code)
      if (!verificationId || !code) {
        throw Object.assign(new Error('Super Admin password and email-code verification are required for a buyer account with verified payments.'), { statusCode: 400 })
      }
      const payload = buildControlledCorrectionPayload({ actor, source, bundle, destination, computation, reason })
      const verificationResult = await verifyAndConsumeSensitiveAction(connection, {
        verificationId,
        userId: actor.id,
        actionType: CONTROLLED_CORRECTION_ACTION,
        entityType: CONTROLLED_CORRECTION_ENTITY,
        entityId: bundle.lot_project_account_id,
        code,
        payload,
      })
      if (!verificationResult.ok) {
        // Commit only the verification attempt/expiry state. No reservation or
        // financial rows have been changed yet at this point.
        await connection.commit()
        return res.status(verificationResult.statusCode || 400).json({ message: verificationResult.message })
      }
      correctionAuthorization = { verificationId, actorId: actor.id }
    }
    const before = buildBeforeSnapshot(source, bundle)
    const after = buildAfterSnapshot(destination, bundle, computation)
    const accountId = Number(bundle.lot_project_account_id)
    const profileId = Number(bundle.lot_project_client_profile_id)
    const historyId = Number(bundle.lot_project_reservation_history_id || 0) || null

    // Pending/eligible release rows are derived values. There are no released
    // rows here because the safety gate above forbids them.
    if ((await tableExists(connection, 'lot_project_commission_releases')) && (await tableExists(connection, 'lot_project_commissions'))) {
      await connection.query(
        `DELETE release_row FROM lot_project_commission_releases release_row
         INNER JOIN lot_project_commissions commission
           ON commission.lot_project_commission_id = release_row.lot_project_commission_id
         WHERE commission.lot_project_client_profile_id = ?`,
        [profileId]
      )
    }

    // Rebuild the buyer document checklist. Uploaded files are forbidden by the
    // safety gate; therefore deleting these checklist rows cannot lose a file.
    if (await tableExists(connection, 'lot_project_client_documents')) {
      await connection.query(`DELETE FROM lot_project_client_documents WHERE lot_project_client_profile_id = ?`, [profileId])
    }

    // Move the canonical current account/profile/history to the correct unit.
    await connection.query(
      `UPDATE lot_project_accounts
       SET lot_project_listing_id = ?, unit_id_snapshot = ?, account_status = 'active',
           cancellation_date = NULL, closed_at = NULL,
           cash_collected_at_cancellation = 0, refund_amount = 0, discontinued_amount = 0,
           commissionable_retained_amount = 0, commissionable_retained_percent = 0,
           cancellation_reason = NULL, settlement_notes = NULL, updated_at = NOW()
       WHERE lot_project_account_id = ?`,
      [destinationId, destination.lot_project_listing_unit_id, accountId]
    )

    await updateOptionalColumns(connection, 'lot_project_client_profiles', 'lot_project_client_profile_id', profileId, {
      lot_project_listing_id: destinationId,
      assigned_accredited_seller_id: computation.terms.sellerId,
      sale_channel: computation.terms.saleChannel,
      lot_project_client_profile_status: 'active',
      soa_mode_of_payment: computation.terms.modeOfPayment,
      soa_selected_price_per_sqm: computation.pricing.pricePerSqm,
      soa_selected_base_selling_price: computation.pricing.baseSellingPrice,
      soa_sale_discount_percentage: computation.pricing.saleDiscountPercentage,
      soa_sale_discount_amount: computation.pricing.saleDiscountAmount,
      soa_selected_net_selling_price: computation.pricing.netSellingPrice,
      soa_selected_lmf_amount: computation.pricing.lmfAmount,
      soa_selected_tcp: computation.pricing.tcp,
      soa_reservation_fee: computation.terms.reservationFee,
      soa_reservation_fee_applied_to_downpayment: computation.terms.reservationFeeAppliedToDownpayment ? 1 : 0,
      soa_legal_misc_fee_mode: computation.terms.legalMiscFeeMode,
      soa_legal_misc_fee_amount: computation.pricing.lmfAmount,
      soa_starting_date: computation.terms.startingDate,
      soa_first_due_date: computation.terms.firstDueDate,
      soa_downpayment_percentage: computation.terms.downpaymentPercentage,
      soa_downpayment_input_mode: computation.terms.downpaymentInputMode,
      soa_downpayment_amount: computation.terms.downpaymentAmount,
      soa_downpayment_terms: computation.terms.downpaymentTerms,
      soa_monthly_terms: computation.terms.monthlyTerms,
      soa_annual_interest_rate: computation.terms.annualInterestRate,
      soa_interest_rate_overridden: computation.terms.interestRateOverridden ? 1 : 0,
      soa_dp_discount_percentage: computation.terms.dpDiscountPercentage,
      soa_penalty_rate_percent: computation.terms.dailyPenaltyRate,
      soa_penalty_grace_days: computation.terms.penaltyGraceDays,
      soa_penalty_effective_from: computation.terms.penaltyEffectiveFrom,
      needs_soa_review: 0,
    })

    if (historyId && await tableExists(connection, 'lot_project_reservation_history')) {
      await updateOptionalColumns(connection, 'lot_project_reservation_history', 'lot_project_reservation_history_id', historyId, {
        lot_project_listing_id: destinationId,
        unit_id_snapshot: destination.lot_project_listing_unit_id,
        reservation_status: 'active',
        pricing_mode_snapshot: computation.terms.modeOfPayment,
        price_per_sqm_snapshot: computation.pricing.pricePerSqm,
        base_selling_price_snapshot: computation.pricing.baseSellingPrice,
        net_selling_price_snapshot: computation.pricing.netSellingPrice,
        lmf_amount_snapshot: computation.pricing.lmfAmount,
        sale_discount_percentage_snapshot: computation.pricing.saleDiscountPercentage,
        sale_discount_amount_snapshot: computation.pricing.saleDiscountAmount,
        dp_discount_percentage_snapshot: computation.terms.dpDiscountPercentage,
        dp_discount_amount_snapshot: computation.computedTerms.downpaymentDiscountTotal,
        tcp_snapshot: computation.pricing.tcp,
        discount_percentage_snapshot: computation.terms.dpDiscountPercentage,
        discount_applied_snapshot: computation.computedTerms.downpaymentDiscountTotal,
        cancelled_at: null,
        cancellation_type: null,
        cancellation_refund_type: null,
        cancellation_reason: null,
        cancelled_value: 0,
        cash_collected_at_cancellation: 0,
        refund_amount: 0,
        discontinued_amount: 0,
        refund_date: null,
        refund_reference: null,
        cancellation_settlement_notes: null,
        released_commission_amount_at_cancellation: 0,
        cancelled_by_user_id: null,
      })
    }

    // Release the incorrectly selected unit. This is not a cancellation.
    await updateOptionalColumns(connection, 'lot_project_listings', 'lot_project_listing_id', sourceId, {
      current_account_id: null,
      lot_project_listing_status: 'available',
      lot_project_listing_sold_substatus: null,
      lot_project_listing_cancellation_type: null,
      hold_client_name: null,
      hold_note: null,
      hold_created_at: null,
      hold_created_by_user_id: null,
      pending_buyer_form_submission_id: null,
    })

    // Claim the intended destination unit with the same canonical buyer account.
    await updateOptionalColumns(connection, 'lot_project_listings', 'lot_project_listing_id', destinationId, {
      current_account_id: accountId,
      lot_project_listing_status: 'sold',
      lot_project_listing_sold_substatus: 'active',
      lot_project_listing_cancellation_type: null,
      hold_client_name: null,
      hold_note: null,
      hold_created_at: null,
      hold_created_by_user_id: null,
      pending_buyer_form_submission_id: null,
    })

    // Buyer-form records belong to the account. Keep them attached to the
    // corrected unit when these schemas expose a listing foreign key.
    for (const tableName of ['lot_project_buyer_form_links', 'lot_project_buyer_form_submissions']) {
      if ((await tableExists(connection, tableName)) && (await columnExists(connection, tableName, 'lot_project_account_id')) && (await columnExists(connection, tableName, 'lot_project_listing_id'))) {
        await connection.query(
          `UPDATE ${tableName} SET lot_project_listing_id = ? WHERE lot_project_account_id = ?`,
          [destinationId, accountId]
        )
      }
    }

    // Unsent SOA statements are disposable previews tied to the old unit/schedule.
    // Sent statements are a hard blocker above and are never rewritten.
    if (await tableExists(connection, 'lot_project_soa_statements')) {
      const hasStatementAccountId = await columnExists(connection, 'lot_project_soa_statements', 'lot_project_account_id')
      await connection.query(
        `DELETE FROM lot_project_soa_statements
         WHERE ${hasStatementAccountId ? 'lot_project_account_id = ?' : 'lot_project_client_profile_id = ?'}
           AND COALESCE(sent_count, 0) = 0`,
        [hasStatementAccountId ? accountId : profileId]
      )
    }

    // Payment records belong to the buyer account. Retarget every historical row,
    // including Cancelled rows, so the account does not keep stale references to
    // the incorrectly selected unit. Amount/date/reference values are never rewritten.
    if ((await tableExists(connection, 'lot_project_payments')) && (await columnExists(connection, 'lot_project_payments', 'lot_project_account_id'))) {
      await connection.query(
        `UPDATE lot_project_payments
         SET lot_project_listing_id = ?
         WHERE lot_project_account_id = ?`,
        [destinationId, accountId]
      )
    }

    // Rebuild all unit-dependent derived state from destination pricing while
    // carrying the admin-selected terms and original buyer identity.
    await insertReservationDocuments(connection, project.lot_project_id, destinationId, profileId, null)
    if ((await tableExists(connection, 'lot_project_client_documents')) && (await columnExists(connection, 'lot_project_client_documents', 'lot_project_account_id'))) {
      await connection.query(
        `UPDATE lot_project_client_documents SET lot_project_account_id = ? WHERE lot_project_client_profile_id = ?`,
        [accountId, profileId]
      )
    }

    await replaceReservationSchedules(
      connection,
      project.lot_project_id,
      computation.scheduleListing,
      profileId,
      accountId,
      computation.terms
    )

    if (safety.paymentCount > 0) {
      await rebuildListingPaymentAllocationsChronologically(connection, {
        ...computation.scheduleListing,
        lot_project_id: project.lot_project_id,
        lot_project_listing_id: destinationId,
        lot_project_client_profile_id: profileId,
        lot_project_account_id: accountId,
      }, { finalAsOfDate: todayDateOnly() })
    }

    await replaceReservationCommissions(
      connection,
      project.lot_project_id,
      computation.scheduleListing,
      profileId,
      computation.terms.sellerId,
      computation.terms.saleChannel
    )
    if ((await tableExists(connection, 'lot_project_commissions')) && (await columnExists(connection, 'lot_project_commissions', 'lot_project_account_id'))) {
      await connection.query(
        `UPDATE lot_project_commissions SET lot_project_account_id = ? WHERE lot_project_client_profile_id = ?`,
        [accountId, profileId]
      )
    }

    // Recompute commission payment progress after verified payments have been
    // replayed onto the corrected destination SOA. This prevents a controlled
    // correction from resetting commission eligibility to 0%.
    await syncCommissionProgressForListing(connection, {
      lot_project_listing_id: destinationId,
      lot_project_account_id: accountId,
    })

    const [correctionResult] = await connection.query(
      `INSERT INTO ${CORRECTION_TABLE} (
         lot_project_id, lot_project_account_id, lot_project_client_profile_id,
         lot_project_reservation_history_id, source_listing_id, source_unit_id_snapshot,
         destination_listing_id, destination_unit_id_snapshot, account_reference_snapshot,
         buyer_name_snapshot, before_snapshot, after_snapshot, correction_reason,
         corrected_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.lot_project_id,
        accountId,
        profileId,
        historyId,
        sourceId,
        source.lot_project_listing_unit_id,
        destinationId,
        destination.lot_project_listing_unit_id,
        bundle.account_reference || null,
        bundle.buyer_full_name || bundle.buyer_name_snapshot || null,
        JSON.stringify(before),
        JSON.stringify(after),
        reason,
        req.authUser?.id || null,
      ]
    )

    await writeAuditLog(connection, req, {
      action: 'correct',
      module: 'Reservations',
      entityType: 'reservation_correction',
      entityId: String(correctionResult.insertId),
      entityLabel: `${source.lot_project_listing_unit_id} → ${destination.lot_project_listing_unit_id}`,
      title: safety.controlledEligible ? 'Controlled correction of reservation unit' : 'Corrected reservation unit',
      description: `${safety.controlledEligible ? 'Controlled financial correction' : 'Administrative reservation correction'} moved ${bundle.buyer_full_name || 'the buyer'} from ${source.lot_project_listing_unit_id} to ${destination.lot_project_listing_unit_id} without creating cancellation history.`,
      metadata: {
        projectId: project.lot_project_id,
        projectName: project.lot_project_name || project.name,
        reason,
        accountId,
        accountReference: bundle.account_reference,
        buyerProfileId: profileId,
        correctionMode: safety.controlledEligible ? 'controlled' : 'simple',
        verifiedPaymentCount: safety.paymentCount,
        verificationId: correctionAuthorization?.verificationId || null,
        before,
        after,
        cancellationCreated: false,
        refundCreated: false,
      },
    })

    await connection.commit()
    return res.json({
      success: true,
      message: `${safety.controlledEligible ? 'Controlled reservation correction' : 'Reservation correction'} completed from ${source.lot_project_listing_unit_id} to ${destination.lot_project_listing_unit_id}. No cancellation or Buyer Account History entry was created.`,
      data: {
        correctionId: Number(correctionResult.insertId),
        sourceListingId: sourceId,
        destinationListingId: destinationId,
        destinationUnitId: destination.lot_project_listing_unit_id,
        accountId,
        accountReference: bundle.account_reference,
        before,
        after,
      },
    })
  } catch (error) {
    try { await connection.rollback() } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}


