import bcrypt from 'bcrypt';
import {
  db,
  getErrorMessage,
  slugify,
  toNullable,
  toNullableNumber,
  toActiveStatus,
  tableExists,
  columnExists,
  money,
  plainDate,
  formatDateTime,
  toDisplayValue,
  safeDeleteByProjectId,
  normalizeProjectPayload,
  getListingStatusLabel,
  normalizeLotType,
  lotTypeLabel,
  normalizeListingStatusPayload,
  formatDocumentsLabel,
  mapListingRow,
  mapProjectRows,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  getListingLookupWhere,
  computeAgeFromDate,
  getClientCompletionStatus,
  mapClientProfile,
  canEditBuyerProfileForListing,
  mapProfileListing,
  getListingDocuments,
  roundMoneyValue,
  normalizeDateInput,
  addMonthsToDate,
  getOrdinalLabel,
  getScheduleTotalDue,
  appendPaymentReference,
  getPaymentAmountValue,
  createBalloonPrincipalRow,
  getRowSortOrder,
  sortComputedRows,
  getComputedSoaTerms,
  createComputedSoaRows,
  getPaymentTargetRows,
  allocatePaymentsToComputedRows,
  recomputeComputedSoaBalances,
  getExistingSoaScheduleRows,
  getLatestActiveScheduleGenerationPredicate,
  canGenerateListingSoa,
  getListingSoaRows,
  getRequestToken,
  getAuthenticatedUser,
  getUserFullName,
  getListingForPayment,
  lockPaymentAccountForListing,
  lockPaymentSchedulesForListing,
  normalizePaymentType,
  getPaymentTypeLabel,
  getRemainingUnpaidScheduleBalance,
  getBalloonPrincipalCapacity,
  rebuildListingPaymentAllocationsChronologically,
  hasCrossTypePaymentAllocations,
  normalizePaymentMethod,
  getNextCashReference,
  mapPaymentRow,
  getListingPayments,
  recomputeListingScheduleBalances,
  applyPaymentToSchedules,
  reversePaymentAllocations,
  getPaymentById,
  getListingPenaltySnapshots,
  refreshListingPenaltyCache,
  getStoredScheduleType,
  todayDateOnly,
  dateOrNull,
  parseMoneyValue,
  cleanBuyerType,
  cleanSecondBuyerRole,
  addIfColumnExists,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { isFullAccessAdministrator } from '../../../config/permissions.js';
import { runTransactionWithRetry } from '../../../utils/transactionRetry.js';
import { createPaymentStorageCode } from '../../../services/storageCodes.service.js';
import { syncCommissionProgressForListing } from '../../../services/commissionProgress.service.js';
import { appendReviewEvent, assertEntityNotReviewLocked, createOperationalReview } from '../../../services/operationalReview.service.js';
import { createProtectedChangeRequest, consumeProtectedChange } from '../../../services/protectedChange.service.js';
import { notifyAuditors, notifyDepartmentHeads, notifySystemAdmins } from '../../../services/internalNotification.service.js';
import { getPendingAuditCorrectionCase, advanceAuditCaseToRecheck } from '../../../services/auditCaseAuthorization.service.js';
import { sendEmail } from '../../../services/email.service.js';
import {
  createSensitiveActionVerification,
  getSensitiveActionRequestIp,
  maskSensitiveActionEmail,
  SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
  verifyAndConsumeSensitiveAction,
} from '../../../services/sensitiveActionVerification.service.js';

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};


const PAYMENT_CORRECTION_ACTION = 'lot_project_payment_correction';
const PAYMENT_CORRECTION_ENTITY = 'lot_project_payment';


const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const PAYMENT_EMAIL_DEFAULT_LOGO_URL = 'https://res.cloudinary.com/dvazrmgq9/image/upload/v1784705909/logo-mobile_2_i0damo.png';
const getPaymentEmailLogoUrl = () => String(process.env.EMAIL_LOGO_URL || PAYMENT_EMAIL_DEFAULT_LOGO_URL).trim();
const formatPaymentRecordedAt = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const dateLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(validDate);
  const dayLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  }).format(validDate);
  const timeLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(validDate);
  return `${dateLabel} (${dayLabel}) • ${timeLabel} PHT`;
};
const maskPaymentAccountNumber = (value) => {
  const clean = String(value || '').trim();
  if (!clean) return '-';
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
};

const sendPaymentEntryCompanyNotification = async ({ req, user, project, payment }) => {
  try {
    if (!(await tableExists(db, 'lot_project_settings'))) return { enabled: false, sent: false, reason: 'project_settings_missing' };
    if (!(await columnExists(db, 'lot_project_settings', 'payment_entry_email_notification_enabled'))) {
      return { enabled: false, sent: false, reason: 'setting_not_migrated' };
    }

    const projectId = Number(project?.lot_project_id || project?.id || 0);
    if (!projectId) return { enabled: false, sent: false, reason: 'project_missing' };

    const [settingsRows] = await db.query(
      `SELECT company_name, company_email, payment_entry_email_notification_enabled
       FROM lot_project_settings
       WHERE lot_project_id = ?
       LIMIT 1`,
      [projectId]
    );
    const settings = settingsRows[0] || {};
    const enabled = Number(settings.payment_entry_email_notification_enabled || 0) === 1;
    if (!enabled) return { enabled: false, sent: false, reason: 'disabled' };

    const companyEmail = String(settings.company_email || '').trim();
    if (!isValidEmailAddress(companyEmail)) {
      const warning = 'Payment notification is enabled for this project, but its Company Email is missing or invalid.';
      console.warn(warning);
      try {
        await writeAuditLog(db, req, {
          action: 'system', module: 'Payments', entityType: 'lot_project_payment', entityId: String(payment.paymentId),
          entityLabel: payment.referenceId || `Payment #${payment.paymentId}`,
          title: 'Payment notification email skipped',
          description: warning,
          metadata: { projectId, notificationEnabled: true, companyEmail: companyEmail || null },
        });
      } catch (_) {}
      return { enabled: true, sent: false, reason: 'invalid_company_email', warning };
    }

    const companyName = String(settings.company_name || process.env.COMPANY_NAME || 'D&C Prime Realty').trim();
    const enteredBy = getUserFullName(user) || user?.email || 'Authorized User';
    const reference = payment.referenceId || `Payment #${payment.paymentId}`;
    const projectName = project?.lot_project_name || project?.name || '-';
    const unitId = payment.unitId || '-';
    const buyerName = payment.buyerName || '-';
    const amountLabel = money(payment.amount);
    const paymentDateLabel = payment.paymentDate || '-';
    const paymentTypeLabel = getPaymentTypeLabel(payment.paymentType);
    const paymentMethodLabel = payment.paymentMethod || '-';
    const recordedAtLabel = formatPaymentRecordedAt(new Date());
    const logoUrl = getPaymentEmailLogoUrl();
    const subject = `Payment recorded - ${unitId} - ${reference}`;
    const detailLines = [
      `Project: ${projectName}`,
      `Unit: ${unitId}`,
      `Buyer: ${buyerName}`,
      `Amount: ${amountLabel}`,
      `Payment date: ${paymentDateLabel}`,
      `Payment type: ${paymentTypeLabel}`,
      `Payment method: ${paymentMethodLabel}`,
      ...(paymentMethodLabel !== 'Cash' ? [`Bank / provider: ${payment.bankName || '-'}`, `Account / wallet: ${maskPaymentAccountNumber(payment.accountNumber)}`] : []),
      `Reference: ${reference}`,
      `Entered by: ${enteredBy}`,
      `Recorded at: ${recordedAtLabel}`,
    ];

    const rowHtml = (label, value, options = {}) => {
      const valueStyle = options.emphasis
        ? 'font-size:15px;font-weight:800;color:#0f172a;'
        : 'font-size:14px;font-weight:600;color:#334155;';
      return `<tr>
        <td style="width:38%;padding:11px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b;vertical-align:top">${escapePaymentCorrectionHtml(label)}</td>
        <td style="padding:11px 14px;border-top:1px solid #e2e8f0;${valueStyle}vertical-align:top">${escapePaymentCorrectionHtml(value)}</td>
      </tr>`;
    };

    const detailsHtml = `
      <div style="overflow:hidden;border:1px solid #dbe3ee;border-radius:14px;background:#ffffff">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
          ${rowHtml('Project', projectName)}
          ${rowHtml('Unit', unitId)}
          ${rowHtml('Buyer', buyerName)}
          ${rowHtml('Payment date', paymentDateLabel)}
          ${rowHtml('Payment type', paymentTypeLabel)}
          ${rowHtml('Payment method', paymentMethodLabel)}
          ${paymentMethodLabel !== 'Cash' ? rowHtml('Bank / provider', payment.bankName || '-') : ''}
          ${paymentMethodLabel !== 'Cash' ? rowHtml('Account / wallet', maskPaymentAccountNumber(payment.accountNumber)) : ''}
          ${rowHtml('Reference', reference, { emphasis: true })}
          ${rowHtml('Entered by', enteredBy)}
          ${rowHtml('Recorded at', recordedAtLabel, { emphasis: true })}
        </table>
      </div>`;

    const html = `<!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f1f5f9;padding:28px 12px">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08)">
                  <tr>
                    <td style="padding:24px 28px;background:#0f172a;color:#ffffff">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
                        <tr>
                          <td style="vertical-align:middle">
                            ${logoUrl ? `<img src="${escapePaymentCorrectionHtml(logoUrl)}" alt="${escapePaymentCorrectionHtml(companyName)}" width="46" height="46" style="display:block;width:46px;height:46px;border-radius:12px;background:#ffffff;object-fit:contain">` : ''}
                          </td>
                          <td style="padding-left:14px;vertical-align:middle;width:100%">
                            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd">Payment Entry Notification</div>
                            <div style="margin-top:4px;font-size:20px;font-weight:800;color:#ffffff">${escapePaymentCorrectionHtml(companyName)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px">
                      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Verified Payment Recorded</div>
                      <h1 style="margin:14px 0 6px;font-size:27px;line-height:1.2;color:#0f172a">${escapePaymentCorrectionHtml(amountLabel)}</h1>
                      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#334155">${escapePaymentCorrectionHtml(buyerName)} · ${escapePaymentCorrectionHtml(unitId)}</p>
                      <p style="margin:0 0 22px;font-size:13px;color:#64748b">Reference: <strong style="color:#334155">${escapePaymentCorrectionHtml(reference)}</strong></p>

                      <div style="margin:0 0 22px;padding:14px 16px;border-left:4px solid #2563eb;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:14px;line-height:1.55">
                        A new verified payment was recorded in the system. Please review the details below and confirm that the amount, date, and reference are correct.
                      </div>

                      ${detailsHtml}

                      <div style="margin-top:22px;padding:16px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:13px;line-height:1.55">
                        <strong>Double-check required:</strong> If any payment detail is incorrect, open the buyer account in the internal system and use the approved payment-correction workflow. Do not create a duplicate payment entry.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b">
                      This is an automated internal notification sent to the Company Email configured in System Settings.<br>
                      ${escapePaymentCorrectionHtml(companyName)} · Recorded ${escapePaymentCorrectionHtml(recordedAtLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>`;

    await sendEmail({
      to: companyEmail,
      subject,
      text: [
        `PAYMENT ENTRY NOTIFICATION - ${companyName}`, '',
        `A new verified payment was recorded for ${buyerName}. Please double-check the entry below.`, '',
        ...detailLines, '',
        'If any value is incorrect, review the buyer account in the internal system and use the approved payment-correction workflow. Do not create a duplicate payment entry.',
      ].join('\n'),
      html,
      idempotencyKey: `payment-entry-${payment.paymentId}`,
    });

    try {
      await writeAuditLog(db, req, {
        action: 'send', module: 'Payments', entityType: 'lot_project_payment', entityId: String(payment.paymentId),
        entityLabel: reference,
        title: 'Sent Add Payment notification',
        description: `Sent the new payment notification to the configured Company Email (${companyEmail}).`,
        metadata: { recipient: companyEmail, referenceId: reference, amount: Number(payment.amount || 0), unitId: payment.unitId || null },
      });
    } catch (_) {}

    return { enabled: true, sent: true, recipient: companyEmail };
  } catch (error) {
    const warning = `Payment was saved, but the Company Email notification could not be sent: ${error?.message || 'Unknown email error.'}`;
    console.error(warning);
    try {
      await writeAuditLog(db, req, {
        action: 'system', module: 'Payments', entityType: 'lot_project_payment', entityId: String(payment?.paymentId || ''),
        entityLabel: payment?.referenceId || `Payment #${payment?.paymentId || '-'}`,
        title: 'Payment notification email failed',
        description: warning,
        metadata: { errorCode: error?.code || null, errorMessage: error?.message || null },
      });
    } catch (_) {}
    return { enabled: true, sent: false, reason: 'send_failed', warning };
  }
};

