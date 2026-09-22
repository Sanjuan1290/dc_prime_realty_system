import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  getUserFullName,
  tableExists,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { isFullAccessAdministrator } from '../../config/permissions.js';
import { normalizeDepartmentConfigs } from './Employees/departmentBarcode.shared.js';
import {
  createSensitiveActionVerification,
  getSensitiveActionRequestIp,
  maskSensitiveActionEmail,
  SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
  verifyAndConsumeSensitiveAction,
} from '../../services/sensitiveActionVerification.service.js';
import {
  buildSettingsVerificationPayload,
  sendSettingsVerificationCodeEmail,
  SETTINGS_VERIFICATION_ENTITY,
  SYSTEM_SETTINGS_ACTION,
} from '../../services/settingsVerification.service.js';

const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
const nullableText = (value) => {
  const clean = cleanText(value);
  return clean || null;
};
const clampDay = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.trunc(numeric), 1), 31);
};

const isExactSuperAdmin = (user) => String(user?.role || '').toLowerCase() === 'super_admin';


const requireAdmin = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error('You must be logged in to manage system settings.');
    error.statusCode = 401;
    throw error;
  }

  if (!isFullAccessAdministrator(user)) {
    const error = new Error('Admin access only.');
    error.statusCode = 403;
    throw error;
  }

  return user;
};


const requireSettingsManager = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error('You must be logged in to manage system settings.');
    error.statusCode = 401;
    throw error;
  }
  if (!isExactSuperAdmin(user)) {
    const error = new Error('Only the exact Super Admin can edit system settings.');
    error.statusCode = 403;
    throw error;
  }
  return user;
};

