// D&C Prime Realty
// Central list of reviewable actions (plan item 20).
//
// Every action that creates an Operational Review must be listed here with its
// owning department. createOperationalReview() rejects an unknown action key or
// a department that does not match, so a new feature cannot silently skip the
// Head / Auditor workflow or route to the wrong Head.
//
//   department          Head that reviews it (marketing | sales | accounting | operations)
//   entityType          Record the review locks while it is open
//   label               Shown in the Review Center
//   headApprovalBefore  true = Staff need Head approval BEFORE the change is saved
//                       (Head and emergency Super Admin act directly).
//                       false = the change saves immediately and the Head reviews after.

export const COMMISSION_STAGE_HEAD_APPROVAL_BEFORE = Object.freeze({
  release: false,
  hold: false,
  unhold: false,
});

export const REVIEW_ACTIONS = Object.freeze({
  // Accounting
  'payment.create': { department: 'accounting', entityType: 'lot_project_payment', label: 'Payment entry', headApprovalBefore: false },
  'payment.create_with_penalty_waiver': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Payment with penalty waiver', headApprovalBefore: true },
  'payment.edit': { department: 'accounting', entityType: 'lot_project_payment', label: 'Payment correction', headApprovalBefore: true },
  'payment.void': { department: 'accounting', entityType: 'lot_project_payment', label: 'Payment void', headApprovalBefore: true },
  'payment.lmf_waiver': { department: 'accounting', entityType: 'lot_project_lmf_schedule', label: 'Legal / Misc Fee waiver', headApprovalBefore: true },
  'payment.penalty_extension.create': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Penalty extension', headApprovalBefore: true },
  'payment.penalty_extension.update': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Penalty extension change', headApprovalBefore: true },
  'payment.penalty_correction.create': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Penalty correction', headApprovalBefore: true },
  'payment.penalty_waiver.create': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Penalty waiver', headApprovalBefore: true },
  'payment.penalty_restore': { department: 'accounting', entityType: 'lot_project_penalty_schedule', label: 'Penalty waiver restore', headApprovalBefore: true },
  'commission.adjust_unit': { department: 'accounting', entityType: 'lot_project_commission_account', label: 'Unit commission adjustment', headApprovalBefore: true },
  'payment_proof.verify': { department: 'accounting', entityType: 'lot_project_payment_proof', label: 'Payment proof change', headApprovalBefore: false },
  'commission.release': { department: 'accounting', entityType: 'lot_project_commission', label: 'Commission release', headApprovalBefore: COMMISSION_STAGE_HEAD_APPROVAL_BEFORE.release },
  'commission.hold': { department: 'accounting', entityType: 'lot_project_commission', label: 'Commission hold', headApprovalBefore: COMMISSION_STAGE_HEAD_APPROVAL_BEFORE.hold },
  'commission.unhold': { department: 'accounting', entityType: 'lot_project_commission', label: 'Commission unhold', headApprovalBefore: COMMISSION_STAGE_HEAD_APPROVAL_BEFORE.unhold },
  'signed_receipt.upload': { department: 'accounting', entityType: 'lot_project_signed_receipt', label: 'Signed acknowledgement receipt', headApprovalBefore: false },
  'cancellation.settle': { department: 'accounting', entityType: 'lot_project_cancellation', label: 'Cancellation settlement / refund', headApprovalBefore: true },
  'cancellation.void_unpaid': { department: 'accounting', entityType: 'lot_project_cancellation', label: 'Void unpaid cancellation', headApprovalBefore: true },

  // Sales
  'reservation.create': { department: 'sales', entityType: 'lot_project_account', label: 'Reservation entry', headApprovalBefore: false },
  'buyer_profile.edit': { department: 'sales', entityType: 'lot_project_client_profile', label: 'Buyer profile edit', headApprovalBefore: false },
  'buyer_form.approve': { department: 'sales', entityType: 'lot_project_buyer_form', label: 'Buyer form decision', headApprovalBefore: false },
  'reservation.controlled_correction': { department: 'sales', entityType: 'lot_project_reservation', label: 'Controlled reservation correction', headApprovalBefore: true },
  'reservation.correct_unit': { department: 'sales', entityType: 'lot_project_reservation', label: 'Reservation unit correction', headApprovalBefore: false },
  'cancellation.start': { department: 'sales', entityType: 'lot_project_cancellation', label: 'Start cancellation', headApprovalBefore: true },
  'cancellation.cancel': { department: 'sales', entityType: 'lot_project_cancellation', label: 'Withdraw cancellation', headApprovalBefore: true },

  // Operations
  'listing.create': { department: 'operations', entityType: 'lot_project_listing', label: 'Listing creation', headApprovalBefore: false },
  'listing.edit': { department: 'operations', entityType: 'lot_project_listing', label: 'Listing edit', headApprovalBefore: false },
  'listing.delete': { department: 'operations', entityType: 'lot_project_listing', label: 'Listing deletion', headApprovalBefore: true },
  'listing.import': { department: 'operations', entityType: 'lot_project_listing_import', label: 'Listing import', headApprovalBefore: false },
  'listing.import_undo': { department: 'operations', entityType: 'lot_project_listing_import', label: 'Listing import undo', headApprovalBefore: false },
  'listing.documents.update': { department: 'operations', entityType: 'lot_project_listing', label: 'Listing document requirements', headApprovalBefore: false },
  'project.settings.update': { department: 'operations', entityType: 'lot_project_settings', label: 'Project settings', headApprovalBefore: true },
  'listing.protected_edit': { department: 'operations', entityType: 'lot_project_listing', label: 'Reserved / sold listing edit', headApprovalBefore: true },
  'cancellation.release_unit': { department: 'operations', entityType: 'lot_project_cancellation', label: 'Return cancelled unit to Available', headApprovalBefore: true },

  // Marketing
  'network.create': { department: 'marketing', entityType: 'seller_group', label: 'Network creation', headApprovalBefore: false },
  'network.edit': { department: 'marketing', entityType: 'seller_group', label: 'Network edit', headApprovalBefore: false },
  'network.status': { department: 'marketing', entityType: 'seller_group', label: 'Network status change', headApprovalBefore: false },
  'network.delete': { department: 'marketing', entityType: 'seller_group', label: 'Empty Network deletion', headApprovalBefore: false },
  'network.rates.update': { department: 'marketing', entityType: 'seller_group_project_rates', label: 'Network project rates', headApprovalBefore: false },
  'network.members.import': { department: 'marketing', entityType: 'seller_group', label: 'Network member import', headApprovalBefore: false },
  'seller.create': { department: 'marketing', entityType: 'accredited_seller', label: 'Accredited seller creation', headApprovalBefore: false },
  'seller.edit': { department: 'marketing', entityType: 'accredited_seller', label: 'Accredited seller edit', headApprovalBefore: false },
});

export const getReviewAction = (actionKey) => REVIEW_ACTIONS[String(actionKey || '')] || null;

export const assertRegisteredReviewAction = (actionKey, department) => {
  const definition = getReviewAction(actionKey);
  if (!definition) {
    throw Object.assign(new Error(`Review action "${actionKey}" is not registered in server/config/reviewActions.js.`), { statusCode: 500, code: 'REVIEW_ACTION_NOT_REGISTERED' });
  }
  if (department && definition.department !== department) {
    throw Object.assign(new Error(`Review action "${actionKey}" belongs to ${definition.department}, not ${department}.`), { statusCode: 500, code: 'REVIEW_ACTION_DEPARTMENT_MISMATCH' });
  }
  return definition;
};

export const getReviewActionLabel = (actionKey) => getReviewAction(actionKey)?.label || String(actionKey || '');