const cleanPaymentCorrectionValue = (value) => String(value ?? '').trim();
const escapePaymentCorrectionHtml = (value = '') => cleanPaymentCorrectionValue(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildPaymentCorrectionPayload = ({ action, actor, listing, existingPayment, body = {}, reason }) => {
  const normalizedAction = cleanPaymentCorrectionValue(action).toLowerCase();
  const paymentMethod = normalizedAction === 'edit'
    ? normalizePaymentMethod(body.method || body.paymentMethod || body.payment_method || existingPayment.lot_project_payment_method)
    : existingPayment.lot_project_payment_method;
  const requestedScheduleId = body.soaRowId ?? body.paymentScheduleId ?? body.lot_project_payment_schedule_id;
  const proposed = normalizedAction === 'edit'
    ? {
        scheduleId: normalizePaymentType(body.paymentType || body.payment_type || existingPayment.lot_project_payment_type) === 'full_payment' || normalizePaymentType(body.paymentType || body.payment_type || existingPayment.lot_project_payment_type) === 'balloon'
          ? null
          : toNullableNumber(requestedScheduleId ?? existingPayment.lot_project_payment_schedule_id),
        paymentType: normalizePaymentType(body.paymentType || body.payment_type || existingPayment.lot_project_payment_type),
        amount: roundMoneyValue(parseMoneyValue(body.amount ?? existingPayment.lot_project_payment_amount)),
        paymentDate: dateOrNull(body.paymentDate || body.payment_date) || plainDate(existingPayment.lot_project_payment_date),
        method: paymentMethod,
        bankName: paymentMethod === 'Cash' ? null : toNullable(body.bankName || body.bank_name || body.paymentBank || body.payment_bank || existingPayment.lot_project_payment_bank_name),
        accountNumber: paymentMethod === 'Cash' ? null : toNullable(body.accountNumber || body.account_number || body.accountNo || body.account_no || existingPayment.lot_project_payment_account_number),
        referenceId: paymentMethod === 'Cash'
          ? cleanPaymentCorrectionValue(existingPayment.lot_project_payment_reference_id)
          : toNullable(body.referenceId || body.reference_id || existingPayment.lot_project_payment_reference_id),
        penaltyHandling: cleanPaymentCorrectionValue(body.penaltyHandling || body.penalty_handling || 'apply').toLowerCase(),
        penaltyWaiverReason: cleanPaymentCorrectionValue(body.penaltyWaiverReason || body.penalty_waiver_reason),
        penaltyWaiverInternalNotes: toNullable(body.penaltyWaiverInternalNotes || body.penalty_waiver_internal_notes),
      }
    : { status: 'Cancelled' };

  return {
    action: normalizedAction,
    paymentId: Number(existingPayment.lot_project_payment_id || 0),
    accountId: Number(listing.lot_project_account_id || 0),
    listingId: Number(listing.lot_project_listing_id || 0),
    clientProfileId: Number(listing.lot_project_client_profile_id || 0),
    actorId: Number(actor?.id || 0),
    reason: cleanPaymentCorrectionValue(reason),
    proposed,
  };
};

const validatePaymentCorrectionRequest = ({ action, reason, payload }) => {
  if (!['edit', 'void'].includes(action)) throw createHttpError(400, 'Payment correction action must be edit or void.');
  if (cleanPaymentCorrectionValue(reason).length < 5) throw createHttpError(400, 'A clear correction reason is required.');
  if (action === 'edit') {
    if (Number(payload?.proposed?.amount || 0) <= 0) throw createHttpError(400, 'Payment amount must be greater than 0.');
    if (!payload?.proposed?.paymentDate) throw createHttpError(400, 'Payment date is required.');
    if (payload.proposed.paymentDate > todayDateOnly()) throw createHttpError(400, 'Future payment dates are blocked.');
    if (!['apply', 'waive'].includes(payload.proposed.penaltyHandling)) throw createHttpError(400, 'Penalty handling must be apply or waive.');
  }
};

const sendPaymentCorrectionCodeEmail = async ({ actor, code, action, listing, payment, payload }) => {
  const companyName = cleanPaymentCorrectionValue(process.env.COMPANY_NAME) || 'D&C Prime Realty';
  const actionLabel = action === 'void' ? 'void payment' : 'edit payment';
  const unitId = listing.lot_project_listing_unit_id || '-';
  const buyerName = listing.buyer_full_name || listing.buyer_name_snapshot || 'Buyer';
  const referenceId = payment.lot_project_payment_reference_id || `Payment #${payment.lot_project_payment_id}`;
  const proposed = payload.proposed || {};
  await sendEmail({
    to: actor.email,
    subject: `Payment correction verification - ${unitId}`,
    text: [
      `Hello ${getUserFullName(actor) || 'Authorized User'},`, '',
      `Your verification code is ${code}.`,
      `Action: ${actionLabel}`,
      `Unit: ${unitId}`,
      `Buyer: ${buyerName}`,
      `Reference: ${referenceId}`,
      `Current amount: ${money(payment.lot_project_payment_amount)}`,
      ...(action === 'edit' ? [`Proposed amount: ${money(proposed.amount)}`, `Proposed payment date: ${proposed.paymentDate}`] : []),
      `Reason: ${payload.reason}`,
      `This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.`, '',
      'Do not share this code. Ignore this email if you did not request this financial correction.', '', companyName,
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>${escapePaymentCorrectionHtml(companyName)}</h2><p>Hello ${escapePaymentCorrectionHtml(getUserFullName(actor) || 'Authorized User')},</p><p>Use this code to authorize a <strong>${escapePaymentCorrectionHtml(actionLabel)}</strong> correction for <strong>${escapePaymentCorrectionHtml(unitId)}</strong> — ${escapePaymentCorrectionHtml(buyerName)}.</p><div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:18px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;text-align:center">${code}</div><p><strong>Reference:</strong> ${escapePaymentCorrectionHtml(referenceId)}<br/><strong>Current amount:</strong> ${escapePaymentCorrectionHtml(money(payment.lot_project_payment_amount))}${action === 'edit' ? `<br/><strong>Proposed amount:</strong> ${escapePaymentCorrectionHtml(money(proposed.amount))}<br/><strong>Proposed payment date:</strong> ${escapePaymentCorrectionHtml(proposed.paymentDate)}` : ''}<br/><strong>Reason:</strong> ${escapePaymentCorrectionHtml(payload.reason)}</p><p>This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.</p><p style="color:#991b1b"><strong>This changes an already recorded financial transaction and must be reviewed carefully.</strong></p></div>`,
  });
};

const requirePaymentCorrectionVerification = async (connection, req, { action, listing, existingPayment }) => {
  const actor = req.authUser || await getAuthenticatedUser(req);
  if (!actor?.id) throw createHttpError(401, 'Authentication is required.');
  const reason = cleanPaymentCorrectionValue(req.body.reason);
  const payload = buildPaymentCorrectionPayload({ action, actor, listing, existingPayment, body: req.body, reason });
  validatePaymentCorrectionRequest({ action, reason, payload });

  // The Head can enter a correction directly only when the record is not already
  // locked by an active review/case. The saved change is sent straight to Auditor review.
  if (actor.role === 'accounting_head') {
    return { ok: true, actor, reason, payload, authorizationType: 'department_head', headPreApprovedByUserId: actor.id };
  }

  // Staff may correct only a payment that the Accounting Head explicitly returned.
  // The same review is reused and goes back to Head review after the correction.
  const returnedReviewId = Number(req.body.reviewId || req.body.review_id || 0);
  const returnedParams = returnedReviewId
    ? [returnedReviewId, String(existingPayment.lot_project_payment_id), actor.id]
    : [String(existingPayment.lot_project_payment_id), actor.id];
  const returnedWhere = returnedReviewId
    ? `operational_review_id=? AND entity_type='lot_project_payment' AND entity_id=? AND initiated_by_user_id=?`
    : `entity_type='lot_project_payment' AND entity_id=? AND initiated_by_user_id=?`;
  const [returnedRows] = await connection.query(
    `SELECT * FROM operational_reviews
     WHERE ${returnedWhere} AND status='returned_for_correction'
     ORDER BY operational_review_id DESC LIMIT 1 FOR UPDATE`,
    returnedParams
  );
  const returnedReview = returnedRows[0] || null;
  if (returnedReview) {
    return {
      ok: true,
      actor,
      reason,
      payload,
      authorizationType: 'returned_review',
      allowReviewId: returnedReview.operational_review_id,
      returnedReview,
    };
  }
  if (returnedReviewId) {
    throw createHttpError(409, 'This returned-review correction is no longer valid for your account.');
  }

  // A valid Auditor finding gives System Admin a correction right only for the
  // exact payment attached to that Audit Case.
  const auditCaseId = Number(req.body.auditCaseId || req.body.audit_case_id || 0);
  if (actor.role === 'system_admin' && auditCaseId) {
    const [caseRows] = await connection.query(
      `SELECT c.*, r.entity_type, r.entity_id, r.operational_review_id, r.review_number
       FROM audit_cases c
       INNER JOIN operational_reviews r ON r.operational_review_id = c.operational_review_id
       WHERE c.audit_case_id = ?
       LIMIT 1 FOR UPDATE`,
      [auditCaseId]
    );
    const auditCase = caseRows[0];
    if (
      !auditCase ||
      auditCase.status !== 'pending_system_admin_correction' ||
      auditCase.entity_type !== 'lot_project_payment' ||
      String(auditCase.entity_id) !== String(existingPayment.lot_project_payment_id)
    ) {
      throw createHttpError(409, 'This Audit Case does not authorize correction of this payment.');
    }
    return {
      ok: true,
      actor,
      reason,
      payload,
      authorizationType: 'audit_case',
      allowReviewId: auditCase.operational_review_id,
      auditCase,
    };
  }

  // Super Admin remains the owner-level emergency fallback and keeps the existing
  // email-code verification path. Password is checked when the code is requested.
  if (actor.role === 'super_admin') {
    const verificationId = Number(req.body.verificationId || req.body.verification_id || 0);
    const code = cleanPaymentCorrectionValue(req.body.code || req.body.verificationCode || req.body.verification_code);
    if (!verificationId || !code) throw createHttpError(400, 'Emergency Super Admin correction requires email verification.');
    const verificationResult = await verifyAndConsumeSensitiveAction(connection, {
      verificationId,
      userId: actor.id,
      actionType: PAYMENT_CORRECTION_ACTION,
      entityType: PAYMENT_CORRECTION_ENTITY,
      entityId: existingPayment.lot_project_payment_id,
      code,
      payload,
    });
    if (!verificationResult.ok) return { ok: false, ...verificationResult };
    return {
      ok: true,
      actor,
      reason,
      payload,
      verificationId,
      authorizationType: 'emergency_super_admin',
      headPreApprovedByUserId: actor.id,
    };
  }

  if (actor.role === 'accounting_staff') {
    throw createHttpError(409, 'Accounting Staff can correct a recorded payment only after the Accounting Head returns its review for correction.');
  }

  throw createHttpError(403, 'You are not authorized to correct this recorded payment.');
};

const completePaymentCorrectionWorkflow = async (connection, {
  actor, project, listing, existingPayment, paymentId, action, authorization, afterSnapshot,
}) => {
  const beforeSnapshot = {
    amount: Number(existingPayment.lot_project_payment_amount || 0),
    paymentDate: plainDate(existingPayment.lot_project_payment_date),
    paymentType: existingPayment.lot_project_payment_type,
    paymentMethod: existingPayment.lot_project_payment_method,
    referenceId: existingPayment.lot_project_payment_reference_id,
    scheduleId: existingPayment.lot_project_payment_schedule_id,
    status: existingPayment.lot_project_payment_status,
  };

  if (authorization.authorizationType === 'returned_review') {
    const review = authorization.returnedReview;
    await connection.query(
      `UPDATE operational_reviews
       SET status='pending_head_review',
           revision=revision+1,
           before_snapshot_json=?,
           after_snapshot_json=?,
           claimed_by_user_id=NULL,
           claimed_at=NULL,
           head_reviewed_by_user_id=NULL,
           head_reviewed_at=NULL,
           auditor_reviewed_by_user_id=NULL,
           auditor_reviewed_at=NULL
       WHERE operational_review_id=?`,
      [JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), review.operational_review_id]
    );
    await appendReviewEvent(connection, {
      reviewId: review.operational_review_id,
      eventType: action === 'void' ? 'staff_void_submitted' : 'staff_correction_submitted',
      actor,
      fromStatus: 'returned_for_correction',
      toStatus: 'pending_head_review',
      message: authorization.reason,
      metadata: { action, paymentId },
    });
    await notifyDepartmentHeads(connection, {
      department: 'accounting',
      projectId: project.lot_project_id,
      reviewId: review.operational_review_id,
      title: `Corrected payment ready for Head review · ${review.review_number}`,
      message: `${listing.lot_project_listing_unit_id} was corrected by the original staff member. Please review the new values.`,
    });
    return { reviewId: review.operational_review_id, reviewNumber: review.review_number, status: 'pending_head_review' };
  }

  if (authorization.authorizationType === 'audit_case') {
    const auditCase = authorization.auditCase;
    const summary = `${action === 'void' ? 'Voided' : 'Corrected'} payment ${existingPayment.lot_project_payment_reference_id || paymentId}: ${authorization.reason}`;
    await connection.query(
      `UPDATE audit_cases
       SET status='pending_auditor_recheck',
           system_admin_user_id=?,
           correction_summary=?,
           correction_applied_at=NOW()
       WHERE audit_case_id=? AND status='pending_system_admin_correction'`,
      [actor.id, summary, auditCase.audit_case_id]
    );
    await connection.query(
      `UPDATE operational_reviews
       SET status='pending_auditor_recheck', after_snapshot_json=?
       WHERE operational_review_id=?`,
      [JSON.stringify(afterSnapshot), auditCase.operational_review_id]
    );
    await appendReviewEvent(connection, {
      reviewId: auditCase.operational_review_id,
      eventType: 'system_correction_applied',
      actor,
      fromStatus: 'correction_required',
      toStatus: 'pending_auditor_recheck',
      message: summary,
      metadata: { auditCaseId: auditCase.audit_case_id, action, paymentId },
    });
    await notifyAuditors(connection, {
      reviewId: auditCase.operational_review_id,
      auditCaseId: auditCase.audit_case_id,
      type: 'audit_correction_recheck',
      title: `Payment correction needs Auditor recheck · ${auditCase.case_number}`,
      message: summary,
    });
    return {
      reviewId: auditCase.operational_review_id,
      auditCaseId: auditCase.audit_case_id,
      status: 'pending_auditor_recheck',
    };
  }

  const review = await createOperationalReview(connection, {
    actor,
    actionKey: `payment.${action}`,
    department: 'accounting',
    projectId: project.lot_project_id,
    entityType: 'lot_project_payment',
    entityId: paymentId,
    entityLabel: `${existingPayment.lot_project_payment_reference_id || `Payment #${paymentId}`} — ${listing.lot_project_listing_unit_id}`,
    beforeSnapshot,
    afterSnapshot,
    headPreApprovedByUserId: authorization.headPreApprovedByUserId || null,
  });

  if (authorization.authorizationType === 'emergency_super_admin') {
    await notifySystemAdmins(connection, {
      reviewId: review.reviewId,
      type: 'super_admin_emergency_payment_correction',
      title: `Emergency owner payment correction · ${listing.lot_project_listing_unit_id}`,
      message: 'Super Admin used break-glass payment correction. The change is awaiting independent Auditor review.',
    });
  }

  return review;
};

const normalizePaymentRequestKey = (value) => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(clean)) {
    throw createHttpError(400, 'Invalid payment request key.');
  }
  return clean;
};

const getPaymentByRequestKey = async (connection, requestKey) => {
  if (!requestKey || !(await columnExists(connection, 'lot_project_payments', 'lot_project_payment_request_key'))) {
    return null;
  }

  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payments
      WHERE lot_project_payment_request_key = ?
      LIMIT 1
    `,
    [requestKey]
  );
  return rows[0] || null;
};

const getExactFullPaymentAmount = async (connection, listing) => {
  const [scheduleRows] = await connection.query(
    `
      SELECT s.*
      FROM lot_project_payment_schedules s
      WHERE s.lot_project_id = ?
        AND s.lot_project_listing_id = ?
        AND s.lot_project_client_profile_id = ?
        AND ${getLatestActiveScheduleGenerationPredicate('s')}
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
  );

  const [profileRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_client_profiles
      WHERE lot_project_client_profile_id = ?
      LIMIT 1
    `,
    [listing.lot_project_client_profile_id]
  );

  return getRemainingUnpaidScheduleBalance(
    scheduleRows,
    { ...(listing || {}), ...(profileRows[0] || {}) }
  );
};

const validateFullPaymentAmount = async (connection, listing, paymentType, amount) => {
  if (paymentType !== 'full_payment') return;

  const exactAmount = await getExactFullPaymentAmount(connection, listing);
  if (exactAmount <= 0.009) {
    throw createHttpError(400, 'This account has no remaining unpaid SOA balance.');
  }

  if (Math.abs(Number(amount || 0) - exactAmount) > 0.009) {
    throw createHttpError(
      400,
      `Full Payment amount must equal the current unpaid SOA balance of ${money(exactAmount)}.`
    );
  }
};

const validateBalloonPaymentAmount = async (
  connection,
  listing,
  paymentType,
  amount,
  excludePaymentId = 0
) => {
  if (paymentType !== 'balloon') return;

  const availablePrincipal = await getBalloonPrincipalCapacity(connection, listing, {
    excludePaymentId,
  });

  if (availablePrincipal <= 0.009) {
    throw createHttpError(400, 'There is no remaining financed principal available for a balloon payment.');
  }

  if (Number(amount || 0) - availablePrincipal > 0.009) {
    throw createHttpError(
      400,
      `Balloon Payment cannot exceed the remaining financed principal of ${money(availablePrincipal)}.`
    );
  }
};

const requirePenaltyManager = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) throw createHttpError(401, 'Authentication is required.');
  if (!['accounting_staff', 'accounting_head', 'system_admin', 'super_admin'].includes(String(user.role || ''))) {
    throw createHttpError(403, 'Penalty and Legal / Misc Fee adjustments are handled by Accounting.');
  }
  return user;
};

const ACCOUNTING_ADJUSTMENT_ENTITY = 'lot_project_penalty_schedule';
const ACCOUNTING_LMF_ENTITY = 'lot_project_lmf_schedule';

const authorizeAccountingAdjustment = async (connection, {
  req,
  actor,
  project,
  listing,
  actionKey,
  entityType,
  entityId,
  entityLabel,
  payload,
  reason,
}) => {
  if (!actor?.id) throw createHttpError(401, 'Authentication is required.');

  if (actor.role === 'accounting_head') {
    return { authorized: true, authorizationType: 'department_head', headPreApprovedByUserId: actor.id };
  }

  if (actor.role === 'system_admin') {
    const auditCase = await getPendingAuditCorrectionCase(connection, {
      auditCaseId: req.body.auditCaseId || req.body.audit_case_id,
      entityType,
      entityId,
      forUpdate: true,
    });
    if (!auditCase) {
      throw Object.assign(new Error('A valid Auditor-approved case is required for a System Admin adjustment.'), {
        statusCode: 409,
        code: 'AUDIT_CASE_REQUIRED',
      });
    }
    return {
      authorized: true,
      authorizationType: 'audit_case',
      auditCase,
      allowReviewId: auditCase.operational_review_id,
    };
  }

  if (isFullAccessAdministrator(actor)) {
    // Super Admin remains a break-glass fallback. It does not become the daily
    // approver; every emergency use is surfaced to System Admin + Auditor below.
    return { authorized: true, authorizationType: 'emergency_super_admin', headPreApprovedByUserId: actor.id };
  }

  if (actor.role !== 'accounting_staff') {
    throw createHttpError(403, 'Only Accounting Staff, Accounting Head, System Admin with a valid Audit Case, or emergency Super Admin can perform this adjustment.');
  }

  const approval = await createProtectedChangeRequest(connection, {
    actor,
    actionKey,
    department: 'accounting',
    projectId: project.lot_project_id,
    entityType,
    entityId,
    entityLabel,
    payload,
    reason,
  });

  if (approval.status !== 'approved') {
    return {
      authorized: false,
      approvalRequired: true,
      approvalRequestId: approval.requestId,
      requestNumber: approval.requestNumber,
      message: `${approval.requestNumber} was sent to the Accounting Head. After it is approved, submit the exact same change again.`,
    };
  }

  const consumed = await consumeProtectedChange(connection, {
    requestId: approval.requestId,
    actor,
    actionKey,
    entityType,
    entityId,
    payload,
  });
  return {
    authorized: true,
    authorizationType: 'head_approval',
    approvalRequestId: approval.requestId,
    headPreApprovedByUserId: consumed.reviewed_by_head_user_id,
  };
};

const completeAccountingAdjustmentReview = async (connection, {
  actor,
  project,
  listing,
  actionKey,
  entityType,
  entityId,
  entityLabel,
  beforeSnapshot,
  afterSnapshot,
  authorization,
}) => {
  if (authorization?.authorizationType === 'audit_case') {
    await advanceAuditCaseToRecheck(connection, {
      auditCase: authorization.auditCase,
      actor,
      afterSnapshot,
      correctionSummary: `${actionKey} corrected by System Admin after Auditor finding.`,
      notificationTitle: `Accounting correction needs Auditor recheck · ${authorization.auditCase.case_number}`,
    });
    return {
      reviewId: authorization.auditCase.operational_review_id,
      auditCaseId: authorization.auditCase.audit_case_id,
      status: 'pending_auditor_recheck',
    };
  }

  const review = await createOperationalReview(connection, {
    actor,
    actionKey,
    department: 'accounting',
    projectId: project.lot_project_id,
    entityType,
    entityId,
    entityLabel,
    beforeSnapshot,
    afterSnapshot,
    headPreApprovedByUserId: authorization?.headPreApprovedByUserId || null,
  });

  if (authorization?.authorizationType === 'emergency_super_admin') {
    await notifySystemAdmins(connection, {
      reviewId: review.reviewId,
      type: 'super_admin_emergency_adjustment',
      title: `Emergency Super Admin adjustment · ${entityLabel}`,
      message: `${actionKey} was performed using owner break-glass access and is awaiting independent Auditor review.`,
    });
  }
  return review;
};

const getPaymentLinkedPenaltyWaiver = async (connection, paymentId, { forUpdate = false } = {}) => {
  if (!Number(paymentId || 0)) return null;
  if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) return null;
  if (!(await columnExists(connection, 'lot_project_penalty_reliefs', 'lot_project_payment_id'))) return null;
  if (!(await columnExists(connection, 'lot_project_penalty_reliefs', 'effective_date'))) return null;

  const [rows] = await connection.query(
    `SELECT * FROM lot_project_penalty_reliefs
     WHERE lot_project_payment_id = ?
       AND relief_type IN ('full_waiver', 'partial_waiver')
     ORDER BY penalty_relief_id DESC
     LIMIT 1
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [Number(paymentId)]
  );
  return rows[0] || null;
};

