import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  getUserFullName,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import { writeAuditLog } from './auditLogs.controller.js';

const adminRoles = new Set(['super_admin', 'admin']);

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


const requireAdmin = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error('You must be logged in to manage system settings.');
    error.statusCode = 401;
    throw error;
  }

  if (!adminRoles.has(user.role)) {
    const error = new Error('Admin access only.');
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

export const updateSystemSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireAdmin(req);
    await ensureSystemSettingsTable(connection);

    const payload = normalizeSettingsPayload(req.body);

    if (!payload.companyName) return res.status(400).json({ message: 'Company name is required.' });
    if (payload.systemStatus === 'maintenance' && !payload.maintenanceMessage) {
      return res.status(400).json({ message: 'Maintenance message is required when maintenance mode is enabled.' });
    }

    await connection.beginTransaction();

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
      metadata: payload,
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
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
