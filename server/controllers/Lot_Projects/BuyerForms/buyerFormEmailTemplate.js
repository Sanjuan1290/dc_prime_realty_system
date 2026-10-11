// Transactional, mobile-friendly email markup; all user-facing fields are escaped.
// Keep the public action and its privacy/hold disclaimers separate from internal review workflows.
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
})[character]);

const formatExpiry = (expiresAt) => {
  const date = new Date(expiresAt);
  if (!expiresAt || Number.isNaN(date.getTime())) return 'the expiry date shown in the form';
  return `${new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  }).format(date)} (Philippine time)`;
};

export const buildBuyerFormInvitationEmail = ({
  companyName = 'D&C Prime Realty',
  publicUrl = '',
  projectName = '',
  unitId = '',
  expiresAt,
  logoUrl = '',
} = {}) => {
  const company = escapeHtml(companyName);
  const project = escapeHtml(projectName);
  const unit = escapeHtml(unitId);
  const href = escapeHtml(publicUrl);
  const expiry = escapeHtml(formatExpiry(expiresAt));
  const logo = escapeHtml(logoUrl);

  return {
    subject: `Complete your Buyer Information — ${String(unitId || '').trim()}`,
    text: [
      companyName,
      '',
      'Complete your Buyer Information',
      '',
      'Please complete your buyer details for the property below so our team can review the information.',
      `Project: ${projectName}`,
      `Unit: ${unitId}`,
      '',
      'Open your secure buyer information form:',
      publicUrl,
      '',
      `Please submit by ${formatExpiry(expiresAt)}.`,
      '',
      'Submitting your information temporarily holds the unit for our admin review.',
      'It is not a final reservation or payment confirmation.',
      '',
      'This link is intended for you. Please do not forward it.',
      companyName,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buyer Information</title></head>
<body style="margin:0;padding:0;background-color:#f5f4f0;color:#16191e;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#f5f4f0;">
    <tr><td align="center" style="padding:24px 12px 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:570px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e9e4d8;border-radius:16px;overflow:hidden;">
        <tr><td align="center" bgcolor="#090c13" style="padding:24px 24px 20px;background-color:#090c13;border-bottom:3px solid #c49a30;">
          ${logo ? `<img src="${logo}" width="128" alt="${company}" style="display:block;width:128px;max-width:128px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;">` : `<p style="margin:0;color:#e8d4a1;font-weight:bold;font-size:18px;letter-spacing:.5px;">${company}</p>`}
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          <p style="margin:0 0 10px;color:#95721e;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;">PROPERTY PURCHASE · BUYER DETAILS</p>
          <h1 style="margin:0;color:#17191c;font-size:26px;line-height:1.2;font-weight:700;">Complete your Buyer Information</h1>
          <p style="margin:14px 0 0;color:#59616a;font-size:15px;line-height:1.65;">Please provide your buyer details for the property below. Our team will use this information to review your request and prepare the next steps.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border:1px solid #eadfbc;border-radius:10px;background:#fbf9f3;border-collapse:separate;border-spacing:0;">
            <tr><td colspan="2" style="padding:15px 16px 0;color:#97752b;font-size:10px;letter-spacing:1.2px;font-weight:bold;">YOUR PROPERTY</td></tr>
            <tr>
              <td width="57%" valign="top" style="padding:11px 14px 17px 16px;">
                <p style="margin:0;color:#77736b;font-size:11px;font-weight:bold;">PROJECT</p>
                <p style="margin:5px 0 0;color:#1a1c1f;font-size:15px;line-height:1.45;font-weight:bold;overflow-wrap:anywhere;">${project}</p>
              </td>
              <td width="43%" valign="top" style="padding:11px 16px 17px 14px;border-left:1px solid #e9dfc7;">
                <p style="margin:0;color:#77736b;font-size:11px;font-weight:bold;">UNIT</p>
                <p style="margin:5px 0 0;color:#1a1c1f;font-size:15px;line-height:1.45;font-weight:bold;overflow-wrap:anywhere;">${unit}</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:22px 28px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;border-collapse:separate;">
            <tr><td bgcolor="#c69b2f" align="center" style="background:#c69b2f;border-radius:9px;">
              <a href="${href}" style="display:block;padding:16px 14px;color:#0d1015;font-size:15px;font-weight:bold;line-height:1.25;text-align:center;text-decoration:none;">Complete Buyer Information &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:11px 0 0;color:#626972;font-size:12px;line-height:1.5;text-align:center;">Please submit before <strong style="color:#3e4147;">${expiry}</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 28px 30px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;background-color:#f7f8fa;border-left:3px solid #c69b2f;border-collapse:separate;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;color:#303943;font-size:13px;line-height:1.65;"><strong>What happens after submission?</strong><br>Submitting your information places the unit on a temporary hold while our team reviews it. This is <strong>not a final reservation or payment confirmation</strong>.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:21px 24px;background:#fbfaf8;border-top:1px solid #e9e4d8;">
          <p style="margin:0;color:#20232a;font-size:13px;font-weight:bold;">${company}</p>
          <p style="margin:6px 0 0;color:#727783;font-size:11px;line-height:1.6;">Property information &amp; reservation assistance</p>
        </td></tr>
      </table>
      <p style="max-width:570px;margin:15px auto 0;color:#70757d;font-size:11px;line-height:1.6;text-align:center;">If the button doesn't work, copy this address into your browser:</p>
      <p style="max-width:570px;margin:4px auto 0;color:#927021;font-size:11px;line-height:1.5;overflow-wrap:anywhere;word-break:break-all;text-align:center;"><a href="${href}" style="color:#927021;text-decoration:underline;">${href}</a></p>
      <p style="max-width:570px;margin:13px auto 0;color:#81838a;font-size:11px;line-height:1.5;text-align:center;">This link is intended for you. Please do not forward it.</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
};