const assertPaymentPenaltyWaiverSchema = async (connection) => {
  if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) {
    throw createHttpError(500, 'Penalty relief table is missing.');
  }
  const [hasPaymentId, hasEffectiveDate] = await Promise.all([
    columnExists(connection, 'lot_project_penalty_reliefs', 'lot_project_payment_id'),
    columnExists(connection, 'lot_project_penalty_reliefs', 'effective_date'),
  ]);
  if (!hasPaymentId || !hasEffectiveDate) {
    throw createHttpError(500, 'Payment-linked penalty waiver migration is missing. Run server/migrations/20260819_payment_penalty_waiver_effective_date.sql first.');
  }
};

const savePaymentLinkedPenaltyWaiver = async (connection, {
  project, listing, scheduleId, paymentId, effectiveDate, waiverAmount,
  reason, internalNotes, userId, existingRelief = null,
}) => {
  await assertPaymentPenaltyWaiverSchema(connection);
  const cleanAmount = roundMoneyValue(waiverAmount || 0);
  if (cleanAmount <= 0.009) throw createHttpError(400, 'There is no penalty to waive for this payment date.');

  const canReuseExisting = existingRelief && !['cancelled', 'restored'].includes(String(existingRelief.status || '').toLowerCase());
  if (canReuseExisting) {
    await connection.query(
      `UPDATE lot_project_penalty_reliefs
       SET lot_project_payment_schedule_id = ?, relief_type = 'full_waiver', effective_date = ?,
           relief_amount = ?, status = 'active', reason = ?, internal_notes = ?, approved_by_user_id = ?,
           cancelled_at = NULL, updated_at = NOW()
       WHERE penalty_relief_id = ? AND lot_project_id = ? AND lot_project_listing_id = ?
         AND lot_project_client_profile_id = ? AND lot_project_account_id = ?`,
      [scheduleId, effectiveDate, cleanAmount, reason, internalNotes, userId,
       existingRelief.penalty_relief_id, project.lot_project_id, listing.lot_project_listing_id,
       listing.lot_project_client_profile_id, listing.lot_project_account_id]
    );
    return Number(existingRelief.penalty_relief_id);
  }

  const [result] = await connection.query(
    `INSERT INTO lot_project_penalty_reliefs (
       lot_project_id, lot_project_listing_id, lot_project_client_profile_id, lot_project_account_id,
       lot_project_payment_schedule_id, lot_project_payment_id, relief_type, effective_date,
       relief_amount, status, reason, internal_notes, approved_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, 'full_waiver', ?, ?, 'active', ?, ?, ?)`,
    [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id,
     listing.lot_project_account_id, scheduleId, paymentId, effectiveDate, cleanAmount,
     reason, internalNotes, userId]
  );
  return Number(result.insertId || 0);
};

const cancelPaymentLinkedPenaltyWaiver = async (connection, existingRelief) => {
  if (!existingRelief || ['cancelled', 'restored'].includes(String(existingRelief.status || '').toLowerCase())) return;
  await connection.query(
    `UPDATE lot_project_penalty_reliefs SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE penalty_relief_id = ?`,
    [existingRelief.penalty_relief_id]
  );
};

const addDaysToDateOnly = (value, days = 0) => {
  const clean = dateOrNull(value);
  if (!clean) return null;
  const [year, month, day] = clean.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + Number(days || 0))).toISOString().slice(0, 10);
};

const getPenaltyReliefContext = async (connection, project, listing, scheduleId, asOfDate = todayDateOnly(), { forUpdate = false } = {}) => {
  if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) {
    throw createHttpError(500, 'Penalty relief table is missing. Run server/migrations/20260711_add_daily_penalty_reliefs.sql first.');
  }

  if (forUpdate) {
    // Use the same parent lock order as payment mutations so a payment,
    // cancellation, waiver, correction, or extension cannot mutate one buyer
    // account from different financial paths at the same time.
    const [listingLockRows] = await connection.query(
      `
        SELECT lot_project_listing_id
        FROM lot_project_listings
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [project.lot_project_id, listing.lot_project_listing_id]
    );
    if (!listingLockRows[0]) throw createHttpError(404, 'Listing not found.');

    await lockPaymentAccountForListing(connection, listing);
  }

  const [profileRows] = await connection.query(
    `SELECT * FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ? LIMIT 1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [listing.lot_project_client_profile_id]
  );
  const clientProfile = { ...(listing || {}), ...(profileRows[0] || {}) };
  if (!profileRows[0]) throw createHttpError(404, 'Buyer payment terms were not found.');

  if (forUpdate) {
    await lockPaymentSchedulesForListing(connection, listing);
  }

  const [scheduleRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_payment_schedule_id = ?
        AND lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
  );
  const schedule = scheduleRows[0];
  if (!schedule) throw createHttpError(404, 'SOA row was not found.');

  if (forUpdate) {
    // All penalty-relief mutations serialize through the SOA row, then lock
    // existing relief rows in a stable order before recomputing the snapshot.
    await connection.query(
      `
        SELECT penalty_relief_id
        FROM lot_project_penalty_reliefs
        WHERE lot_project_payment_schedule_id = ?
        ORDER BY penalty_relief_id
        FOR UPDATE
      `,
      [scheduleId]
    );
  }

  const snapshots = await getListingPenaltySnapshots(
    connection,
    project.lot_project_id,
    listing.lot_project_listing_id,
    clientProfile,
    [schedule],
    asOfDate
  );
  const snapshot = snapshots.get(Number(scheduleId));
  if (!snapshot) throw createHttpError(500, 'Penalty information could not be calculated.');

  return { clientProfile, schedule, snapshot };
};


const subtractDateOnlyDays = (dateText, days) => {
  const [year, month, day] = String(dateText).slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
};