const systemSettingsTableSql = `
  CREATE TABLE IF NOT EXISTS system_settings (
    system_setting_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    company_name VARCHAR(150) NOT NULL DEFAULT 'D&C Prime Realty',
    company_email VARCHAR(150) NULL,
    company_contact_number VARCHAR(60) NULL,
    company_address TEXT NULL,
    company_tin VARCHAR(80) NULL,
    system_status ENUM('active','maintenance') NOT NULL DEFAULT 'active',
    maintenance_message TEXT NULL,
    reservation_contact_name VARCHAR(150) NULL,
    reservation_contact_email VARCHAR(150) NULL,
    reservation_contact_number VARCHAR(60) NULL,
    default_release_day_one TINYINT UNSIGNED NOT NULL DEFAULT 7,
    default_release_day_two TINYINT UNSIGNED NOT NULL DEFAULT 22,
    attendance_default_time_out TIME NOT NULL DEFAULT '20:00:00',
    attendance_scheduled_time_in TIME NOT NULL DEFAULT '09:00:00',
    attendance_scheduled_time_out TIME NOT NULL DEFAULT '20:00:00',
    attendance_break_start TIME NOT NULL DEFAULT '12:00:00',
    attendance_break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
    attendance_regular_work_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 600,
    attendance_late_after TIME NOT NULL DEFAULT '09:00:00',
    attendance_red_highlight_after TIME NOT NULL DEFAULT '09:15:00',
    employee_departments_json TEXT NULL,
    employee_department_codes_json TEXT NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (system_setting_id),
    KEY fk_system_settings_updated_by (updated_by_user_id),
    CONSTRAINT fk_system_settings_updated_by
      FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const ensureSystemSettingsTable = async (connection = db) => {
  await connection.query(systemSettingsTableSql);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_default_time_out TIME NOT NULL DEFAULT '20:00:00' AFTER default_release_day_two`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_scheduled_time_in TIME NOT NULL DEFAULT '09:00:00' AFTER attendance_default_time_out`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_scheduled_time_out TIME NOT NULL DEFAULT '20:00:00' AFTER attendance_scheduled_time_in`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_break_start TIME NOT NULL DEFAULT '12:00:00' AFTER attendance_scheduled_time_out`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER attendance_break_start`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_regular_work_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 600 AFTER attendance_break_minutes`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_late_after TIME NOT NULL DEFAULT '09:00:00' AFTER attendance_regular_work_minutes`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS attendance_red_highlight_after TIME NOT NULL DEFAULT '09:15:00' AFTER attendance_late_after`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS employee_departments_json TEXT NULL AFTER attendance_red_highlight_after`);
  await connection.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS employee_department_codes_json TEXT NULL AFTER employee_departments_json`);

  // Keep one singleton settings row so every page has a safe default to read.
  await connection.query(
    `
      INSERT INTO system_settings (system_setting_id)
      VALUES (1)
      ON DUPLICATE KEY UPDATE system_setting_id = VALUES(system_setting_id)
    `
  );
};

const mapSettings = (row = {}) => ({
  id: row.system_setting_id,
  companyName: row.company_name,
  companyEmail: row.company_email,
  companyContactNumber: row.company_contact_number,
  companyAddress: row.company_address,
  companyTin: row.company_tin,
  systemStatus: row.system_status,
  maintenanceMessage: row.maintenance_message,
  reservationContactName: row.reservation_contact_name,
  reservationContactEmail: row.reservation_contact_email,
  reservationContactNumber: row.reservation_contact_number,
  defaultReleaseDayOne: Number(row.default_release_day_one || 7),
  defaultReleaseDayTwo: Number(row.default_release_day_two || 22),
  attendanceDefaultTimeOut: String(row.attendance_default_time_out || '20:00:00').slice(0, 8),
  employeeDepartmentCodes: normalizeDepartmentConfigs(row.employee_department_codes_json, row.employee_departments_json),
  employeeDepartments: normalizeDepartmentConfigs(row.employee_department_codes_json, row.employee_departments_json).map((item) => item.name),
  updatedByUserId: row.updated_by_user_id,
  updatedByName: row.updated_by_name || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeSettingsPayload = (body = {}) => ({
  companyName: cleanText(body.companyName, 'D&C Prime Realty'),
  companyEmail: nullableText(body.companyEmail),
  companyContactNumber: nullableText(body.companyContactNumber),
  companyAddress: nullableText(body.companyAddress),
  companyTin: nullableText(body.companyTin),
  systemStatus: body.systemStatus === 'maintenance' ? 'maintenance' : 'active',
  maintenanceMessage: nullableText(body.maintenanceMessage),
  reservationContactName: nullableText(body.reservationContactName),
  reservationContactEmail: nullableText(body.reservationContactEmail),
  reservationContactNumber: nullableText(body.reservationContactNumber),
  defaultReleaseDayOne: clampDay(body.defaultReleaseDayOne, 7),
  defaultReleaseDayTwo: clampDay(body.defaultReleaseDayTwo, 22),
});

const validateSettingsPayload = (payload) => {
  if (!payload.companyName) {
    throw Object.assign(new Error('Company name is required.'), { statusCode: 400 });
  }
  if (payload.systemStatus === 'maintenance' && !payload.maintenanceMessage) {
    throw Object.assign(new Error('Maintenance message is required when maintenance mode is enabled.'), { statusCode: 400 });
  }
  if (payload.defaultReleaseDayOne === payload.defaultReleaseDayTwo) {
    throw Object.assign(new Error('Default release days must be different.'), { statusCode: 400 });
  }
  return payload;
};

const buildSystemSettingsVerificationPayload = ({ actor, settingsPayload, reason }) => buildSettingsVerificationPayload({
  actionType: SYSTEM_SETTINGS_ACTION,
  actorId: actor.id,
  entityId: '1',
  settings: settingsPayload,
  reason,
});

export const getSystemSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await requireAdmin(req);
    await ensureSystemSettingsTable(connection);

    const [rows] = await connection.query(
      `
        SELECT
          ss.*,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS updated_by_name
        FROM system_settings ss
        LEFT JOIN users u ON u.id = ss.updated_by_user_id
        WHERE ss.system_setting_id = 1
        LIMIT 1
      `
    );

    return res.json({
      success: true,
      data: mapSettings(rows[0]),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const requestSystemSettingsCode = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSettingsManager(req);
    if (!actor.email) return res.status(400).json({ message: 'The Super Admin account must have an email address.' });
    await ensureSystemSettingsTable(connection);
    if (!(await tableExists(connection, 'destructive_action_verifications'))) {
      return res.status(500).json({ message: 'Sensitive-action verification table is missing. Apply the latest database schema first.' });
    }

    const reason = cleanText(req.body.reason);
    if (reason.length < 5) return res.status(400).json({ message: 'A clear reason for changing settings is required.' });
    const settingsPayload = validateSettingsPayload(normalizeSettingsPayload(req.body));
    const payload = buildSystemSettingsVerificationPayload({ actor, settingsPayload, reason });

    await connection.beginTransaction();
    const { verificationId, code } = await createSensitiveActionVerification(connection, {
      userId: actor.id,
      actionType: SYSTEM_SETTINGS_ACTION,
      entityType: SETTINGS_VERIFICATION_ENTITY,
      entityId: '1',
      payload,
      reason,
      requestIp: getSensitiveActionRequestIp(req),
    });
    await sendSettingsVerificationCodeEmail({
      actor,
      code,
      scopeLabel: 'System Settings',
      entityLabel: 'Global System Settings',
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
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateSystemSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSettingsManager(req);
    await ensureSystemSettingsTable(connection);

    const payload = validateSettingsPayload(normalizeSettingsPayload(req.body));
    const reason = cleanText(req.body.reason);
    const verificationId = Number(req.body.verificationId || req.body.verification_id || 0);
    const code = cleanText(req.body.code || req.body.verificationCode || req.body.verification_code);
    if (reason.length < 5) return res.status(400).json({ message: 'A clear reason for changing settings is required.' });
    if (!verificationId || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Super Admin password and six-digit email verification are required to save system settings.' });
    }

    await connection.beginTransaction();

    const [beforeRows] = await connection.query(
      `SELECT ss.*, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS updated_by_name
       FROM system_settings ss
       LEFT JOIN users u ON u.id = ss.updated_by_user_id
       WHERE ss.system_setting_id = 1
       LIMIT 1
       FOR UPDATE`
    );
    const before = mapSettings(beforeRows[0] || {});
    const verificationPayload = buildSystemSettingsVerificationPayload({ actor, settingsPayload: payload, reason });
    const verificationResult = await verifyAndConsumeSensitiveAction(connection, {
      verificationId,
      userId: actor.id,
      actionType: SYSTEM_SETTINGS_ACTION,
      entityType: SETTINGS_VERIFICATION_ENTITY,
      entityId: '1',
      code,
      payload: verificationPayload,
    });
    if (!verificationResult.ok) {
      await connection.commit();
      return res.status(verificationResult.statusCode || 400).json({ message: verificationResult.message });
    }

    await connection.query(
      `
        UPDATE system_settings
        SET
          company_name = ?,
          company_email = ?,
          company_contact_number = ?,
          company_address = ?,
          company_tin = ?,
          system_status = ?,
          maintenance_message = ?,
          reservation_contact_name = ?,
          reservation_contact_email = ?,
          reservation_contact_number = ?,
          default_release_day_one = ?,
          default_release_day_two = ?,
          updated_by_user_id = ?
        WHERE system_setting_id = 1
      `,
      [
        payload.companyName,
        payload.companyEmail,
        payload.companyContactNumber,
        payload.companyAddress,
        payload.companyTin,
        payload.systemStatus,
        payload.maintenanceMessage,
        payload.reservationContactName,
        payload.reservationContactEmail,
        payload.reservationContactNumber,
        payload.defaultReleaseDayOne,
        payload.defaultReleaseDayTwo,
        actor.id,
      ]
    );

    await writeAuditLog(connection, req, {
      actor,
      action: 'update',
      module: 'System Settings',
      entityType: 'system_settings',
      entityId: '1',
      entityLabel: payload.companyName || 'Global system settings',
      title: 'Updated system settings',
      description: `${getUserFullName(actor)} updated global system settings.`,
      metadata: {
        reason,
        verificationId,
        verificationMethod: 'super_admin_password_email_code',
        before,
        after: payload,
        releaseDayChangesApplyProspectively: true,
      },
    });

    await connection.commit();

    const [rows] = await connection.query(
      `
        SELECT
          ss.*,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS updated_by_name
        FROM system_settings ss
        LEFT JOIN users u ON u.id = ss.updated_by_user_id
        WHERE ss.system_setting_id = 1
        LIMIT 1
      `
    );

    return res.json({
      success: true,
      message: 'System settings saved successfully.',
      data: mapSettings(rows[0]),
    });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
