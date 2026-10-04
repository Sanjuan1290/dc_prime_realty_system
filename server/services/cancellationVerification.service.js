import { PERMISSIONS } from '../config/permissions.js';
import { sendEmail } from './email.service.js';
import { SENSITIVE_ACTION_CODE_EXPIRY_MINUTES } from './sensitiveActionVerification.service.js';

const clean = (value) => String(value ?? '').trim();
const escapeHtml = (value = '') => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const CANCELLATION_VERIFICATION_ACTION = 'lot_project_cancellation_sensitive_action';
export const CANCELLATION_VERIFICATION_ENTITY = 'lot_project_listing';

export const CANCELLATION_ACTIONS = Object.freeze({
  START: 'start_cancellation',
  CANCEL: 'cancel_cancellation',
  SETTLE: 'settle_cancellation',
  VOID_UNPAID: 'void_unpaid_cancellation',
  RELEASE_UNIT: 'reset_to_available',
});

export const cancellationPermissionForAction = (action) => {
  const normalized = clean(action).toLowerCase();
  if ([CANCELLATION_ACTIONS.START, CANCELLATION_ACTIONS.CANCEL].includes(normalized)) {
    return PERMISSIONS.LOT_CANCELLATIONS_MANAGE;
  }
  if ([CANCELLATION_ACTIONS.SETTLE, CANCELLATION_ACTIONS.VOID_UNPAID].includes(normalized)) {
    return PERMISSIONS.LOT_CANCELLATIONS_SETTLE;
  }
  if (normalized === CANCELLATION_ACTIONS.RELEASE_UNIT) {
    return PERMISSIONS.LOT_CANCELLATIONS_RELEASE_UNIT;
  }
  return null;
};

export const cancellationActionRequiresVerification = (action) => [
  CANCELLATION_ACTIONS.SETTLE,
  CANCELLATION_ACTIONS.VOID_UNPAID,
  CANCELLATION_ACTIONS.RELEASE_UNIT,
].includes(clean(action).toLowerCase());

const normalizedMoney = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
};

export const buildCancellationVerificationPayload = ({ actor, project, listing, account, body = {} }) => ({
  action: clean(body.statusTransitionAction).toLowerCase(),
  actorId: Number(actor?.id || 0),
  projectId: Number(project?.lot_project_id || project?.id || 0),
  listingId: Number(listing?.lot_project_listing_id || listing?.id || 0),
  accountId: Number(account?.lot_project_account_id || listing?.lot_project_account_id || 0),
  unitId: clean(listing?.lot_project_listing_unit_id || listing?.unit_id || body.unitCode || body.unit_id),
  nextStatus: clean(body.status || body.listing_status).toLowerCase(),
  confirmSaleDataDeletion: body.confirmSaleDataDeletion === true,
  cancellationAccountHistoryTreatment: clean(body.cancellationAccountHistoryTreatment),
  cancellationRefundType: clean(body.cancellationRefundType),
  refundAmount: normalizedMoney(body.refundAmount),
  cancellationReason: clean(body.cancellationReason),
  refundDate: clean(body.refundDate) || null,
  refundReference: clean(body.refundReference) || null,
  cancellationSettlementNotes: clean(body.cancellationSettlementNotes) || null,
});

export const sendCancellationVerificationCodeEmail = async ({ actor, code, project, listing, payload }) => {
  const companyName = clean(process.env.COMPANY_NAME) || 'D&C Prime Realty';
  const actorName = clean([actor?.first_name, actor?.middle_name, actor?.last_name].filter(Boolean).join(' ')) || 'Authorized User';
  const actionLabels = {
    [CANCELLATION_ACTIONS.SETTLE]: 'Cancellation Settlement / Refund',
    [CANCELLATION_ACTIONS.VOID_UNPAID]: 'Void Unpaid Cancellation',
    [CANCELLATION_ACTIONS.RELEASE_UNIT]: 'Return Cancelled Unit to Available',
  };
  const actionLabel = actionLabels[payload.action] || 'Cancellation Action';
  const unitId = payload.unitId || listing?.lot_project_listing_unit_id || '-';
  const buyerName = listing?.buyer_full_name || listing?.buyer_name_snapshot || 'Buyer';
  const projectName = project?.lot_project_name || project?.name || '-';
  const details = [
    `Action: ${actionLabel}`,
    `Project: ${projectName}`,
    `Unit: ${unitId}`,
    `Buyer: ${buyerName}`,
    ...(payload.action !== CANCELLATION_ACTIONS.RELEASE_UNIT ? [`Refund amount: PHP ${Number(payload.refundAmount || 0).toFixed(2)}`] : []),
    ...(payload.cancellationReason ? [`Cancellation reason: ${payload.cancellationReason}`] : []),
  ];

  await sendEmail({
    to: actor.email,
    subject: `Cancellation authorization code - ${unitId}`,
    text: [
      `Hello ${actorName},`, '',
      `Your verification code is ${code}.`,
      ...details,
      `This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.`, '',
      'This code is bound to the exact cancellation action reviewed in the portal. If any settlement detail changes, request a new code.', '',
      companyName,
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>${escapeHtml(companyName)}</h2><p>Hello ${escapeHtml(actorName)},</p><p>Use this code to authorize <strong>${escapeHtml(actionLabel)}</strong>.</p><div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:18px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;text-align:center">${escapeHtml(code)}</div><p><strong>Project:</strong> ${escapeHtml(projectName)}<br/><strong>Unit:</strong> ${escapeHtml(unitId)}<br/><strong>Buyer:</strong> ${escapeHtml(buyerName)}${payload.action !== CANCELLATION_ACTIONS.RELEASE_UNIT ? `<br/><strong>Refund amount:</strong> PHP ${escapeHtml(Number(payload.refundAmount || 0).toFixed(2))}` : ''}${payload.cancellationReason ? `<br/><strong>Cancellation reason:</strong> ${escapeHtml(payload.cancellationReason)}` : ''}</p><p>This code expires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes.</p><p style="color:#9a3412"><strong>This code is bound to the exact cancellation action reviewed in the portal.</strong></p></div>`,
  });
};