export const getLotProjectListingPaymentPreflight = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!Number(listing.lot_project_account_id || 0)) {
      return res.status(409).json({ message: 'A current buyer account is required before recording a payment.' });
    }

    const today = todayDateOnly();
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const thirtyDaysAgo = subtractDateOnlyDays(today, 30);
    const recentStart = firstOfMonth < thirtyDaysAgo ? firstOfMonth : thirtyDaysAgo;
    const [recentRows] = await connection.query(
      `SELECT lot_project_payment_id, lot_project_payment_amount, lot_project_payment_type,
              lot_project_payment_method, lot_project_payment_reference_id, lot_project_payment_date
       FROM lot_project_payments
       WHERE lot_project_id = ?
         AND lot_project_listing_id = ?
         AND lot_project_account_id = ?
         AND lot_project_payment_status = 'Verified'
         AND lot_project_payment_date >= ?
       ORDER BY lot_project_payment_date DESC, lot_project_payment_id DESC`,
      [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_account_id, recentStart]
    );

    const latest = recentRows[0] || null;
    return res.json({
      success: true,
      data: {
        unitId: listing.lot_project_listing_unit_id,
        buyerName: listing.buyer_full_name || listing.buyer_name_snapshot || '-',
        projectName: project.lot_project_name || project.name || '-',
        accountReference: listing.account_reference || '-',
        accountId: Number(listing.lot_project_account_id),
        recentWindowStart: recentStart,
        recentPaymentCount: recentRows.length,
        hasRecentPayment: recentRows.length > 0,
        latestPayment: latest ? {
          paymentId: Number(latest.lot_project_payment_id),
          amount: Number(latest.lot_project_payment_amount || 0),
          type: getPaymentTypeLabel(latest.lot_project_payment_type),
          method: latest.lot_project_payment_method || '-',
          referenceId: latest.lot_project_payment_reference_id || '-',
          paymentDate: plainDate(latest.lot_project_payment_date),
        } : null,
      },
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const requestLotProjectPaymentCorrectionCode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const actor = req.authUser || await getAuthenticatedUser(req);
    if (!actor?.id) return res.status(401).json({ message: 'Authentication is required.' });
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const action = cleanPaymentCorrectionValue(req.body.action).toLowerCase();
    const reason = cleanPaymentCorrectionValue(req.body.reason);
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    await connection.beginTransaction();
    const listing = await getListingForPayment(connection, project, listingLookup, { forUpdate: true });
    if (!listing) throw createHttpError(404, 'Listing not found.');
    await lockPaymentAccountForListing(connection, listing);
    const existingPayment = await getPaymentById(connection, project, listing, paymentId, { forUpdate: true });
    if (!existingPayment) throw createHttpError(404, 'Payment not found.');
    if (existingPayment.lot_project_payment_status !== 'Verified') throw createHttpError(409, 'Only a verified payment can be corrected or voided.');

    const body = action === 'edit' && req.body.proposed && typeof req.body.proposed === 'object'
      ? req.body.proposed
      : req.body;
    const payload = buildPaymentCorrectionPayload({ action, actor, listing, existingPayment, body, reason });
    validatePaymentCorrectionRequest({ action, reason, payload });

    const [returnedRows] = await connection.query(
      `SELECT operational_review_id, review_number
       FROM operational_reviews
       WHERE entity_type='lot_project_payment'
         AND entity_id=?
         AND initiated_by_user_id=?
         AND status='returned_for_correction'
       ORDER BY operational_review_id DESC
       LIMIT 1 FOR UPDATE`,
      [String(existingPayment.lot_project_payment_id), actor.id]
    );
    if (returnedRows[0]) {
      await connection.commit();
      return res.json({
        success: true,
        message: `${returnedRows[0].review_number} was returned to you for correction. The corrected payment will go back to Accounting Head review.`,
        data: {
          directCorrection: true,
          authorizationType: 'returned_review',
          reviewId: Number(returnedRows[0].operational_review_id),
          status: 'approved',
        },
      });
    }

    if (actor.role === 'system_admin') {
      const auditCaseId = Number(req.body.auditCaseId || req.body.audit_case_id || 0);
      if (!auditCaseId) throw createHttpError(409, 'A valid Auditor-approved Audit Case is required for System Admin payment correction.');
      const [caseRows] = await connection.query(
        `SELECT c.audit_case_id, c.case_number, c.status, r.entity_type, r.entity_id
         FROM audit_cases c
         INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id
         WHERE c.audit_case_id=?
         LIMIT 1 FOR UPDATE`,
        [auditCaseId]
      );
      const auditCase = caseRows[0];
      if (
        !auditCase ||
        auditCase.status !== 'pending_system_admin_correction' ||
        auditCase.entity_type !== 'lot_project_payment' ||
        String(auditCase.entity_id) !== String(existingPayment.lot_project_payment_id)
      ) {
        throw createHttpError(409, 'This Audit Case does not authorize correction of this payment.');
      }
      await connection.commit();
      return res.json({
        success: true,
        message: `${auditCase.case_number} authorizes this controlled System Admin correction.`,
        data: {
          directCorrection: true,
          authorizationType: 'audit_case',
          auditCaseId,
          caseNumber: auditCase.case_number,
          status: 'approved',
        },
      });
    }

    if (actor.role === 'accounting_head') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Accounting Head can apply the correction directly when the payment is not locked. The saved change will go to Auditor review.',
        data: { directHeadApproval: true, authorizationType: 'department_head', status: 'approved' },
      });
    }

    if (actor.role !== 'super_admin') {
      throw createHttpError(409, 'Accounting Staff can correct this payment only after the Accounting Head returns its review for correction.');
    }

    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      throw createHttpError(500, 'Sensitive-action verification table is missing. Apply the latest database schema first.');
    }
    if (!actor.email) throw createHttpError(400, 'Super Admin email is required for emergency verification.');
    const password = String(req.body?.password || '');
    if (!password) throw createHttpError(400, 'Super Admin password is required for emergency verification.');
    if (!actor.password_hash || !(await bcrypt.compare(password, actor.password_hash))) {
      throw createHttpError(401, 'Super Admin password is incorrect.');
    }

    const { verificationId, code } = await createSensitiveActionVerification(connection, {
      userId: actor.id,
      actionType: PAYMENT_CORRECTION_ACTION,
      entityType: PAYMENT_CORRECTION_ENTITY,
      entityId: existingPayment.lot_project_payment_id,
      payload,
      reason,
      requestIp: getSensitiveActionRequestIp(req),
    });
    await sendPaymentCorrectionCodeEmail({ actor, code, action, listing, payment: existingPayment, payload });
    await connection.commit();
    return res.json({
      success: true,
      message: `Emergency verification code sent to ${maskSensitiveActionEmail(actor.email)}.`,
      data: {
        verificationId,
        maskedEmail: maskSensitiveActionEmail(actor.email),
        expiresInMinutes: SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
        emergency: true,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const previewLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || todayDateOnly();
    if (paymentDate > todayDateOnly()) {
      return res.status(400).json({ message: 'Future payment dates are blocked.' });
    }

    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type);
    const requestedScheduleId = req.body.soaRowId ?? req.body.paymentScheduleId ?? req.body.lot_project_payment_schedule_id;
    const scheduleId = paymentType === 'full_payment' || paymentType === 'balloon'
      ? null
      : toNullableNumber(requestedScheduleId);
    const excludePaymentId = Number(req.body.excludePaymentId || req.body.paymentId || 0);

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!listing.lot_project_client_profile_id) {
      return res.status(400).json({ message: 'This listing has no buyer profile yet.' });
    }

    const linkedPenaltyWaiver = excludePaymentId
      ? await getPaymentLinkedPenaltyWaiver(connection, excludePaymentId)
      : null;

    const [profileRows] = await connection.query(
      `SELECT * FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ? LIMIT 1`,
      [listing.lot_project_client_profile_id]
    );
    const clientProfile = { ...(listing || {}), ...(profileRows[0] || {}) };
    const scheduleRows = await getExistingSoaScheduleRows(
      connection,
      project.lot_project_id,
      listing.lot_project_listing_id,
      listing.lot_project_client_profile_id,
      listing.lot_project_account_id
    );

    const snapshots = await getListingPenaltySnapshots(
      connection,
      project.lot_project_id,
      listing.lot_project_listing_id,
      clientProfile,
      scheduleRows,
      paymentDate,
      { excludePaymentId, excludePenaltyReliefId: Number(linkedPenaltyWaiver?.penalty_relief_id || 0) }
    );

    const summarizeRow = (row) => {
      const rowId = Number(row.lot_project_payment_schedule_id || 0);
      const snapshot = snapshots.get(rowId) || {};
      const unpaidBase = roundMoneyValue(Math.max(Number(snapshot.unpaidBaseAmount || 0), 0));
      const baseDue = roundMoneyValue(Math.max(Number(snapshot.baseDueAmount || 0), 0));
      const scheduledInterest = roundMoneyValue(Math.max(Number(row.interest_amount || 0), 0));
      const basePaid = roundMoneyValue(Math.max(baseDue - unpaidBase, 0));
      const interestPaid = roundMoneyValue(Math.min(basePaid, scheduledInterest));
      const interestOutstanding = roundMoneyValue(Math.max(scheduledInterest - interestPaid, 0));
      const principalOutstanding = roundMoneyValue(Math.max(unpaidBase - interestOutstanding, 0));
      const penaltyOutstanding = roundMoneyValue(Math.max(Number(snapshot.outstandingPenaltyAmount || 0), 0));

      return {
        scheduleId: rowId,
        description: row.description || '-',
        dueDate: plainDate(row.due_date, null),
        principalOutstanding,
        interestOutstanding,
        baseOutstanding: unpaidBase,
        penaltyOutstanding,
        totalPayable: roundMoneyValue(unpaidBase + penaltyOutstanding),
        penaltyDays: Number(snapshot.penaltyDays || 0),
        penaltyStartDate: snapshot.penaltyStartDate || null,
        penaltyCalculatedThrough: snapshot.penaltyCalculatedThrough || paymentDate,
        penaltyRatePercent: Number(snapshot.ratePercent || 0),
        penaltyGraceDays: Number(snapshot.graceDays || 0),
      };
    };

    const activeSummaries = scheduleRows
      .filter((row) => String(row.schedule_status || '').toLowerCase() !== 'cancelled')
      .map(summarizeRow);
    const fullSummary = activeSummaries.reduce((summary, row) => ({
      principalOutstanding: roundMoneyValue(summary.principalOutstanding + Number(row.principalOutstanding || 0)),
      interestOutstanding: roundMoneyValue(summary.interestOutstanding + Number(row.interestOutstanding || 0)),
      penaltyOutstanding: roundMoneyValue(summary.penaltyOutstanding + Number(row.penaltyOutstanding || 0)),
      totalPayable: roundMoneyValue(summary.totalPayable + Number(row.totalPayable || 0)),
    }), { principalOutstanding: 0, interestOutstanding: 0, penaltyOutstanding: 0, totalPayable: 0 });
    const fullPaymentAmount = fullSummary.totalPayable;
    const selectedRow = scheduleId
      ? activeSummaries.find((row) => Number(row.scheduleId) === Number(scheduleId)) || null
      : null;

    if (scheduleId && !selectedRow) {
      return res.status(404).json({ message: 'The selected SOA row is not available.' });
    }

    const balloonPrincipalCapacity = paymentType === 'balloon'
      ? await getBalloonPrincipalCapacity(connection, listing, { excludePaymentId })
      : 0;

    return res.json({
      success: true,
      paymentDate,
      paymentType: getPaymentTypeLabel(paymentType),
      selectedRow,
      fullSummary,
      fullPaymentAmount,
      balloonPrincipalCapacity: roundMoneyValue(balloonPrincipalCapacity),
      linkedPenaltyWaiver: linkedPenaltyWaiver ? {
        penaltyReliefId: Number(linkedPenaltyWaiver.penalty_relief_id || 0),
        reliefAmount: Number(linkedPenaltyWaiver.relief_amount || 0),
        effectiveDate: plainDate(linkedPenaltyWaiver.effective_date || linkedPenaltyWaiver.created_at),
        reason: linkedPenaltyWaiver.reason || '',
        internalNotes: linkedPenaltyWaiver.internal_notes || '',
        status: linkedPenaltyWaiver.status || 'active',
      } : null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createLotProjectListingPayment = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const amount = parseMoneyValue(req.body.amount);
    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || todayDateOnly();
    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type);
    const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method);
    const bankName = paymentMethod === 'Cash'
      ? null
      : toNullable(req.body.bankName || req.body.bank_name || req.body.paymentBank || req.body.payment_bank);
    const accountNumber = paymentMethod === 'Cash'
      ? null
      : toNullable(req.body.accountNumber || req.body.account_number || req.body.accountNo || req.body.account_no);
    const requestedScheduleId = req.body.soaRowId ?? req.body.paymentScheduleId ?? req.body.lot_project_payment_schedule_id;
    const scheduleId = paymentType === 'full_payment' || paymentType === 'balloon'
      ? null
      : toNullableNumber(requestedScheduleId);
    const requestKey = normalizePaymentRequestKey(
      req.body.requestKey || req.body.request_key || req.get?.('Idempotency-Key')
    );
    const penaltyHandling = String(req.body.penaltyHandling || req.body.penalty_handling || 'apply').trim().toLowerCase();
    const penaltyWaiverReason = String(req.body.penaltyWaiverReason || req.body.penalty_waiver_reason || '').trim();
    const penaltyWaiverInternalNotes = toNullable(req.body.penaltyWaiverInternalNotes || req.body.penalty_waiver_internal_notes);

    if (!['apply', 'waive'].includes(penaltyHandling)) return res.status(400).json({ message: 'Penalty handling must be apply or waive.' });
    if (penaltyHandling === 'waive' && !scheduleId) return res.status(400).json({ message: 'A specific SOA row is required to waive a payment penalty.' });
    if (penaltyHandling === 'waive' && !penaltyWaiverReason) return res.status(400).json({ message: 'Reason is required when waiving the penalty for a payment.' });

    if (paymentDate > todayDateOnly()) return res.status(400).json({ message: 'Future payment dates are blocked.' });
    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });
    if (paymentMethod !== 'Cash' && !bankName) {
      return res.status(400).json({ message: 'Bank / payment provider is required for non-cash payments.' });
    }
    if (paymentMethod !== 'Cash' && !accountNumber) {
      return res.status(400).json({ message: 'Account No. / wallet number is required for non-cash payments.' });
    }

    const requestedReferenceId = paymentMethod === 'Cash'
      ? null
      : toNullable(req.body.referenceId || req.body.reference_id);
    if (paymentMethod !== 'Cash' && !requestedReferenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    const result = await runTransactionWithRetry(db, async (connection) => {
      if (!(await tableExists(connection, 'lot_project_payments'))) {
        throw createHttpError(500, 'lot_project_payments table does not exist.');
      }

      const listing = await getListingForPayment(connection, project, listingLookup, { forUpdate: true });
      if (!listing) throw createHttpError(404, 'Listing not found.');
      await lockPaymentAccountForListing(connection, listing);
      if (!listing.lot_project_client_profile_id) {
        throw createHttpError(400, 'This listing has no buyer profile yet.');
      }

      // Lock the full active SOA set in one stable order before reading balances.
      const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
      if (hasSchedules) await lockPaymentSchedulesForListing(connection, listing);
      const allowCrossTypeOverflow = hasSchedules
        ? await hasCrossTypePaymentAllocations(connection, listing)
        : false;
      let paymentPenaltyWaiverAmount = 0;
      let penaltyWaiverAuthorization = null;

      const existingRequest = await getPaymentByRequestKey(connection, requestKey);
      if (existingRequest) {
        const existingRequestPenaltyWaiver = await getPaymentLinkedPenaltyWaiver(connection, existingRequest.lot_project_payment_id);
        const existingPenaltyHandling = existingRequestPenaltyWaiver &&
          !['cancelled', 'restored'].includes(String(existingRequestPenaltyWaiver.status || '').toLowerCase())
          ? 'waive'
          : 'apply';
        const belongsToSameAccount =
          Number(existingRequest.lot_project_id) === Number(project.lot_project_id) &&
          Number(existingRequest.lot_project_listing_id) === Number(listing.lot_project_listing_id) &&
          Number(existingRequest.lot_project_account_id || 0) === Number(listing.lot_project_account_id || 0);
        const samePaymentRequest =
          belongsToSameAccount &&
          existingRequest.lot_project_payment_status === 'Verified' &&
          Math.abs(Number(existingRequest.lot_project_payment_amount || 0) - Number(amount || 0)) <= 0.009 &&
          plainDate(existingRequest.lot_project_payment_date) === paymentDate &&
          String(existingRequest.lot_project_payment_type || '') === paymentType &&
          String(existingRequest.lot_project_payment_method || '') === paymentMethod &&
          Number(existingRequest.lot_project_payment_schedule_id || 0) === Number(scheduleId || 0) &&
          existingPenaltyHandling === penaltyHandling;

        if (!samePaymentRequest) {
          throw createHttpError(409, 'This payment request key was already used for a different payment request.');
        }

        return {
          paymentId: existingRequest.lot_project_payment_id,
          referenceId: existingRequest.lot_project_payment_reference_id,
          storageCode: existingRequest.lot_project_payment_storage_code || createPaymentStorageCode(existingRequest.lot_project_payment_id, existingRequest.lot_project_payment_created_at),
          idempotentReplay: true,
          penaltyWaivedAmount: existingPenaltyHandling === 'waive' ? Number(existingRequestPenaltyWaiver?.relief_amount || 0) : 0,
          unitId: listing.lot_project_listing_unit_id,
          buyerName: listing.buyer_full_name || null,
          amount: Number(existingRequest.lot_project_payment_amount || 0),
          paymentDate: plainDate(existingRequest.lot_project_payment_date),
          paymentType: existingRequest.lot_project_payment_type,
          paymentMethod: existingRequest.lot_project_payment_method,
          bankName: existingRequest.lot_project_payment_bank_name,
          accountNumber: existingRequest.lot_project_payment_account_number,
        };
      }

      if (hasSchedules) {
        await recomputeListingScheduleBalances(connection, listing);
        await refreshListingPenaltyCache(connection, listing, paymentDate);
        await recomputeListingScheduleBalances(connection, listing);
        await validateFullPaymentAmount(connection, listing, paymentType, amount);
        await validateBalloonPaymentAmount(connection, listing, paymentType, amount);
        if (penaltyHandling === 'waive') {
          await assertPaymentPenaltyWaiverSchema(connection);
          const { snapshot } = await getPenaltyReliefContext(connection, project, listing, scheduleId, paymentDate, { forUpdate: true });
          paymentPenaltyWaiverAmount = roundMoneyValue(snapshot.outstandingPenaltyAmount || 0);
          if (paymentPenaltyWaiverAmount <= 0.009) throw createHttpError(400, 'There is no calculated penalty to waive for this payment date.');

          const waiverPayload = {
            amount, paymentDate, paymentType, paymentMethod, bankName, accountNumber,
            requestedReferenceId, scheduleId, penaltyHandling,
            penaltyWaiverAmount: paymentPenaltyWaiverAmount,
            penaltyWaiverReason,
            penaltyWaiverInternalNotes,
          };
          penaltyWaiverAuthorization = await authorizeAccountingAdjustment(connection, {
            req,
            actor: user,
            project,
            listing,
            actionKey: 'payment.create_with_penalty_waiver',
            entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
            entityId: scheduleId,
            entityLabel: `Payment penalty waiver · ${listing.lot_project_listing_unit_id}`,
            payload: waiverPayload,
            reason: penaltyWaiverReason,
          });
          if (!penaltyWaiverAuthorization.authorized) {
            return {
              approvalRequired: true,
              approvalRequestId: penaltyWaiverAuthorization.approvalRequestId,
              requestNumber: penaltyWaiverAuthorization.requestNumber,
              approvalMessage: penaltyWaiverAuthorization.message,
            };
          }
          await assertEntityNotReviewLocked(connection, { actor: req.authUser,
            entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
            entityId: scheduleId,
            allowReviewId: penaltyWaiverAuthorization.allowReviewId || null,
          });
        }
      }

      const hasRequestKeyColumn = await columnExists(
        connection,
        'lot_project_payments',
        'lot_project_payment_request_key'
      );

      const paymentColumns = [
        'lot_project_id',
        'lot_project_listing_id',
        'lot_project_client_profile_id',
        'lot_project_account_id',
        'lot_project_payment_schedule_id',
        'lot_project_payment_type',
        'lot_project_payment_method',
        'lot_project_payment_bank_name',
        'lot_project_payment_account_number',
        'lot_project_payment_amount',
        'lot_project_payment_date',
        'lot_project_payment_reference_id',
        'lot_project_payment_status',
        'lot_project_payment_verified_by_user_id',
        'lot_project_payment_verified_at',
      ];
      const paymentValues = [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        paymentType,
        paymentMethod,
        bankName,
        accountNumber,
        amount,
        paymentDate,
        requestedReferenceId,
        'Verified',
        user?.id || null,
      ];
      const valueSql = [
        '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', 'NOW()',
      ];

      if (hasRequestKeyColumn) {
        paymentColumns.push('lot_project_payment_request_key');
        paymentValues.push(requestKey);
        valueSql.push('?');
      }

      const [paymentResult] = await connection.query(
        `
          INSERT INTO lot_project_payments (${paymentColumns.join(', ')})
          VALUES (${valueSql.join(', ')})
        `,
        paymentValues
      );

      const paymentId = paymentResult.insertId;
      const storageCode = createPaymentStorageCode(paymentId, new Date());
      if (await columnExists(connection, 'lot_project_payments', 'lot_project_payment_storage_code')) {
        await connection.query(
          `UPDATE lot_project_payments SET lot_project_payment_storage_code = ? WHERE lot_project_payment_id = ?`,
          [storageCode, paymentId]
        );
      }
      const referenceId = paymentMethod === 'Cash'
        ? await getNextCashReference(
            connection,
            listing.lot_project_listing_unit_id,
            paymentId
          )
        : requestedReferenceId;

      if (paymentMethod === 'Cash') {
        await connection.query(
          `
            UPDATE lot_project_payments
            SET lot_project_payment_reference_id = ?
            WHERE lot_project_payment_id = ?
          `,
          [referenceId, paymentId]
        );
      }

      let paymentPenaltyReliefId = null;
      if (penaltyHandling === 'waive') {
        paymentPenaltyReliefId = await savePaymentLinkedPenaltyWaiver(connection, {
          project, listing, scheduleId, paymentId, effectiveDate: paymentDate,
          waiverAmount: paymentPenaltyWaiverAmount, reason: penaltyWaiverReason,
          internalNotes: penaltyWaiverInternalNotes, userId: user?.id || null,
        });
      }

      await connection.query(
        `
          INSERT INTO lot_project_payment_logs (
            lot_project_payment_id,
            action_type,
            action_description,
            action_by_user_id
          ) VALUES (?, 'created', ?, ?)
        `,
        [paymentId, `${getPaymentTypeLabel(paymentType)} payment created and verified for ${listing.lot_project_listing_unit_id}.`, user?.id || null]
      );

      if (hasSchedules) {
        await rebuildListingPaymentAllocationsChronologically(connection, listing, { finalAsOfDate: todayDateOnly(), allowCrossTypeOverflow, relinkPrimarySchedule: true });
      }

      await syncCommissionProgressForListing(connection, listing);

      await writeAuditLog(connection, req, {
        action: 'create',
        module: 'Payments',
        entityType: 'lot_project_payment',
        entityId: String(paymentId),
        entityLabel: `${referenceId || `Payment #${paymentId}`} — ${listing.buyer_full_name || listing.lot_project_listing_unit_id}`,
        title: 'Recorded SOA payment',
        description: `Recorded ${getPaymentTypeLabel(paymentType)} payment for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
        metadata: {
          listingId: listing.lot_project_listing_id,
          unitId: listing.lot_project_listing_unit_id,
          clientName: listing.buyer_full_name || null,
          amount,
          paymentDate,
          paymentType,
          paymentMethod,
          bankName,
          accountNumber,
          referenceId,
          storageCode,
          scheduleId,
          penaltyHandling,
          penaltyWaiverAmount: paymentPenaltyWaiverAmount,
          paymentPenaltyReliefId,
          penaltyWaiverReason: penaltyWaiverReason || null,
        },
      });

      const operationalReview = await createOperationalReview(connection, {
        actor: user,
        actionKey: 'payment.create',
        department: 'accounting',
        projectId: project.lot_project_id,
        entityType: 'lot_project_payment',
        entityId: paymentId,
        entityLabel: `${referenceId || `Payment #${paymentId}`} — ${listing.lot_project_listing_unit_id}`,
        afterSnapshot: {
          paymentId, referenceId, amount, paymentDate, paymentType, paymentMethod,
          bankName, accountNumber, scheduleId, listingId: listing.lot_project_listing_id,
          projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id,
          buyerName: listing.buyer_full_name || null,
        },
        headPreApprovedByUserId: penaltyWaiverAuthorization?.headPreApprovedByUserId || null,
      });
      if (penaltyWaiverAuthorization?.authorizationType === 'emergency_super_admin') {
        await notifySystemAdmins(connection, {
          reviewId: operationalReview.reviewId,
          type: 'super_admin_emergency_adjustment',
          title: `Emergency Super Admin payment waiver · ${listing.lot_project_listing_unit_id}`,
          message: 'A payment was recorded with a penalty waiver using owner break-glass access and is awaiting Auditor review.',
        });
      }

      return {
        paymentId, referenceId, storageCode, idempotentReplay: false, penaltyWaivedAmount: paymentPenaltyWaiverAmount,
        unitId: listing.lot_project_listing_unit_id,
        buyerName: listing.buyer_full_name || null,
        amount, paymentDate, paymentType, paymentMethod, bankName, accountNumber,
        operationalReview,
      };
    });

    if (result.approvalRequired) {
      return res.status(202).json({
        success: false,
        approval_required: true,
        approval_request_id: result.approvalRequestId,
        request_number: result.requestNumber,
        message: result.approvalMessage,
      });
    }

    const paymentNotification = result.idempotentReplay
      ? { enabled: false, sent: false, reason: 'idempotent_replay' }
      : await sendPaymentEntryCompanyNotification({ req, user, project, payment: result });
    const notificationWarning = paymentNotification?.warning || '';

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      message: result.idempotentReplay
        ? 'This payment was already saved. The existing verified payment was returned.'
        : `${getPaymentTypeLabel(paymentType)} payment saved and verified successfully.${notificationWarning ? ` ${notificationWarning}` : ''}`,
      payment_id: result.paymentId,
      reference_id: result.referenceId,
      storage_code: result.storageCode,
      idempotent_replay: result.idempotentReplay,
      penalty_waived_amount: Number(result.penaltyWaivedAmount || 0),
      payment_notification: paymentNotification,
      review: result.operationalReview || null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const updateLotProjectListingPayment = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const result = await runTransactionWithRetry(db, async (connection) => {
      const listing = await getListingForPayment(connection, project, listingLookup, { forUpdate: true });
      if (!listing) throw createHttpError(404, 'Listing not found.');
      await lockPaymentAccountForListing(connection, listing);

      const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
      if (hasSchedules) await lockPaymentSchedulesForListing(connection, listing);
      const allowCrossTypeOverflow = hasSchedules
        ? await hasCrossTypePaymentAllocations(connection, listing)
        : false;

      const existingPayment = await getPaymentById(connection, project, listing, paymentId, { forUpdate: true });
      if (!existingPayment) throw createHttpError(404, 'Payment not found.');
      if (existingPayment.lot_project_payment_status !== 'Verified') {
        throw createHttpError(409, 'Only a verified payment can be edited.');
      }
      const correctionAuthorization = await requirePaymentCorrectionVerification(connection, req, {
        action: 'edit',
        listing,
        existingPayment,
      });
      if (!correctionAuthorization.ok) return { authorizationError: correctionAuthorization };
      await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: 'lot_project_payment', entityId: paymentId, allowReviewId: correctionAuthorization.allowReviewId || null });
      const existingPaymentPenaltyWaiver = await getPaymentLinkedPenaltyWaiver(connection, paymentId, { forUpdate: true });

      const amount = parseMoneyValue(req.body.amount);
      const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || plainDate(existingPayment.lot_project_payment_date);
      const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type || existingPayment.lot_project_payment_type);
      const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method || existingPayment.lot_project_payment_method);
      const bankName = paymentMethod === 'Cash'
        ? null
        : toNullable(
            req.body.bankName ||
            req.body.bank_name ||
            req.body.paymentBank ||
            req.body.payment_bank ||
            existingPayment.lot_project_payment_bank_name
          );
      const accountNumber = paymentMethod === 'Cash'
        ? null
        : toNullable(
            req.body.accountNumber ||
            req.body.account_number ||
            req.body.accountNo ||
            req.body.account_no ||
            existingPayment.lot_project_payment_account_number
          );
      const requestedScheduleId = req.body.soaRowId ?? req.body.paymentScheduleId ?? req.body.lot_project_payment_schedule_id;
      const scheduleId = paymentType === 'full_payment' || paymentType === 'balloon'
        ? null
        : toNullableNumber(requestedScheduleId ?? existingPayment.lot_project_payment_schedule_id);
      const penaltyHandling = String(req.body.penaltyHandling || req.body.penalty_handling || 'apply').trim().toLowerCase();
      const penaltyWaiverReason = String(req.body.penaltyWaiverReason || req.body.penalty_waiver_reason || '').trim();
      const penaltyWaiverInternalNotes = toNullable(req.body.penaltyWaiverInternalNotes || req.body.penalty_waiver_internal_notes);
      if (!['apply', 'waive'].includes(penaltyHandling)) throw createHttpError(400, 'Penalty handling must be apply or waive.');
      if (penaltyHandling === 'waive' && !scheduleId) throw createHttpError(400, 'A specific SOA row is required to waive a payment penalty.');
      if (penaltyHandling === 'waive' && !penaltyWaiverReason) throw createHttpError(400, 'Reason is required when waiving the penalty for a payment.');

      if (paymentDate > todayDateOnly()) throw createHttpError(400, 'Future payment dates are blocked.');
      if (amount <= 0) throw createHttpError(400, 'Payment amount must be greater than 0.');

      const referenceId = paymentMethod === 'Cash'
        ? (
            existingPayment.lot_project_payment_method === 'Cash' && existingPayment.lot_project_payment_reference_id
              ? existingPayment.lot_project_payment_reference_id
              : await getNextCashReference(
                  connection,
                  listing.lot_project_listing_unit_id,
                  paymentId
                )
          )
        : toNullable(req.body.referenceId || req.body.reference_id);

      if (paymentMethod !== 'Cash' && !bankName) {
        throw createHttpError(400, 'Bank / payment provider is required for non-cash payments.');
      }
      if (paymentMethod !== 'Cash' && !accountNumber) {
        throw createHttpError(400, 'Account No. / wallet number is required for non-cash payments.');
      }
      if (paymentMethod !== 'Cash' && !referenceId) {
        throw createHttpError(400, 'Reference ID is required for non-cash payments.');
      }

      // Remove the linked waiver from the live calculation first. The transaction
      // will either keep it cancelled (Apply Penalty) or reactivate/update it below (Waive Penalty).
      if (existingPaymentPenaltyWaiver) {
        await cancelPaymentLinkedPenaltyWaiver(connection, existingPaymentPenaltyWaiver);
      }

      await reversePaymentAllocations(connection, listing, paymentId);
      let paymentPenaltyWaiverAmount = 0;
      if (hasSchedules) {
        const [profileRows] = await connection.query(`SELECT * FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ? LIMIT 1`, [listing.lot_project_client_profile_id]);
        const clientProfile = { ...(listing || {}), ...(profileRows[0] || {}) };
        const scheduleRows = await getExistingSoaScheduleRows(connection, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id, listing.lot_project_account_id);
        const snapshots = await getListingPenaltySnapshots(connection, project.lot_project_id, listing.lot_project_listing_id, clientProfile, scheduleRows, paymentDate, {
          excludePaymentId: paymentId,
          excludePenaltyReliefId: Number(existingPaymentPenaltyWaiver?.penalty_relief_id || 0),
        });
        const targetSnapshot = scheduleId ? snapshots.get(Number(scheduleId)) : null;
        paymentPenaltyWaiverAmount = roundMoneyValue(targetSnapshot?.outstandingPenaltyAmount || 0);
        await refreshListingPenaltyCache(connection, listing, paymentDate);
        await validateFullPaymentAmount(connection, listing, paymentType, amount);
        await validateBalloonPaymentAmount(connection, listing, paymentType, amount, paymentId);
        if (penaltyHandling === 'waive' && paymentPenaltyWaiverAmount <= 0.009) throw createHttpError(400, 'There is no calculated penalty to waive for this payment date.');
      }

      const [updateResult] = await connection.query(
        `
          UPDATE lot_project_payments
          SET lot_project_payment_schedule_id = ?,
              lot_project_payment_type = ?,
              lot_project_payment_method = ?,
              lot_project_payment_bank_name = ?,
              lot_project_payment_account_number = ?,
              lot_project_payment_amount = ?,
              lot_project_payment_date = ?,
              lot_project_payment_reference_id = ?,
              lot_project_payment_status = 'Verified',
              lot_project_payment_verified_by_user_id = ?,
              lot_project_payment_verified_at = NOW()
          WHERE lot_project_payment_id = ?
            AND lot_project_id = ?
            AND lot_project_listing_id = ?
            AND lot_project_client_profile_id = ?
            AND lot_project_account_id = ?
        `,
        [
          scheduleId,
          paymentType,
          paymentMethod,
          bankName,
          accountNumber,
          amount,
          paymentDate,
          referenceId,
          user?.id || null,
          paymentId,
          project.lot_project_id,
          listing.lot_project_listing_id,
          listing.lot_project_client_profile_id,
          listing.lot_project_account_id,
        ]
      );

      if (!Number(updateResult?.affectedRows || 0)) {
        throw createHttpError(409, 'Payment changed before it could be updated. Please refresh and try again.');
      }

      let paymentPenaltyReliefId = Number(existingPaymentPenaltyWaiver?.penalty_relief_id || 0) || null;
      if (penaltyHandling === 'waive') {
        paymentPenaltyReliefId = await savePaymentLinkedPenaltyWaiver(connection, {
          project, listing, scheduleId, paymentId, effectiveDate: paymentDate,
          waiverAmount: paymentPenaltyWaiverAmount, reason: penaltyWaiverReason,
          internalNotes: penaltyWaiverInternalNotes, userId: user?.id || null,
          existingRelief: existingPaymentPenaltyWaiver,
        });
      }

      await connection.query(
        `
          INSERT INTO lot_project_payment_logs (
            lot_project_payment_id,
            action_type,
            action_description,
            action_by_user_id
          ) VALUES (?, 'updated', ?, ?)
        `,
        [paymentId, `${getPaymentTypeLabel(paymentType)} payment updated by ${getUserFullName(user)}.`, user?.id || null]
      );

      if (hasSchedules) {
        await rebuildListingPaymentAllocationsChronologically(connection, listing, { finalAsOfDate: todayDateOnly(), allowCrossTypeOverflow, relinkPrimarySchedule: true });
      }

      await syncCommissionProgressForListing(connection, listing);

      await writeAuditLog(connection, req, {
        action: 'correct',
        module: 'Payments',
        entityType: 'lot_project_payment',
        entityId: String(paymentId),
        entityLabel: `${referenceId || existingPayment.lot_project_payment_reference_id || `Payment #${paymentId}`} — ${listing.buyer_full_name || listing.lot_project_listing_unit_id}`,
        title: 'Corrected verified payment',
        description: `An authorized user corrected a verified payment for ${listing.buyer_full_name || listing.lot_project_listing_unit_id} through the governed correction workflow.`,
        metadata: {
          listingId: listing.lot_project_listing_id,
          unitId: listing.lot_project_listing_unit_id,
          accountId: listing.lot_project_account_id,
          authorizationType: correctionAuthorization.authorizationType,
          verificationId: correctionAuthorization.verificationId || null,
          approvalRequestId: correctionAuthorization.approvalRequestId || null,
          auditCaseId: correctionAuthorization.auditCase?.audit_case_id || null,
          reason: correctionAuthorization.reason,
          before: {
            amount: Number(existingPayment.lot_project_payment_amount || 0),
            paymentDate: plainDate(existingPayment.lot_project_payment_date),
            paymentType: existingPayment.lot_project_payment_type,
            paymentMethod: existingPayment.lot_project_payment_method,
            referenceId: existingPayment.lot_project_payment_reference_id,
            scheduleId: existingPayment.lot_project_payment_schedule_id,
          },
          after: {
            amount,
            paymentDate,
            paymentType,
            paymentMethod,
            referenceId,
            scheduleId,
          },
        },
      });

      const workflowReview = await completePaymentCorrectionWorkflow(connection, {
        req, actor: user, project, listing, existingPayment, paymentId, action: 'edit', authorization: correctionAuthorization,
        afterSnapshot: { amount, paymentDate, paymentType, paymentMethod, referenceId, scheduleId, status: 'Verified', listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id },
      });

      return { paymentId, referenceId, paymentType, penaltyHandling,
        penaltyWaivedAmount: penaltyHandling === 'waive' ? paymentPenaltyWaiverAmount : 0,
        paymentPenaltyReliefId, workflowReview };
    });

    if (result.authorizationError) {
      return res.status(result.authorizationError.statusCode || 400).json({ message: result.authorizationError.message });
    }

    return res.json({
      success: true,
      message: `${getPaymentTypeLabel(result.paymentType)} payment updated successfully.`,
      payment_id: result.paymentId,
      reference_id: result.referenceId,
      penalty_waived_amount: Number(result.penaltyWaivedAmount || 0),
      review: result.workflowReview || null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const updateLotProjectListingSoaTerms = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!user) return res.status(401).json({ message: 'Please login before updating SOA terms.' });
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const lookup = getListingLookupWhere(listingLookup);

    const [listingRows] = await connection.query(
      `
        SELECT l.*, account.lot_project_account_id, account.account_reference, account.account_status, cp.*
        FROM lot_project_listings l
        INNER JOIN lot_project_accounts account
          ON account.lot_project_account_id = l.current_account_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Reserved listing not found.' });

    const paymentCount = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM lot_project_payments
            WHERE lot_project_id = ?
              AND lot_project_listing_id = ?
              AND lot_project_client_profile_id = ?
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
        ))[0][0]?.total
      : 0;

    const dpDiscountPercentage = Number(req.body.dpDiscountPercentage ?? req.body.soa_dp_discount_percentage ?? listing.soa_dp_discount_percentage ?? 0);
    const downpaymentPercentage = Number(req.body.downpaymentPercentage ?? req.body.soa_downpayment_percentage ?? listing.soa_downpayment_percentage ?? 30);
    const downpaymentTerms = Number(req.body.downpaymentTerms ?? req.body.soa_downpayment_terms ?? listing.soa_downpayment_terms ?? 3);
    const monthlyTerms = Number(req.body.monthlyTerms ?? req.body.soa_monthly_terms ?? listing.soa_monthly_terms ?? 36);
    const reservationFeeAppliedToDownpayment = (
      req.body.reservationFeeTreatment === 'apply_to_downpayment' ||
      req.body.reservationFeeAppliedToDownpayment === true ||
      Number(
        req.body.reservationFeeAppliedToDownpayment ??
          req.body.soa_reservation_fee_applied_to_downpayment ??
          listing.soa_reservation_fee_applied_to_downpayment ??
          0
      ) === 1
    );
    const interestRateSource = 'listing';
    const annualInterestRate = Number(listing.annual_interest_rate || 0);
    const firstDueDate = dateOrNull(req.body.firstDueDate || req.body.soa_first_due_date || listing.soa_first_due_date);
    const currentHistoricalEntry = Number(listing.soa_is_historical_entry || 0) === 1;
    const isHistoricalEntry = req.body.isHistoricalEntry !== undefined
      ? (req.body.isHistoricalEntry === true || Number(req.body.isHistoricalEntry || 0) === 1)
      : currentHistoricalEntry;
    const dailyPenaltyRate = Number(
      req.body.dailyPenaltyRate ??
      req.body.soa_penalty_rate_percent ??
      listing.soa_penalty_rate_percent ??
      0.05
    );
    const penaltyGraceDays = Number(
      req.body.penaltyGraceDays ??
      req.body.soa_penalty_grace_days ??
      listing.soa_penalty_grace_days ??
      1
    );
    const penaltyEffectiveFromRaw = req.body.penaltyEffectiveFrom ?? req.body.soa_penalty_effective_from;
    const currentPenaltyEffectiveFrom = dateOrNull(listing.soa_penalty_effective_from);
    const penaltyEffectiveFrom = penaltyEffectiveFromRaw === undefined ? currentPenaltyEffectiveFrom : dateOrNull(penaltyEffectiveFromRaw);
    if (penaltyEffectiveFromRaw !== undefined && penaltyEffectiveFromRaw !== null && String(penaltyEffectiveFromRaw).trim() !== '' &&
        !/^\d{4}-\d{2}-\d{2}$/.test(String(penaltyEffectiveFromRaw).trim().slice(0, 10))) {
      return res.status(400).json({ message: 'Penalty Effective From must be a valid date.' });
    }
    if (penaltyEffectiveFromRaw !== undefined && !(await columnExists(connection, 'lot_project_client_profiles', 'soa_penalty_effective_from'))) {
      return res.status(500).json({ message: 'Penalty effective-date migration is missing. Run server/migrations/20260819_payment_penalty_waiver_effective_date.sql first.' });
    }
    if (dpDiscountPercentage < 0 || dpDiscountPercentage > 100) {
      return res.status(400).json({ message: 'DP Discount % must be between 0 and 100.' });
    }

    if (downpaymentPercentage < 0 || downpaymentPercentage > 100) {
      return res.status(400).json({ message: 'Downpayment % must be between 0 and 100.' });
    }

    if (!Number.isInteger(downpaymentTerms) || downpaymentTerms < 0) {
      return res.status(400).json({ message: 'Downpayment terms must be zero or greater.' });
    }

    if (!Number.isInteger(monthlyTerms) || monthlyTerms < 1) {
      return res.status(400).json({ message: 'Monthly terms must be at least 1.' });
    }

    if (annualInterestRate < 0) {
      return res.status(400).json({ message: 'Annual interest rate cannot be negative.' });
    }

    if (!Number.isFinite(dailyPenaltyRate) || dailyPenaltyRate < 0 || dailyPenaltyRate > 100) {
      return res.status(400).json({ message: 'Daily penalty rate must be between 0 and 100.' });
    }

    if (!Number.isInteger(penaltyGraceDays) || penaltyGraceDays < 0 || penaltyGraceDays > 31) {
      return res.status(400).json({ message: 'Penalty-free grace period must be from 0 to 31 days.' });
    }

    const sameNumber = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) < 0.000001;
    const currentFirstDueDate = dateOrNull(listing.soa_first_due_date);
    const structuralTermsChanged =
      !sameNumber(dpDiscountPercentage, listing.soa_dp_discount_percentage) ||
      !sameNumber(downpaymentPercentage, listing.soa_downpayment_percentage) ||
      Number(downpaymentTerms) !== Number(listing.soa_downpayment_terms ?? 3) ||
      Number(monthlyTerms) !== Number(listing.soa_monthly_terms ?? 36) ||
      Number(reservationFeeAppliedToDownpayment) !== Number(listing.soa_reservation_fee_applied_to_downpayment || 0) ||
      firstDueDate !== currentFirstDueDate ||
      Number(isHistoricalEntry) !== Number(currentHistoricalEntry);
    const penaltyTermsChanged =
      !sameNumber(dailyPenaltyRate, listing.soa_penalty_rate_percent) ||
      Number(penaltyGraceDays) !== Number(listing.soa_penalty_grace_days ?? 0) ||
      String(penaltyEffectiveFrom || '') !== String(currentPenaltyEffectiveFrom || '') ||
      String(listing.soa_penalty_calculation_method || 'daily').toLowerCase() !== 'daily';

    if (firstDueDate !== currentFirstDueDate || isHistoricalEntry !== currentHistoricalEntry) {
      const today = todayDateOnly();
      const startingDate = dateOrNull(listing.soa_starting_date) || today;
      if (!firstDueDate) {
        return res.status(400).json({ message: 'First Due Date is required.' });
      }
      if (firstDueDate < startingDate) {
        return res.status(400).json({ message: 'First Due Date cannot be before the Starting Date.' });
      }
    }

    if (Number(paymentCount || 0) > 0 && structuralTermsChanged) {
      return res.status(400).json({
        message: 'Downpayment and amortization terms cannot be changed after payments are recorded. Penalty rate and grace period can still be updated.',
      });
    }

    const updateColumns = [];
    const updateParams = [];

    const addProfileUpdate = async (column, value) => {
      if (await columnExists(connection, 'lot_project_client_profiles', column)) {
        updateColumns.push(`${column} = ?`);
        updateParams.push(value);
      }
    };

    await addProfileUpdate('soa_dp_discount_percentage', dpDiscountPercentage);
    await addProfileUpdate('soa_downpayment_percentage', downpaymentPercentage);
    await addProfileUpdate('soa_downpayment_terms', downpaymentTerms);
    await addProfileUpdate('soa_reservation_fee_applied_to_downpayment', reservationFeeAppliedToDownpayment ? 1 : 0);
    await addProfileUpdate('soa_monthly_terms', monthlyTerms);
    await addProfileUpdate('soa_annual_interest_rate', annualInterestRate);
    await addProfileUpdate('soa_interest_rate_overridden', 0);
    await addProfileUpdate('soa_first_due_date', firstDueDate);
    await addProfileUpdate('soa_is_historical_entry', isHistoricalEntry ? 1 : 0);
    await addProfileUpdate('soa_penalty_calculation_method', 'daily');
    await addProfileUpdate('soa_penalty_rate_percent', dailyPenaltyRate);
    await addProfileUpdate('soa_penalty_grace_days', penaltyGraceDays);
    await addProfileUpdate('soa_penalty_effective_from', penaltyEffectiveFrom);

    await connection.beginTransaction();

    if (updateColumns.length > 0) {
      await connection.query(
        `
          UPDATE lot_project_client_profiles
          SET ${updateColumns.join(', ')}
          WHERE lot_project_client_profile_id = ?
            AND lot_project_id = ?
            AND lot_project_listing_id = ?
        `,
        [
          ...updateParams,
          listing.lot_project_client_profile_id,
          project.lot_project_id,
          listing.lot_project_listing_id,
        ]
      );
    }

    if (structuralTermsChanged && await tableExists(connection, 'lot_project_payment_schedules')) {
      const updatedListing = {
        ...listing,
        soa_dp_discount_percentage: dpDiscountPercentage,
        soa_downpayment_percentage: downpaymentPercentage,
        soa_downpayment_terms: downpaymentTerms,
        soa_reservation_fee_applied_to_downpayment: reservationFeeAppliedToDownpayment ? 1 : 0,
        soa_monthly_terms: monthlyTerms,
        soa_annual_interest_rate: annualInterestRate,
        soa_interest_rate_overridden: 0,
        soa_first_due_date: firstDueDate,
        soa_is_historical_entry: isHistoricalEntry ? 1 : 0,
        soa_penalty_calculation_method: 'daily',
        soa_penalty_rate_percent: dailyPenaltyRate,
        soa_penalty_grace_days: penaltyGraceDays,
        soa_penalty_effective_from: penaltyEffectiveFrom,
      };
      const terms = getComputedSoaTerms(updatedListing, []);
      const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

      // Keep the previous zero-payment schedule as account history instead of deleting it.
      await connection.query(
        `
          UPDATE lot_project_payment_schedules
          SET schedule_status = 'Cancelled',
              updated_at = NOW()
          WHERE lot_project_id = ?
            AND lot_project_listing_id = ?
            AND lot_project_client_profile_id = ?
            AND schedule_status <> 'Cancelled'
        `,
        [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
      );

      if (computedRows.length > 0) {
        const baseColumns = [
          'lot_project_id',
          'lot_project_listing_id',
          'lot_project_client_profile_id',
          'lot_project_account_id',
          'due_date',
          'description',
          'beginning_balance',
          'due_amount',
          'penalty_amount',
          'amount_paid',
          'date_paid',
          'reference_id',
          'ending_balance',
          'schedule_status',
        ];
        const optionalColumns = [];
        const addOptionalColumn = async (column) => {
          if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
        };

        await addOptionalColumn('interest_amount');
        await addOptionalColumn('discount_amount');
        await addOptionalColumn('principal_amount');
        await addOptionalColumn('monthly_amortization_amount');
        await addOptionalColumn('paid_interest_amount');
        await addOptionalColumn('paid_principal_amount');
        await addOptionalColumn('paid_penalty_amount');

        const columns = [...baseColumns, ...optionalColumns, 'created_at', 'updated_at'];
        const insertValues = computedRows.flatMap((row) => {
          const baseValues = [
            project.lot_project_id,
            listing.lot_project_listing_id,
            listing.lot_project_client_profile_id,
            listing.lot_project_account_id,
            row.dueDate,
            row.description,
            roundMoneyValue(row.beginningBalance || 0),
            roundMoneyValue(row.dueAmount || 0),
            roundMoneyValue(row.penalty || 0),
            roundMoneyValue(row.amountPaid || 0),
            row.datePaid && row.datePaid !== '-' ? row.datePaid : null,
            row.referenceId && row.referenceId !== '-' ? row.referenceId : null,
            roundMoneyValue(row.endingBalance || 0),
            row.status || 'Unpaid',
          ];
          const optionalValues = optionalColumns.map((column) => {
            if (column === 'interest_amount') return roundMoneyValue(row.interest || 0);
            if (column === 'discount_amount') return roundMoneyValue(row.discountAmount || row.discount_amount || 0);
            if (column === 'principal_amount') return roundMoneyValue(row.principalAmount || row.principal_amount || 0);
            if (column === 'monthly_amortization_amount') return roundMoneyValue(row.monthlyAmortizationAmount || row.dueAmount || 0);
            if (column === 'paid_interest_amount') return roundMoneyValue(row.paidInterestAmount || 0);
            if (column === 'paid_principal_amount') return roundMoneyValue(row.paidPrincipalAmount || 0);
            if (column === 'paid_penalty_amount') return roundMoneyValue(row.paidPenaltyAmount || 0);
            return 0;
          });

          return [...baseValues, ...optionalValues];
        });

        await connection.query(
          `
            INSERT INTO lot_project_payment_schedules (
              ${columns.join(',\n              ')}
            ) VALUES ${computedRows.map(() => `(${columns.map((column) => column === 'created_at' || column === 'updated_at' ? 'NOW()' : '?').join(', ')})`).join(', ')}
          `,
          insertValues
        );
      }
    }

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      const refreshedListing = {
        ...listing,
        soa_penalty_calculation_method: 'daily',
        soa_penalty_rate_percent: dailyPenaltyRate,
        soa_penalty_grace_days: penaltyGraceDays,
        soa_penalty_effective_from: penaltyEffectiveFrom,
      };
      await refreshListingPenaltyCache(connection, refreshedListing, todayDateOnly());
      await recomputeListingScheduleBalances(connection, refreshedListing);
    }

    if (structuralTermsChanged) {
      await syncCommissionProgressForListing(connection, listing);
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_listing',
      entityId: String(listing.lot_project_listing_id),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${listing.buyer_full_name || 'Client'}`,
      title: 'Updated SOA terms',
      description: `Updated SOA terms for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
      metadata: {
        clientProfileId: listing.lot_project_client_profile_id,
        dpDiscountPercentage,
        downpaymentPercentage,
        downpaymentTerms,
        monthlyTerms,
        annualInterestRate,
        firstDueDate,
        isHistoricalEntry,
        dailyPenaltyRate,
        penaltyGraceDays,
        penaltyEffectiveFrom,
        structuralTermsChanged,
        penaltyTermsChanged,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: structuralTermsChanged
        ? 'SOA terms saved and schedule recomputed successfully.'
        : penaltyTermsChanged
          ? 'Penalty settings updated successfully.'
          : 'SOA terms are already up to date.',
      data: {
        dpDiscountPercentage,
        downpaymentPercentage,
        downpaymentTerms,
        monthlyTerms,
        annualInterestRate,
        interestRateSource,
        firstDueDate,
        isHistoricalEntry,
        dailyPenaltyRate,
        penaltyGraceDays,
        penaltyEffectiveFrom,
      },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const restoreSeparateLegalMiscFeeFromAuditCase = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requirePenaltyManager(req);
    if (actor.role !== 'system_admin') throw createHttpError(403, 'Only System Admin can restore an LMF from a valid Auditor correction case.');

    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const auditCaseId = Number(req.body.auditCaseId || req.body.audit_case_id || 0);
    const reason = String(req.body.reason || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!listingLookup || !scheduleId) throw createHttpError(400, 'Listing and Legal / Misc Fee row are required.');
    if (reason.length < 5) throw createHttpError(400, 'Describe why the LMF is being restored.');
    if (!auditCaseId) throw createHttpError(409, 'Open this LMF correction from a valid Auditor case.');

    const lookup = getListingLookupWhere(listingLookup);
    await connection.beginTransaction();

    const [listingRows] = await connection.query(
      `SELECT l.*, account.lot_project_account_id, account.account_reference, cp.*
       FROM lot_project_listings l
       INNER JOIN lot_project_accounts account ON account.lot_project_account_id = l.current_account_id
       INNER JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
       WHERE l.lot_project_id = ? AND ${lookup.sql}
       LIMIT 1 FOR UPDATE`,
      [project.lot_project_id, ...lookup.params]
    );
    const listing = listingRows[0];
    if (!listing) throw createHttpError(404, 'Reserved listing not found.');

    const [scheduleRows] = await connection.query(
      `SELECT * FROM lot_project_payment_schedules
       WHERE lot_project_payment_schedule_id=? AND lot_project_id=? AND lot_project_listing_id=? AND lot_project_client_profile_id=?
       LIMIT 1 FOR UPDATE`,
      [scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
    );
    const schedule = scheduleRows[0];
    if (!schedule || getStoredScheduleType(schedule) !== 'legal_misc') throw createHttpError(404, 'Legal / Misc Fee SOA row not found.');

    const auditCase = await getPendingAuditCorrectionCase(connection, {
      auditCaseId,
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: scheduleId,
      forUpdate: true,
    });
    if (!auditCase) throw createHttpError(409, 'This Audit Case does not authorize correction of this Legal / Misc Fee row.');

    await assertEntityNotReviewLocked(connection, { actor: req.authUser,
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: scheduleId,
      allowReviewId: auditCase.operational_review_id,
    });

    const [reviewRows] = await connection.query(
      `SELECT before_snapshot_json, after_snapshot_json FROM operational_reviews WHERE operational_review_id=? LIMIT 1 FOR UPDATE`,
      [auditCase.operational_review_id]
    );
    const parseSnapshot = (value) => {
      if (!value) return {};
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch (_) { return {}; }
    };
    const before = parseSnapshot(reviewRows[0]?.before_snapshot_json);
    const originalLmfAmount = roundMoneyValue(before.originalLmfAmount || 0);
    const originalTcp = roundMoneyValue(before.originalTcp || 0);
    const allowedStatuses = new Set(['Unpaid','Partial','Paid','Advance','Overdue','Cancelled']);
    const restoredStatus = allowedStatuses.has(String(before.scheduleStatus || '')) && String(before.scheduleStatus) !== 'Cancelled'
      ? String(before.scheduleStatus)
      : 'Unpaid';
    if (originalLmfAmount <= 0.009 || originalTcp <= 0.009) throw createHttpError(409, 'The Audit Case does not contain a valid pre-waiver LMF snapshot.');

    const [paidRows] = await connection.query(
      `SELECT COALESCE(SUM(CASE WHEN p.lot_project_payment_status='Verified' THEN COALESCE(a.applied_amount, CASE WHEN p.lot_project_payment_schedule_id=? THEN p.lot_project_payment_amount ELSE 0 END) ELSE 0 END),0) AS paid
       FROM lot_project_payments p
       LEFT JOIN lot_project_payment_allocations a ON a.lot_project_payment_id=p.lot_project_payment_id AND a.lot_project_payment_schedule_id=?
       WHERE p.lot_project_id=? AND p.lot_project_listing_id=? AND p.lot_project_client_profile_id=?`,
      [scheduleId, scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
    );
    if (Number(paidRows[0]?.paid || 0) > 0.009) throw createHttpError(409, 'LMF cannot be restored while verified payment allocations exist on this row.');

    const currentSnapshot = {
      listingId: listing.lot_project_listing_id,
      projectSlug: project.lot_project_slug || slug,
      unitId: listing.lot_project_listing_unit_id,
      lmfAmount: Number(listing.soa_selected_lmf_amount || listing.soa_legal_misc_fee_amount || 0),
      tcp: Number(listing.soa_selected_tcp || 0),
      scheduleId,
      scheduleStatus: schedule.schedule_status,
    };

    await connection.query(
      `UPDATE lot_project_client_profiles
       SET soa_selected_tcp=?, soa_selected_lmf_amount=?, soa_legal_misc_fee_amount=?,
           soa_lmf_waived_amount=0, soa_lmf_waiver_reason=NULL, soa_lmf_waiver_reference=NULL,
           soa_lmf_waived_by_user_id=NULL, soa_lmf_waived_at=NULL
       WHERE lot_project_client_profile_id=? AND lot_project_id=? AND lot_project_listing_id=?`,
      [originalTcp, originalLmfAmount, originalLmfAmount, listing.lot_project_client_profile_id, project.lot_project_id, listing.lot_project_listing_id]
    );

    const scheduleSet = [
      'due_amount = ?',
      'penalty_amount = 0',
      'amount_paid = 0',
      'date_paid = NULL',
      'reference_id = NULL',
      'ending_balance = beginning_balance',
      'schedule_status = ?',
      'updated_at = NOW()',
    ];
    for (const column of ['interest_amount','discount_amount','principal_amount','monthly_amortization_amount','calculated_penalty_amount','waived_penalty_amount','paid_penalty_amount','paid_interest_amount','paid_principal_amount']) {
      if (await columnExists(connection, 'lot_project_payment_schedules', column)) scheduleSet.push(`${column} = 0`);
    }
    await connection.query(
      `UPDATE lot_project_payment_schedules SET ${scheduleSet.join(', ')} WHERE lot_project_payment_schedule_id=?`,
      [originalLmfAmount, restoredStatus, scheduleId]
    );

    await recomputeListingScheduleBalances(connection, {
      ...listing,
      soa_selected_tcp: originalTcp,
      soa_selected_lmf_amount: originalLmfAmount,
      soa_legal_misc_fee_amount: originalLmfAmount,
    });
    await syncCommissionProgressForListing(connection, listing);

    const afterSnapshot = {
      listingId: listing.lot_project_listing_id,
      projectSlug: project.lot_project_slug || slug,
      unitId: listing.lot_project_listing_unit_id,
      scheduleId,
      restoredLmfAmount: originalLmfAmount,
      restoredTcp: originalTcp,
      scheduleStatus: restoredStatus,
      reason,
    };

    await writeAuditLog(connection, req, {
      actor,
      action: 'correct',
      module: 'Payments',
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: String(scheduleId),
      entityLabel: `LMF · ${listing.lot_project_listing_unit_id}`,
      title: 'Restored Legal / Misc Fee after Audit Case',
      description: `Restored ${money(originalLmfAmount)} Legal / Misc Fee for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
      metadata: { auditCaseId, reason, before: currentSnapshot, after: afterSnapshot },
    });

    await advanceAuditCaseToRecheck(connection, {
      auditCase,
      actor,
      correctionSummary: reason,
      afterSnapshot,
      metadata: { scheduleId, originalLmfAmount, originalTcp },
      notificationTitle: `LMF correction needs Auditor recheck · ${listing.lot_project_listing_unit_id}`,
    });

    await connection.commit();
    return res.json({ success: true, message: `Legal / Misc Fee of ${money(originalLmfAmount)} was restored. Auditor has been notified for final recheck.`, data: afterSnapshot });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error), code: error.code || undefined });
  } finally {
    connection.release();
  }
};


export const waiveSeparateLegalMiscFee = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const reason = String(req.body.reason || '').trim();
    const approvalReference = toNullable(req.body.approvalReference || req.body.approval_reference);
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);
    const project = await getProjectBySlug(slug);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!listingLookup || !scheduleId) throw createHttpError(400, 'Listing and Legal / Misc Fee row are required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');
    if (!(await tableExists(connection, 'lot_project_contract_adjustments'))) {
      throw createHttpError(500, 'Contract adjustment table is missing. Run server/migrations/20260724_soa_dp_discount_historical_lmf_waiver.sql first.');
    }

    const lookup = getListingLookupWhere(listingLookup);
    await connection.beginTransaction();

    const [listingRows] = await connection.query(
      `
        SELECT l.*, account.lot_project_account_id, account.account_reference, cp.*
        FROM lot_project_listings l
        INNER JOIN lot_project_accounts account
          ON account.lot_project_account_id = l.current_account_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
        FOR UPDATE
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) throw createHttpError(404, 'Reserved listing not found.');

    const [scheduleRows] = await connection.query(
      `
        SELECT *
        FROM lot_project_payment_schedules
        WHERE lot_project_payment_schedule_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
    );

    const schedule = scheduleRows[0];
    if (!schedule || getStoredScheduleType(schedule) !== 'legal_misc') {
      throw createHttpError(404, 'Legal / Misc Fee SOA row not found.');
    }
    if (String(listing.soa_legal_misc_fee_mode || '').toLowerCase() !== 'separate_soa_row') {
      throw createHttpError(400, 'LMF can only be waived when it is a separate SOA row.');
    }
    if (String(schedule.schedule_status || '').toLowerCase() === 'cancelled') {
      throw createHttpError(400, 'This Legal / Misc Fee has already been removed.');
    }

    const originalLmfAmount = roundMoneyValue(
      listing.soa_selected_lmf_amount ?? listing.soa_legal_misc_fee_amount ?? schedule.due_amount ?? 0
    );
    if (originalLmfAmount <= 0.009) throw createHttpError(400, 'This account has no Legal / Misc Fee to waive.');

    const [paymentRows] = await connection.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN p.lot_project_payment_status = 'Verified' THEN p.lot_project_payment_amount ELSE 0 END), 0) AS direct_paid,
          COALESCE(SUM(CASE WHEN p.lot_project_payment_status = 'Verified' THEN a.applied_amount ELSE 0 END), 0) AS allocated_paid
        FROM lot_project_payments p
        LEFT JOIN lot_project_payment_allocations a
          ON a.lot_project_payment_id = p.lot_project_payment_id
          AND a.lot_project_payment_schedule_id = ?
        WHERE p.lot_project_id = ?
          AND p.lot_project_listing_id = ?
          AND p.lot_project_client_profile_id = ?
          AND (p.lot_project_payment_schedule_id = ? OR a.lot_project_payment_schedule_id = ?)
      `,
      [scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id, scheduleId, scheduleId]
    );
    const recordedLmfPayment = roundMoneyValue(
      Math.max(Number(schedule.amount_paid || 0), Number(paymentRows[0]?.direct_paid || 0), Number(paymentRows[0]?.allocated_paid || 0))
    );
    if (recordedLmfPayment > 0.009) {
      throw createHttpError(400, 'The Legal / Misc Fee already has a recorded payment. Reverse, refund, or reallocate it before waiving the fee.');
    }

    const originalTcp = roundMoneyValue(listing.soa_selected_tcp || listing.lot_project_listing_tcp || 0);
    const adjustedTcp = roundMoneyValue(Math.max(originalTcp - originalLmfAmount, 0));
    const entityLabel = `LMF · ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = {
      scheduleId,
      originalLmfAmount,
      originalTcp,
      adjustedTcp,
      reason,
      approvalReference,
      internalNotes,
    };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req,
      actor: user,
      project,
      listing,
      actionKey: 'payment.lmf_waiver',
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({
        success: false,
        approval_required: true,
        approval_request_id: authorization.approvalRequestId,
        request_number: authorization.requestNumber,
        message: authorization.message,
      });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser,
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: scheduleId,
      allowReviewId: authorization.allowReviewId || null,
    });

    const [adjustmentResult] = await connection.query(
      `
        INSERT INTO lot_project_contract_adjustments (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          adjustment_type,
          original_amount,
          adjustment_amount,
          reason,
          approval_reference,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'lmf_waiver', ?, ?, ?, ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        originalLmfAmount,
        originalLmfAmount,
        reason,
        approvalReference,
        internalNotes,
        user.id,
      ]
    );

    await connection.query(
      `
        UPDATE lot_project_client_profiles
        SET soa_selected_tcp = ?,
            soa_selected_lmf_amount = 0,
            soa_legal_misc_fee_amount = 0,
            soa_lmf_waived_amount = ?,
            soa_lmf_waiver_reason = ?,
            soa_lmf_waiver_reference = ?,
            soa_lmf_waived_by_user_id = ?,
            soa_lmf_waived_at = NOW()
        WHERE lot_project_client_profile_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [
        adjustedTcp,
        originalLmfAmount,
        reason,
        approvalReference,
        user.id,
        listing.lot_project_client_profile_id,
        project.lot_project_id,
        listing.lot_project_listing_id,
      ]
    );

    const scheduleSet = [
      'due_amount = 0',
      'penalty_amount = 0',
      'amount_paid = 0',
      'date_paid = NULL',
      'reference_id = NULL',
      'ending_balance = beginning_balance',
      "schedule_status = 'Cancelled'",
      'updated_at = NOW()',
    ];
    for (const column of ['interest_amount', 'discount_amount', 'principal_amount', 'monthly_amortization_amount', 'calculated_penalty_amount', 'waived_penalty_amount', 'paid_penalty_amount', 'paid_interest_amount', 'paid_principal_amount']) {
      if (await columnExists(connection, 'lot_project_payment_schedules', column)) scheduleSet.push(`${column} = 0`);
    }
    await connection.query(
      `UPDATE lot_project_payment_schedules SET ${scheduleSet.join(', ')} WHERE lot_project_payment_schedule_id = ?`,
      [scheduleId]
    );

    await recomputeListingScheduleBalances(connection, {
      ...listing,
      soa_selected_tcp: adjustedTcp,
      soa_selected_lmf_amount: 0,
      soa_legal_misc_fee_amount: 0,
    });

    await syncCommissionProgressForListing(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_contract_adjustment',
      entityId: String(adjustmentResult.insertId || scheduleId),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${listing.buyer_full_name || 'Client'}`,
      title: 'Waived Legal / Misc Fee',
      description: `Waived ${money(originalLmfAmount)} Legal / Misc Fee for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
      metadata: {
        clientProfileId: listing.lot_project_client_profile_id,
        accountId: listing.lot_project_account_id,
        scheduleId,
        originalTcp,
        adjustedTcp,
        waivedAmount: originalLmfAmount,
        reason,
        approvalReference,
      },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user,
      project,
      listing,
      actionKey: 'payment.lmf_waiver',
      entityType: ACCOUNTING_LMF_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: {
        listingId: listing.lot_project_listing_id,
        projectSlug: project.lot_project_slug || slug,
        unitId: listing.lot_project_listing_unit_id,
        originalLmfAmount,
        originalTcp,
        scheduleStatus: schedule.schedule_status,
      },
      afterSnapshot: {
        listingId: listing.lot_project_listing_id,
        projectSlug: project.lot_project_slug || slug,
        unitId: listing.lot_project_listing_unit_id,
        lmfAmount: 0,
        adjustedTcp,
        scheduleStatus: 'Cancelled',
        reason,
      },
      authorization,
    });

    await connection.commit();
    return res.json({
      success: true,
      message: `Legal / Misc Fee of ${money(originalLmfAmount)} was waived successfully.`,
      data: { originalLmfAmount, originalTcp, adjustedTcp },
      review: workflowReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const deleteLotProjectListingPayment = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const result = await runTransactionWithRetry(db, async (connection) => {
      const listing = await getListingForPayment(connection, project, listingLookup, { forUpdate: true });
      if (!listing) throw createHttpError(404, 'Listing not found.');
      await lockPaymentAccountForListing(connection, listing);

      const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
      if (hasSchedules) await lockPaymentSchedulesForListing(connection, listing);
      const allowCrossTypeOverflow = hasSchedules
        ? await hasCrossTypePaymentAllocations(connection, listing)
        : false;

      const existingPayment = await getPaymentById(connection, project, listing, paymentId, { forUpdate: true });
      if (!existingPayment) throw createHttpError(404, 'Payment not found.');
      if (existingPayment.lot_project_payment_status !== 'Verified') {
        throw createHttpError(409, 'This payment is no longer verified and cannot be voided again.');
      }
      const correctionAuthorization = await requirePaymentCorrectionVerification(connection, req, {
        action: 'void',
        listing,
        existingPayment,
      });
      if (!correctionAuthorization.ok) return { authorizationError: correctionAuthorization };
      await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: 'lot_project_payment', entityId: paymentId, allowReviewId: correctionAuthorization.allowReviewId || null });

      await reversePaymentAllocations(connection, listing, paymentId);

      const [deleteResult] = await connection.query(
        `
          UPDATE lot_project_payments
          SET lot_project_payment_status = 'Cancelled',
              lot_project_payment_updated_at = NOW()
          WHERE lot_project_payment_id = ?
            AND lot_project_id = ?
            AND lot_project_listing_id = ?
            AND lot_project_client_profile_id = ?
            AND lot_project_account_id = ?
            AND lot_project_payment_status = 'Verified'
        `,
        [
          paymentId,
          project.lot_project_id,
          listing.lot_project_listing_id,
          listing.lot_project_client_profile_id,
          listing.lot_project_account_id,
        ]
      );

      if (!Number(deleteResult?.affectedRows || 0)) {
        throw createHttpError(409, 'Payment changed before it could be deleted. Please refresh and try again.');
      }

      if (hasSchedules) {
        await rebuildListingPaymentAllocationsChronologically(connection, listing, { finalAsOfDate: todayDateOnly(), allowCrossTypeOverflow, relinkPrimarySchedule: true });
      }

      await syncCommissionProgressForListing(connection, listing);

      await connection.query(
        `
          INSERT INTO lot_project_payment_logs (
            lot_project_payment_id,
            action_type,
            action_description,
            action_by_user_id
          ) VALUES (?, 'deleted', ?, ?)
        `,
        [
          paymentId,
          `Payment ${existingPayment.lot_project_payment_reference_id || paymentId} voided by ${getUserFullName(user)}.`,
          user?.id || null,
        ]
      );

      await writeAuditLog(connection, req, {
        action: 'correct',
        module: 'Payments',
        entityType: 'lot_project_payment',
        entityId: String(paymentId),
        entityLabel: `${existingPayment.lot_project_payment_reference_id || `Payment #${paymentId}`} — ${listing.buyer_full_name || listing.lot_project_listing_unit_id}`,
        title: 'Voided verified payment',
        description: `An authorized user voided a verified payment for ${listing.buyer_full_name || listing.lot_project_listing_unit_id} through the governed correction workflow.`,
        metadata: {
          listingId: listing.lot_project_listing_id,
          unitId: listing.lot_project_listing_unit_id,
          accountId: listing.lot_project_account_id,
          authorizationType: correctionAuthorization.authorizationType,
          verificationId: correctionAuthorization.verificationId || null,
          approvalRequestId: correctionAuthorization.approvalRequestId || null,
          auditCaseId: correctionAuthorization.auditCase?.audit_case_id || null,
          reason: correctionAuthorization.reason,
          payment: {
            amount: Number(existingPayment.lot_project_payment_amount || 0),
            paymentDate: plainDate(existingPayment.lot_project_payment_date),
            paymentType: existingPayment.lot_project_payment_type,
            paymentMethod: existingPayment.lot_project_payment_method,
            referenceId: existingPayment.lot_project_payment_reference_id,
          },
        },
      });

      const workflowReview = await completePaymentCorrectionWorkflow(connection, {
        req, actor: user, project, listing, existingPayment, paymentId, action: 'void', authorization: correctionAuthorization,
        afterSnapshot: { ...correctionAuthorization.payload.proposed, status: 'Cancelled', listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id },
      });

      return {
        paymentId,
        referenceId: existingPayment.lot_project_payment_reference_id || null,
        workflowReview,
      };
    });

    if (result.authorizationError) {
      return res.status(result.authorizationError.statusCode || 400).json({ message: result.authorizationError.message });
    }

    return res.json({
      success: true,
      message: 'Payment voided successfully. The original record remains in history and SOA balances were recalculated.',
      payment_id: result.paymentId,
      review: result.workflowReview || null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const grantPaymentSchedulePenaltyExtension = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const promisedPaymentDate = dateOrNull(req.body.promisedPaymentDate || req.body.promised_payment_date);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!promisedPaymentDate) throw createHttpError(400, 'Promised payment date is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const today = todayDateOnly();
    const maxDate = addDaysToDateOnly(today, 31);
    if (promisedPaymentDate < today) {
      throw createHttpError(400, 'Promised payment date cannot be before today.');
    }
    if (promisedPaymentDate > maxDate) {
      throw createHttpError(400, 'Penalty-free extension cannot exceed 31 days.');
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    await connection.beginTransaction();
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today,
      { forUpdate: true }
    );

    const scheduleDueDate = dateOrNull(schedule.due_date);
    if (scheduleDueDate && today < scheduleDueDate) {
      throw createHttpError(400, 'A penalty-free extension can only be granted on or after the SOA due date.');
    }
    if (snapshot.activeExtension?.status === 'active') {
      throw createHttpError(400, 'This SOA row already has an active penalty-free extension. Edit the current extension instead.');
    }
    if (snapshot.unpaidBaseAmount <= 0.009) {
      throw createHttpError(400, 'This SOA row has no unpaid installment balance.');
    }

    const entityLabel = `${schedule.description} — ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = { scheduleId, promisedPaymentDate, reason, internalNotes };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req, actor: user, project, listing,
      actionKey: 'payment.penalty_extension.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({ success: false, approval_required: true, approval_request_id: authorization.approvalRequestId, request_number: authorization.requestNumber, message: authorization.message });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: ACCOUNTING_ADJUSTMENT_ENTITY, entityId: scheduleId, allowReviewId: authorization.allowReviewId || null });

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          promised_payment_date,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'penalty_free_extension', ?, 0, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        promisedPaymentDate,
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Granted penalty-free extension',
      description: `Granted a penalty-free extension through ${promisedPaymentDate} for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        promisedPaymentDate,
        reason,
      },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user, project, listing,
      actionKey: 'payment.penalty_extension.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, activeExtension: snapshot.activeExtension || null },
      afterSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, promisedPaymentDate, reason },
      authorization,
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `No new penalty will be added through ${promisedPaymentDate}.`,
      penalty_relief_id: result.insertId,
      review: workflowReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updatePaymentSchedulePenaltyExtension = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const reliefId = Number(req.params.reliefId || 0);
    const project = await getProjectBySlug(slug);
    const promisedPaymentDate = dateOrNull(req.body.promisedPaymentDate || req.body.promised_payment_date);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId || !reliefId) throw createHttpError(400, 'Active penalty extension is required.');
    if (!promisedPaymentDate) throw createHttpError(400, 'Promised payment date is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const today = todayDateOnly();
    const maxDate = addDaysToDateOnly(today, 31);
    if (promisedPaymentDate < today || promisedPaymentDate > maxDate) {
      throw createHttpError(400, 'Promised payment date must be within the next 31 days.');
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    await connection.beginTransaction();
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today,
      { forUpdate: true }
    );
    if (snapshot.activeExtension?.status !== 'active' || Number(snapshot.activeExtension.penaltyReliefId) !== reliefId) {
      throw createHttpError(400, 'Only the current active penalty-free extension can be edited.');
    }

    const entityLabel = `${schedule.description} — ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = { scheduleId, reliefId, promisedPaymentDate, reason, internalNotes };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req, actor: user, project, listing,
      actionKey: 'payment.penalty_extension.update',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({ success: false, approval_required: true, approval_request_id: authorization.approvalRequestId, request_number: authorization.requestNumber, message: authorization.message });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: ACCOUNTING_ADJUSTMENT_ENTITY, entityId: scheduleId, allowReviewId: authorization.allowReviewId || null });

    const [result] = await connection.query(
      `
        UPDATE lot_project_penalty_reliefs
        SET promised_payment_date = ?,
            reason = ?,
            internal_notes = ?,
            status = 'active',
            updated_at = NOW()
        WHERE penalty_relief_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
          AND lot_project_payment_schedule_id = ?
          AND relief_type = 'penalty_free_extension'
          AND status <> 'cancelled'
      `,
      [
        promisedPaymentDate,
        reason,
        internalNotes,
        reliefId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
      ]
    );
    if (!result.affectedRows) throw createHttpError(404, 'Penalty-free extension was not found.');

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);
    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(reliefId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Edited penalty-free extension',
      description: `Updated the penalty-free extension through ${promisedPaymentDate} for ${schedule.description}.`,
      metadata: { listingId: listing.lot_project_listing_id, scheduleId, reliefId, promisedPaymentDate, reason },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user, project, listing,
      actionKey: 'payment.penalty_extension.update',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, reliefId, promisedPaymentDate: snapshot.activeExtension?.promisedPaymentDate || null },
      afterSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, reliefId, promisedPaymentDate, reason },
      authorization,
    });

    await connection.commit();
    return res.json({ success: true, message: `The penalty-free payment date was updated to ${promisedPaymentDate}.`, review: workflowReview });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const correctPaymentSchedulePenalty = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);

    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    const today = todayDateOnly();
    await connection.beginTransaction();
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today,
      { forUpdate: true }
    );
    const correctedAmount = roundMoneyValue(snapshot.calculatedPenaltyAmount || 0);

    const entityLabel = `${schedule.description} — ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = { scheduleId, correctedAmount, reason, internalNotes };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req, actor: user, project, listing,
      actionKey: 'payment.penalty_correction.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({ success: false, approval_required: true, approval_request_id: authorization.approvalRequestId, request_number: authorization.requestNumber, message: authorization.message });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: ACCOUNTING_ADJUSTMENT_ENTITY, entityId: scheduleId, allowReviewId: authorization.allowReviewId || null });

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'penalty_correction', ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        correctedAmount,
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);
    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Reset penalty as a correction',
      description: `Reset the calculated penalty to PHP 0.00 for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        correctedAmount,
        reason,
        correctionDate: today,
      },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user, project, listing,
      actionKey: 'payment.penalty_correction.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, calculatedPenaltyAmount: correctedAmount, outstandingPenaltyAmount: snapshot.outstandingPenaltyAmount },
      afterSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, correctedPenaltyAmount: 0, reason },
      authorization,
    });

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'The incorrect penalty was cleared and is now ₱0.00.',
      penalty_relief_id: result.insertId,
      corrected_amount: correctedAmount,
      review: workflowReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const waivePaymentSchedulePenalty = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const waiverType = String(req.body.waiverType || req.body.waiver_type || 'full').toLowerCase();
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!['full', 'partial'].includes(waiverType)) {
      throw createHttpError(400, 'Waiver type must be full or partial.');
    }
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    await connection.beginTransaction();
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      todayDateOnly(),
      { forUpdate: true }
    );

    const outstandingPenalty = roundMoneyValue(snapshot.outstandingPenaltyAmount || 0);
    if (outstandingPenalty <= 0.009) {
      throw createHttpError(400, 'This SOA row has no outstanding penalty to waive.');
    }

    const requestedAmount = waiverType === 'full'
      ? outstandingPenalty
      : parseMoneyValue(req.body.amount || req.body.reliefAmount || req.body.relief_amount);

    if (requestedAmount <= 0) {
      throw createHttpError(400, 'Partial waiver amount must be greater than 0.');
    }
    if (requestedAmount > outstandingPenalty + 0.009) {
      throw createHttpError(400, 'Waiver amount cannot exceed the outstanding penalty.');
    }

    const entityLabel = `${schedule.description} — ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = { scheduleId, waiverType, amount: roundMoneyValue(requestedAmount), reason, internalNotes };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req, actor: user, project, listing,
      actionKey: 'payment.penalty_waiver.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({ success: false, approval_required: true, approval_request_id: authorization.approvalRequestId, request_number: authorization.requestNumber, message: authorization.message });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: ACCOUNTING_ADJUSTMENT_ENTITY, entityId: scheduleId, allowReviewId: authorization.allowReviewId || null });

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        waiverType === 'full' ? 'full_waiver' : 'partial_waiver',
        roundMoneyValue(requestedAmount),
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, todayDateOnly());
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: waiverType === 'full' ? 'Waived penalty in full' : 'Partially waived penalty',
      description: `${waiverType === 'full' ? 'Fully waived' : 'Partially waived'} ${money(requestedAmount)} penalty for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        waiverType,
        amount: roundMoneyValue(requestedAmount),
        reason,
      },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user, project, listing,
      actionKey: 'payment.penalty_waiver.create',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, outstandingPenalty },
      afterSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, waiverType, waivedAmount: roundMoneyValue(requestedAmount), reason },
      authorization,
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${waiverType === 'full' ? 'Full' : 'Partial'} penalty reduction saved.`,
      penalty_relief_id: result.insertId,
      waived_amount: roundMoneyValue(requestedAmount),
      review: workflowReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const restorePaymentSchedulePenaltyWaiver = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const reliefId = Number(req.params.reliefId || 0);
    const project = await getProjectBySlug(slug);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!reliefId) throw createHttpError(400, 'Penalty waiver is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');
    if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) {
      throw createHttpError(500, 'Penalty relief table is missing. Run the penalty relief migration first.');
    }

    // Read only the immutable schedule key before the transaction. All business
    // validation is repeated under the schedule + relief-row locks below.
    const [targetRows] = await connection.query(
      `
        SELECT lot_project_payment_schedule_id
        FROM lot_project_penalty_reliefs
        WHERE penalty_relief_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
          AND relief_type IN ('full_waiver', 'partial_waiver', 'penalty_correction')
        LIMIT 1
      `,
      [
        reliefId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
      ]
    );
    const scheduleId = Number(targetRows[0]?.lot_project_payment_schedule_id || 0);
    if (!scheduleId) throw createHttpError(404, 'Penalty relief record was not found.');

    await connection.beginTransaction();

    // Keep the same lock order as every other penalty-relief mutation:
    // buyer profile -> SOA schedule -> all relief rows for that schedule.
    await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      todayDateOnly(),
      { forUpdate: true }
    );

    const [reliefRows] = await connection.query(
      `
        SELECT *
        FROM lot_project_penalty_reliefs
        WHERE penalty_relief_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
          AND lot_project_payment_schedule_id = ?
          AND relief_type IN ('full_waiver', 'partial_waiver', 'penalty_correction')
        LIMIT 1
        FOR UPDATE
      `,
      [
        reliefId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
      ]
    );
    const relief = reliefRows[0];
    if (!relief) throw createHttpError(404, 'Penalty relief record was not found.');

    const isCorrection = relief.relief_type === 'penalty_correction';

    const [restorationRows] = await connection.query(
      `
        SELECT COUNT(*) AS restoration_count, COALESCE(SUM(relief_amount), 0) AS restored_amount
        FROM lot_project_penalty_reliefs
        WHERE restores_penalty_relief_id = ?
          AND relief_type = 'restoration'
          AND status <> 'cancelled'
      `,
      [reliefId]
    );
    const restorationCount = Number(restorationRows[0]?.restoration_count || 0);
    const alreadyRestored = roundMoneyValue(restorationRows[0]?.restored_amount || 0);
    const restorableAmount = isCorrection
      ? roundMoneyValue(relief.relief_amount || 0)
      : roundMoneyValue(Math.max(Number(relief.relief_amount || 0) - alreadyRestored, 0));
    const requestedAmount = isCorrection
      ? restorableAmount
      : req.body.amount === undefined || req.body.amount === null || req.body.amount === ''
        ? restorableAmount
        : parseMoneyValue(req.body.amount);

    if (isCorrection && (restorationCount > 0 || relief.status === 'restored')) {
      throw createHttpError(400, 'This penalty correction has already been restored.');
    }
    if (!isCorrection && restorableAmount <= 0.009) {
      throw createHttpError(400, 'This penalty waiver has already been fully restored.');
    }
    if (!isCorrection && (requestedAmount <= 0 || requestedAmount > restorableAmount + 0.009)) {
      throw createHttpError(400, 'Restore amount must be greater than 0 and cannot exceed the remaining waived amount.');
    }

    const entityLabel = `${isCorrection ? 'Penalty correction' : 'Penalty waiver'} #${reliefId} — ${listing.lot_project_listing_unit_id}`;
    const approvalPayload = { scheduleId, reliefId, amount: roundMoneyValue(requestedAmount), reason, internalNotes };
    const authorization = await authorizeAccountingAdjustment(connection, {
      req, actor: user, project, listing,
      actionKey: 'payment.penalty_restore',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      payload: approvalPayload,
      reason,
    });
    if (!authorization.authorized) {
      await connection.commit();
      return res.status(202).json({ success: false, approval_required: true, approval_request_id: authorization.approvalRequestId, request_number: authorization.requestNumber, message: authorization.message });
    }
    await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: ACCOUNTING_ADJUSTMENT_ENTITY, entityId: scheduleId, allowReviewId: authorization.allowReviewId || null });

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          restores_penalty_relief_id,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'restoration', ?, ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        roundMoneyValue(requestedAmount),
        reliefId,
        reason,
        internalNotes,
        user.id,
      ]
    );

    const totalRestored = roundMoneyValue(alreadyRestored + requestedAmount);
    if (isCorrection || totalRestored + 0.009 >= Number(relief.relief_amount || 0)) {
      const [restoreResult] = await connection.query(
        `
          UPDATE lot_project_penalty_reliefs
          SET status = 'restored'
          WHERE penalty_relief_id = ?
            AND status <> 'cancelled'
        `,
        [reliefId]
      );
      if (restoreResult.affectedRows !== 1) {
        throw createHttpError(409, 'The penalty relief changed while it was being restored. Please refresh and try again.');
      }
    }

    await refreshListingPenaltyCache(connection, listing, todayDateOnly());
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(reliefId),
      entityLabel: `${isCorrection ? 'Penalty correction' : 'Penalty waiver'} #${reliefId} — ${listing.lot_project_listing_unit_id}`,
      title: isCorrection ? 'Restored penalty correction' : 'Restored waived penalty',
      description: isCorrection
        ? `Restored penalty calculation after correction #${reliefId}.`
        : `Restored ${money(requestedAmount)} from penalty waiver #${reliefId}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        reliefId,
        restorationId: result.insertId,
        amount: roundMoneyValue(requestedAmount),
        reason,
      },
    });

    const workflowReview = await completeAccountingAdjustmentReview(connection, {
      actor: user, project, listing,
      actionKey: 'payment.penalty_restore',
      entityType: ACCOUNTING_ADJUSTMENT_ENTITY,
      entityId: scheduleId,
      entityLabel,
      beforeSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, reliefId, reliefType: relief.relief_type, reliefAmount: Number(relief.relief_amount || 0), restorableAmount },
      afterSnapshot: { listingId: listing.lot_project_listing_id, projectSlug: project.lot_project_slug || slug, unitId: listing.lot_project_listing_unit_id, scheduleId, reliefId, restoredAmount: roundMoneyValue(requestedAmount), reason },
      authorization,
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: isCorrection ? 'The penalty was recalculated successfully.' : 'The removed penalty was added back successfully.',
      penalty_relief_id: result.insertId,
      restored_amount: roundMoneyValue(requestedAmount),
      review: workflowReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
