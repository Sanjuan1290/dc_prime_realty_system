import bcrypt from 'bcrypt';
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
import { createProtectedChangeRequest, consumeProtectedChange } from '../../../services/protectedChange.service.js';
import { assertEntityNotReviewLocked, createOperationalReview } from '../../../services/operationalReview.service.js';
import { getPendingAuditCorrectionCase, advanceAuditCaseToRecheck } from '../../../services/auditCaseAuthorization.service.js';
import { notifySystemAdmins } from '../../../services/internalNotification.service.js';
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
const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
const toBoolean = (value) => value === true || value === 1 || String(value ?? '').toLowerCase() === 'true' || String(value ?? '') === '1';
const canEditProjectSettings = (user) => roleHasPermission(user, PERMISSIONS.LOT_SETTINGS_MANAGE);
const PROJECT_SETTINGS_REVIEW_ACTION = 'project.settings.update';
const PROJECT_SETTINGS_REVIEW_ENTITY = 'lot_project_settings';
const PROJECT_SETTINGS_DEPARTMENT = 'operations';

const ensureProjectPaymentNotificationColumn = async (connection) => {
  await connection.query(`ALTER TABLE lot_project_settings ADD COLUMN IF NOT EXISTS payment_entry_email_notification_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER company_contact_number`);
};

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
    paymentEntryEmailNotificationEnabled: toBoolean(body.paymentEntryEmailNotificationEnabled),
  };

  if (!payload.reservationContactName) {
    throw Object.assign(new Error('Reservation contact name is required.'), { statusCode: 400 });
  }
  if (!payload.companyName) {
    throw Object.assign(new Error('Company name is required.'), { statusCode: 400 });
  }
  if (payload.paymentEntryEmailNotificationEnabled && !isValidEmailAddress(payload.companyEmail)) {
    throw Object.assign(new Error('Enter a valid Project Company Email before enabling payment entry notifications.'), { statusCode: 400, code: 'PROJECT_COMPANY_EMAIL_REQUIRED_FOR_PAYMENT_NOTIFICATIONS' });
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
  paymentEntryEmailNotificationEnabled: Boolean(Number(row.payment_entry_email_notification_enabled || 0)),
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
    await ensureProjectPaymentNotificationColumn(connection);

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
    if (!actor?.id) return res.status(401).json({ success: false, message: 'Please login before authorizing project settings.' });
    if (!canEditProjectSettings(actor)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this project settings.' });
    }

    const slug = clean(req.params.projectSlug);
    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ success: false, message: 'Lot project not found.' });
    if (!(await tableExists(connection, 'lot_project_settings'))) {
      return res.status(500).json({ success: false, message: 'lot_project_settings table does not exist.' });
    }
    await ensureProjectPaymentNotificationColumn(connection);

    const reason = clean(req.body.reason);
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'A clear reason for changing settings is required.' });
    const settingsPayload = normalizeProjectSettingsPayload(req.body);
    const governedPayload = buildProjectSettingsVerificationPayload({ actor, project, settingsPayload, reason });
    const auditCaseId = Number(req.body.auditCaseId || req.body.audit_case_id || 0);

    await connection.beginTransaction();

    if (actor.role === 'system_admin' || (actor.role === 'super_admin' && Number(req.body?.auditCaseId || req.body?.audit_case_id || 0) > 0)) {
      const auditCase = await getPendingAuditCorrectionCase(connection, {
        actor: req.authUser,
        auditCaseId,
        entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
        entityId: project.lot_project_id,
      });
      if (!auditCase) throw Object.assign(new Error('Open this project-settings correction from a valid Auditor-approved case.'), { statusCode: 409, code: 'AUDIT_CASE_REQUIRED' });
      await connection.commit();
      return res.json({
        success: true,
        message: 'Auditor-approved correction case verified. Continue to Final Review.',
        data: { authorizationType: 'audit_case', approved: true, auditCaseId: auditCase.audit_case_id },
      });
    }

    if (actor.role === 'operations_head') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Operations Head authority verified. Continue to Final Review.',
        data: { authorizationType: 'department_head', approved: true, headUserId: actor.id },
      });
    }

    if (actor.role === 'operations_staff') {
      const approval = await createProtectedChangeRequest(connection, {
        actor,
        actionKey: PROJECT_SETTINGS_REVIEW_ACTION,
        department: PROJECT_SETTINGS_DEPARTMENT,
        projectId: project.lot_project_id,
        entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
        entityId: project.lot_project_id,
        entityLabel: `${project.lot_project_name} Settings`,
        payload: governedPayload,
        reason,
      });
      await connection.commit();
      const approved = approval.status === 'approved';
      return res.status(approved ? 200 : 202).json({
        success: true,
        message: approved
          ? 'Operations Head approval is ready. Continue to Final Review.'
          : `${approval.requestNumber || 'Approval request'} is waiting for Operations Head review.`,
        data: {
          authorizationType: 'head_approval',
          approved,
          approvalRequestId: approval.requestId || null,
          requestNumber: approval.requestNumber || null,
          status: approval.status,
        },
      });
    }

    if (actor.role !== 'super_admin') {
      throw Object.assign(new Error('This protected settings change requires Operations Staff/Head, System Admin correction authority, or Super Admin emergency access.'), { statusCode: 403 });
    }

    if (!actor.email) throw Object.assign(new Error('Your Super Admin account must have an email address before emergency authorization can be used.'), { statusCode: 400 });
    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      throw Object.assign(new Error('Sensitive-action verification table is missing. Apply the latest database schema first.'), { statusCode: 500 });
    }
    const password = String(req.body.password || '');
    if (!actor.password_hash || !(await bcrypt.compare(password, actor.password_hash))) {
      throw Object.assign(new Error('Super Admin password is incorrect.'), { statusCode: 401 });
    }

    const { verificationId, code } = await createSensitiveActionVerification(connection, {
      userId: actor.id,
      actionType: LOT_PROJECT_SETTINGS_ACTION,
      entityType: SETTINGS_VERIFICATION_ENTITY,
      entityId: project.lot_project_id,
      payload: governedPayload,
      reason,
      requestIp: getSensitiveActionRequestIp(req),
    });
    await sendSettingsVerificationCodeEmail({
      actor,
      code,
      scopeLabel: 'Lot Project Settings Emergency Override',
      entityLabel: project.lot_project_name || project.lot_project_slug || 'Lot Project',
      reason,
      settings: settingsPayload,
    });
    await connection.commit();

    return res.json({
      success: true,
      message: `Emergency verification code sent to ${maskSensitiveActionEmail(actor.email)}.`,
      data: {
        authorizationType: 'super_admin_emergency',
        verificationId,
        maskedEmail: maskSensitiveActionEmail(actor.email),
        expiresInMinutes: SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error), code: error.code || undefined });
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
    await ensureProjectPaymentNotificationColumn(connection);

    const currentUser = req.authUser || await getAuthenticatedUser(req);
    if (!currentUser) return res.status(401).json({ success: false, message: 'Please login before updating settings.' });
    if (!canEditProjectSettings(currentUser)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this project settings.' });
    }

    const settingsPayload = normalizeProjectSettingsPayload(req.body);
    const reason = clean(req.body.reason || 'Authorized project settings update.');
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'A clear reason for changing settings is required.' });
    const governedPayload = buildProjectSettingsVerificationPayload({ actor: currentUser, project, settingsPayload, reason });
    const approvalRequestId = Number(req.body.approvalRequestId || req.body.approval_request_id || 0);
    const auditCaseId = Number(req.body.auditCaseId || req.body.audit_case_id || 0);

    await connection.beginTransaction();

    let authorizationType = '';
    let headPreApprovedByUserId = null;
    let auditCase = null;
    let verificationId = null;

    if (currentUser.role === 'system_admin' || (currentUser.role === 'super_admin' && Number(req.body?.auditCaseId || req.body?.audit_case_id || 0) > 0)) {
      auditCase = await getPendingAuditCorrectionCase(connection, {
        actor: req.authUser,
        auditCaseId,
        entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
        entityId: project.lot_project_id,
      });
      if (!auditCase) throw Object.assign(new Error('A valid Auditor-approved case is required for this controlled project-settings correction.'), { statusCode: 409, code: 'AUDIT_CASE_REQUIRED' });
      authorizationType = 'audit_case';
    } else if (currentUser.role === 'operations_head') {
      authorizationType = 'department_head';
      headPreApprovedByUserId = currentUser.id;
    } else if (currentUser.role === 'operations_staff') {
      if (!approvalRequestId) throw Object.assign(new Error('Operations Head approval is required before this settings change can be saved.'), { statusCode: 409, code: 'HEAD_APPROVAL_REQUIRED' });
      const approval = await consumeProtectedChange(connection, {
        requestId: approvalRequestId,
        actor: currentUser,
        actionKey: PROJECT_SETTINGS_REVIEW_ACTION,
        entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
        entityId: project.lot_project_id,
        payload: governedPayload,
      });
      authorizationType = 'head_approval';
      headPreApprovedByUserId = Number(approval.reviewed_by_head_user_id || 0) || null;
    } else if (currentUser.role === 'super_admin') {
      if (!(await tableExists(connection, 'destructive_action_verifications'))) {
        throw Object.assign(new Error('Sensitive-action verification table is missing. Apply the latest database schema first.'), { statusCode: 500 });
      }
      verificationId = Number(req.body.verificationId || req.body.verification_id || 0);
      const verificationCode = clean(req.body.code || req.body.verificationCode || req.body.verification_code);
      if (!verificationId || !/^\d{6}$/.test(verificationCode)) {
        throw Object.assign(new Error('A valid emergency verification request and 6-digit code are required.'), { statusCode: 400 });
      }
      const verificationResult = await verifyAndConsumeSensitiveAction(connection, {
        verificationId,
        userId: currentUser.id,
        actionType: LOT_PROJECT_SETTINGS_ACTION,
        entityType: SETTINGS_VERIFICATION_ENTITY,
        entityId: project.lot_project_id,
        code: verificationCode,
        payload: governedPayload,
      });
      if (!verificationResult.ok) throw Object.assign(new Error(verificationResult.message), { statusCode: verificationResult.statusCode || 400 });
      authorizationType = 'super_admin_emergency';
      headPreApprovedByUserId = currentUser.id;
    } else {
      throw Object.assign(new Error('Your role cannot authorize this protected settings change.'), { statusCode: 403 });
    }

    await assertEntityNotReviewLocked(connection, { actor: req.authUser,
      entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
      entityId: project.lot_project_id,
      allowReviewId: auditCase?.operational_review_id || null,
    });

    const beforeRow = await getOrCreateSettingsRow(connection, project);
    const before = mapSettings(beforeRow, project);

    await connection.query(
      `INSERT INTO lot_project_settings (
        lot_project_id, release_day_one, release_day_two,
        reservation_contact_name, reservation_contact_email, reservation_contact_number,
        company_name, company_email, company_contact_number,
        payment_entry_email_notification_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        release_day_one = VALUES(release_day_one),
        release_day_two = VALUES(release_day_two),
        reservation_contact_name = VALUES(reservation_contact_name),
        reservation_contact_email = VALUES(reservation_contact_email),
        reservation_contact_number = VALUES(reservation_contact_number),
        company_name = VALUES(company_name),
        company_email = VALUES(company_email),
        company_contact_number = VALUES(company_contact_number),
        payment_entry_email_notification_enabled = VALUES(payment_entry_email_notification_enabled)`,
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
        settingsPayload.paymentEntryEmailNotificationEnabled ? 1 : 0,
      ]
    );

    const after = { ...settingsPayload, lotProjectId: project.lot_project_id };
    let review = null;
    if (auditCase) {
      review = await advanceAuditCaseToRecheck(connection, {
        auditCase,
        actor: currentUser,
        correctionSummary: reason,
        afterSnapshot: after,
        metadata: { authorizationType, projectId: project.lot_project_id },
        notificationTitle: `Project Settings correction needs Auditor recheck · ${project.lot_project_name}`,
      });
    } else {
      review = await createOperationalReview(connection, {
        actor: currentUser,
        actionKey: PROJECT_SETTINGS_REVIEW_ACTION,
        department: PROJECT_SETTINGS_DEPARTMENT,
        projectId: project.lot_project_id,
        entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
        entityId: project.lot_project_id,
        entityLabel: `${project.lot_project_name} Settings`,
        beforeSnapshot: before,
        afterSnapshot: after,
        headPreApprovedByUserId,
      });
    }

    if (authorizationType === 'super_admin_emergency') {
      await notifySystemAdmins(connection, {
        reviewId: review?.reviewId || null,
        type: 'super_admin_emergency_override',
        title: `Emergency override used · ${project.lot_project_name} Settings`,
        message: `${getUserFullName(currentUser) || currentUser.email || 'Super Admin'} changed protected Project Settings using emergency authorization. Reason: ${reason}`,
      });
    }

    await writeAuditLog(connection, req, {
      actor: currentUser,
      action: 'update',
      module: 'Project Settings',
      entityType: PROJECT_SETTINGS_REVIEW_ENTITY,
      entityId: project.lot_project_id,
      entityLabel: project.lot_project_name,
      title: 'Updated lot project settings',
      description: `${getUserFullName(currentUser) || currentUser.email || 'Authorized user'} updated settings for ${project.lot_project_name}.`,
      metadata: {
        reason,
        before,
        after,
        authorizationType,
        approvalRequestId: approvalRequestId || null,
        auditCaseId: auditCase?.audit_case_id || null,
        verificationId: verificationId || null,
        operationalReviewId: review?.reviewId || auditCase?.operational_review_id || null,
        releaseDayChangesApplyProspectively: true,
      },
    });

    await connection.commit();
    const settings = await getOrCreateSettingsRow(connection, project);
    return res.json({
      success: true,
      message: auditCase ? 'Project settings correction saved. Auditor has been notified for final recheck.' : 'Project settings saved and sent for independent audit review.',
      data: mapSettings(settings, project),
      review,
      canEdit: true,
    });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error), code: error.code || undefined });
  } finally {
    connection.release();
  }
};


