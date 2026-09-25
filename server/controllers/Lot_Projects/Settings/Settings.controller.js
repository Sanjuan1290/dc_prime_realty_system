import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getAuthenticatedUser,
  getUserFullName,
  toNullable,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { PERMISSIONS, roleHasPermission } from '../../../config/permissions.js';
import {
  createSensitiveActionVerification,
  getSensitiveActionRequestIp,
  maskSensitiveActionEmail,
  SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
  verifyAndConsumeSensitiveAction,
} from '../../../services/sensitiveActionVerification.service.js';
import {
  buildSettingsVerificationPayload,
  LOT_PROJECT_SETTINGS_ACTION,
  sendSettingsVerificationCodeEmail,
  SETTINGS_VERIFICATION_ENTITY,
} from '../../../services/settingsVerification.service.js';

const toDay = (value, fallback) => {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < 1 || number > 31) return fallback;
  return number;
};

const clean = (value = '') => String(value ?? '').trim();
const canEditProjectSettings = (user) => roleHasPermission(user, PERMISSIONS.LOT_SETTINGS_MANAGE);

const normalizeProjectSettingsPayload = (body = {}) => {
  const releaseDayOne = toDay(body.releaseDayOne ?? body.release_day_one, 7);
  const releaseDayTwo = toDay(body.releaseDayTwo ?? body.release_day_two, 22);

  if (releaseDayOne === releaseDayTwo) {
    throw Object.assign(new Error('Release days must be different.'), { statusCode: 400 });
  }

  const payload = {
    releaseDayOne,
    releaseDayTwo,
    reservationContactName: toNullable(body.reservationContactName),
    reservationContactEmail: toNullable(body.reservationContactEmail),
    reservationContactNumber: toNullable(body.reservationContactNumber),
    companyName: toNullable(body.companyName),
    companyEmail: toNullable(body.companyEmail),
    companyContactNumber: toNullable(body.companyContactNumber),
  };

  if (!payload.reservationContactName) {
    throw Object.assign(new Error('Reservation contact name is required.'), { statusCode: 400 });
  }
  if (!payload.companyName) {
    throw Object.assign(new Error('Company name is required.'), { statusCode: 400 });
  }

  return payload;
};

const buildProjectSettingsVerificationPayload = ({ actor, project, settingsPayload, reason }) => buildSettingsVerificationPayload({
  actionType: LOT_PROJECT_SETTINGS_ACTION,
  actorId: actor.id,
  entityId: project.lot_project_id,
  settings: settingsPayload,
  reason,
});

const mapSettings = (row = {}, project = {}) => ({
  id: row.lot_project_setting_id || null,
  lotProjectId: project.lot_project_id,
  releaseDayOne: String(row.release_day_one || 7),
  releaseDayTwo: String(row.release_day_two || 22),
  reservationContactName: row.reservation_contact_name || project.lot_project_administrator_name || 'D&C Prime Realty',
  reservationContactEmail: row.reservation_contact_email || '',
  reservationContactNumber: row.reservation_contact_number || '',
  companyName: row.company_name || 'D&C Prime Realty',
  companyEmail: row.company_email || '',
  companyContactNumber: row.company_contact_number || '',
  createdAt: row.lot_project_setting_created_at || null,
  updatedAt: row.lot_project_setting_updated_at || null,
});

const getOrCreateSettingsRow = async (connection, project) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_settings
      WHERE lot_project_id = ?
      LIMIT 1
    `,
    [project.lot_project_id]
  );

  if (rows[0]) return rows[0];

  await connection.query(
    `
      INSERT INTO lot_project_settings (
        lot_project_id,
        release_day_one,
        release_day_two,
        reservation_contact_name,
        reservation_contact_email,
        reservation_contact_number,
        company_name,
        company_email,
        company_contact_number
      ) VALUES (?, 7, 22, ?, NULL, NULL, 'D&C Prime Realty', NULL, NULL)
    `,
    [project.lot_project_id, project.lot_project_administrator_name || 'D&C Prime Realty']
  );

  const [createdRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_settings
      WHERE lot_project_id = ?
      LIMIT 1
    `,
    [project.lot_project_id]
  );

  return createdRows[0] || {};
};

