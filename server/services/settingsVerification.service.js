import { sendEmail } from './email.service.js';

const clean = (value = '') => String(value ?? '').trim();
const escapeHtml = (value = '') => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const LOT_PROJECT_SETTINGS_ACTION = 'lot_project_settings_update';
export const SYSTEM_SETTINGS_ACTION = 'system_settings_update';
export const SETTINGS_VERIFICATION_ENTITY = 'settings';

export const buildSettingsVerificationPayload = ({
  actionType,
  actorId,
  entityId,
  settings,
  reason,
}) => ({
  action: clean(actionType),
  actorId: Number(actorId || 0),
  entityId: clean(entityId),
  reason: clean(reason),
  settings: settings && typeof settings === 'object' ? settings : {},
});

const settingValue = (settings = {}, key, fallback = '-') => {
  const value = settings?.[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
};

export const sendSettingsVerificationCodeEmail = async ({
  actor,
  code,
  scopeLabel,
  entityLabel,
  reason,
  settings,
}) => {
  const companyName = clean(process.env.COMPANY_NAME) || 'D&C Prime Realty';
  const actorName = clean([actor?.first_name, actor?.middle_name, actor?.last_name].filter(Boolean).join(' ')) || 'Super Admin';
  const releaseOne = settingValue(settings, 'releaseDayOne', settingValue(settings, 'defaultReleaseDayOne'));
  const releaseTwo = settingValue(settings, 'releaseDayTwo', settingValue(settings, 'defaultReleaseDayTwo'));
  const systemStatus = settingValue(settings, 'systemStatus', '');

  const details = [
    `Scope: ${scopeLabel}`,
    `Settings: ${entityLabel}`,
    `Release day 1: ${releaseOne}`,
    `Release day 2: ${releaseTwo}`,
    ...(systemStatus ? [`System status: ${systemStatus}`] : []),
    `Reason: ${reason}`,
  ];

  await sendEmail({
    to: actor.email,
    subject: `Settings change verification code - ${entityLabel}`,
    text: [
      `Hello ${actorName},`,
      '',
      `Your verification code is ${code}.`,
      ...details,
      '',
      'This code authorizes only the exact settings values reviewed in the portal. If any setting changes, request a new code.',
      '',
      companyName,
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>${escapeHtml(companyName)}</h2><p>Hello ${escapeHtml(actorName)},</p><p>Use this code to authorize the reviewed <strong>${escapeHtml(scopeLabel)}</strong> settings change.</p><div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:18px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;text-align:center">${escapeHtml(code)}</div><p><strong>Settings:</strong> ${escapeHtml(entityLabel)}<br/><strong>Release day 1:</strong> ${escapeHtml(releaseOne)}<br/><strong>Release day 2:</strong> ${escapeHtml(releaseTwo)}${systemStatus ? `<br/><strong>System status:</strong> ${escapeHtml(systemStatus)}` : ''}<br/><strong>Reason:</strong> ${escapeHtml(reason)}</p><p style="color:#92400e"><strong>This code is bound to the exact reviewed settings payload. If any value changes, request a new code.</strong></p></div>`,
  });
};
