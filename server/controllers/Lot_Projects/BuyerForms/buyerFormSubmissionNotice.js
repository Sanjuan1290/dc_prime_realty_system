import { isResendConfigured, sendEmail } from '../../../services/email.service.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

// Project-specific contact takes precedence over the company-wide fallback.
// Never send the buyer's full profile (ID, finance, address) in a notification.
export const getReservationNotificationRecipient = async (connection, projectId) => {
  const [projectRows] = await connection.query(
    'SELECT reservation_contact_email FROM lot_project_settings WHERE lot_project_id = ? LIMIT 1',
    [projectId]
  );
  const projectEmail = String(projectRows[0]?.reservation_contact_email || '').trim();
  if (projectEmail) return projectEmail;

  const [companyRows] = await connection.query(
    'SELECT reservation_contact_email FROM system_settings WHERE system_setting_id = 1 LIMIT 1'
  );
  return String(companyRows[0]?.reservation_contact_email || '').trim() || null;
};

export const buildBuyerSubmissionNotice = ({ projectName, unitId, buyerName }) => ({
  subject: `Buyer Information submitted — ${String(unitId || '').trim()}`,
  text: [
    'New Buyer Information submission',
    `Project: ${projectName}`,
    `Unit: ${unitId}`,
    `Buyer: ${buyerName}`,
    '',
    'The submission was saved successfully and the unit has been placed on temporary hold.',
    'Please log in to D&C Prime Realty to review the buyer form before reserving.',
    'The temporary hold is not a confirmed reservation.',
  ].join('\n'),
  html: `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f6f5f2;font-family:Arial,sans-serif;color:#151922">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:auto;background:#fff;border:1px solid #e7dfca;border-radius:14px">
    <tr><td style="padding:22px 28px;background:#0a0c12;color:#d9b560;border-bottom:3px solid #c69b2f;font-weight:bold;font-size:19px">D&amp;C Prime Realty</td></tr>
    <tr><td style="padding:28px"><p style="margin:0 0 10px;font-size:11px;letter-spacing:1.4px;color:#956b13;font-weight:bold">RESERVATION CONTACT NOTIFICATION</p>
      <h1 style="font-size:24px;margin:0 0 12px">Buyer information received</h1>
      <p style="font-size:14px;line-height:1.6">A buyer has submitted information for a property. The unit is on temporary hold pending staff review.</p>
      <table width="100%" style="border-collapse:collapse;margin:20px 0;font-size:14px">
        <tr><td style="padding:10px;border-bottom:1px solid #eee">Project</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">${escapeHtml(projectName)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #eee">Unit</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">${escapeHtml(unitId)}</td></tr>
        <tr><td style="padding:10px">Buyer</td><td style="padding:10px;font-weight:bold">${escapeHtml(buyerName)}</td></tr>
      </table>
      <p style="font-size:13px;line-height:1.6;background:#fff9ea;padding:14px;border-left:3px solid #c69b2f">Open the authorized project workspace to review the submission before reserving. <strong>This is not a confirmed reservation.</strong></p>
    </td></tr>
  </table></body></html>`,
});

export const sendBuyerFormSubmissionNotice = async ({ connection, projectId, submissionId, projectName, unitId, buyerName }) => {
  const recipient = await getReservationNotificationRecipient(connection, projectId);
  if (!recipient) {
    console.warn('Buyer form submitted: no Reservation Contact Email is configured', { projectId, submissionId });
    return { sent: false, reason: 'contact_not_configured' };
  }
  if (!isResendConfigured()) {
    console.warn('Buyer form submitted: Resend is not configured', { projectId, submissionId });
    return { sent: false, reason: 'resend_not_configured' };
  }
  await sendEmail({
    to: recipient,
    ...buildBuyerSubmissionNotice({ projectName, unitId, buyerName }),
    idempotencyKey: `dcprime-buyer-submission-${submissionId}`,
  });
  return { sent: true };
};