export const getLotProjectSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_settings'))) {
      return res.status(500).json({ success: false, message: 'lot_project_settings table does not exist.' });
    }

    const currentUser = await getAuthenticatedUser(req);
    const settings = await getOrCreateSettingsRow(connection, project);

    return res.json({
      success: true,
      data: mapSettings(settings, project),
      canEdit: canEditProjectSettings(currentUser),
      project: {
        id: project.lot_project_id,
        name: project.lot_project_name,
        slug: project.lot_project_slug,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const requestLotProjectSettingsCode = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = req.authUser || await getAuthenticatedUser(req);
    if (!actor?.id || !actor.email) {
      return res.status(400).json({ success: false, message: 'Your account must have an email address before protected project settings can be changed.' });
    }
    if (!canEditProjectSettings(actor)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this project settings.' });
    }
    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      return res.status(500).json({ success: false, message: 'Sensitive-action verification table is missing. Apply the latest database schema first.' });
    }

    const slug = clean(req.params.projectSlug);
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ success: false, message: 'Lot project not found.' });

    const reason = clean(req.body.reason);
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'A clear reason for changing settings is required.' });
    const settingsPayload = normalizeProjectSettingsPayload(req.body);
    const payload = buildProjectSettingsVerificationPayload({ actor, project, settingsPayload, reason });

    await connection.beginTransaction();
    const { verificationId, code } = await createSensitiveActionVerification(connection, {
      userId: actor.id,
      actionType: LOT_PROJECT_SETTINGS_ACTION,
      entityType: SETTINGS_VERIFICATION_ENTITY,
      entityId: project.lot_project_id,
      payload,
      reason,
      requestIp: getSensitiveActionRequestIp(req),
    });
    await sendSettingsVerificationCodeEmail({
      actor,
      code,
      scopeLabel: 'Lot Project Settings',
      entityLabel: project.lot_project_name || project.lot_project_slug || 'Lot Project',
      reason,
      settings: settingsPayload,
    });
    await connection.commit();

    return res.json({
      success: true,
      message: `A verification code was sent to ${maskSensitiveActionEmail(actor.email)}.`,
      data: {
        verificationId,
        maskedEmail: maskSensitiveActionEmail(actor.email),
        expiresInMinutes: SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProjectSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ success: false, message: 'Lot project not found.' });
    if (!(await tableExists(connection, 'lot_project_settings'))) {
      return res.status(500).json({ success: false, message: 'lot_project_settings table does not exist.' });
    }

    const currentUser = req.authUser || await getAuthenticatedUser(req);
    if (!currentUser) return res.status(401).json({ success: false, message: 'Please login before updating settings.' });
    if (!canEditProjectSettings(currentUser)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this project settings.' });
    }

    const settingsPayload = normalizeProjectSettingsPayload(req.body);
    const reason = clean(req.body.reason || 'Authorized project settings update.');
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'A clear reason for changing settings is required.' });

    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      return res.status(500).json({ success: false, message: 'Sensitive-action verification table is missing. Apply the latest database schema first.' });
    }

    const verificationId = Number(req.body.verificationId || req.body.verification_id || 0);
    const verificationCode = clean(req.body.code || req.body.verificationCode || req.body.verification_code);
    if (!verificationId || !/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ success: false, message: 'A valid settings verification request and 6-digit code are required.' });
    }

    const verificationPayload = buildProjectSettingsVerificationPayload({
      actor: currentUser,
      project,
      settingsPayload,
      reason,
    });

    await connection.beginTransaction();
    const verificationResult = await verifyAndConsumeSensitiveAction(connection, {
      verificationId,
      userId: currentUser.id,
      actionType: LOT_PROJECT_SETTINGS_ACTION,
      entityType: SETTINGS_VERIFICATION_ENTITY,
      entityId: project.lot_project_id,
      code: verificationCode,
      payload: verificationPayload,
    });
    if (!verificationResult.ok) {
      await connection.rollback();
      return res.status(verificationResult.statusCode || 400).json({ success: false, message: verificationResult.message });
    }

    const beforeRow = await getOrCreateSettingsRow(connection, project);
    const before = mapSettings(beforeRow, project);

    await connection.query(
      `INSERT INTO lot_project_settings (
        lot_project_id, release_day_one, release_day_two,
        reservation_contact_name, reservation_contact_email, reservation_contact_number,
        company_name, company_email, company_contact_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        release_day_one = VALUES(release_day_one),
        release_day_two = VALUES(release_day_two),
        reservation_contact_name = VALUES(reservation_contact_name),
        reservation_contact_email = VALUES(reservation_contact_email),
        reservation_contact_number = VALUES(reservation_contact_number),
        company_name = VALUES(company_name),
        company_email = VALUES(company_email),
        company_contact_number = VALUES(company_contact_number)`,
      [
        project.lot_project_id,
        settingsPayload.releaseDayOne,
        settingsPayload.releaseDayTwo,
        settingsPayload.reservationContactName,
        settingsPayload.reservationContactEmail,
        settingsPayload.reservationContactNumber,
        settingsPayload.companyName,
        settingsPayload.companyEmail,
        settingsPayload.companyContactNumber,
      ]
    );

    await writeAuditLog(connection, req, {
      actor: currentUser,
      action: 'update',
      module: 'Project Settings',
      entityType: 'lot_project_settings',
      entityId: project.lot_project_id,
      entityLabel: project.lot_project_name,
      title: 'Updated lot project settings',
      description: `${getUserFullName(currentUser) || currentUser.email || 'Authorized user'} updated settings for ${project.lot_project_name}.`,
      metadata: { reason, before, after: settingsPayload, verificationId, releaseDayChangesApplyProspectively: true },
    });

    await connection.commit();
    const settings = await getOrCreateSettingsRow(connection, project);
    return res.json({ success: true, message: 'Project settings saved successfully.', data: mapSettings(settings, project), canEdit: true });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
