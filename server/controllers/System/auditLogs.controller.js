import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  getUserFullName,
} from '../Lot_Projects/_shared/lotProject.shared.js';

const adminRoles = new Set(['super_admin', 'admin']);
const allowedActions = new Set([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'send',
  'approve',
  'reject',
  'release',
  'system',
  'view',
]);

const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
const clampLimit = (value) => Math.min(Math.max(Number(value || 10), 5), 100);
const safeJsonString = (value) => {
  if (value === undefined || value === null || value === '') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ note: 'Unable to serialize metadata.' });
  }
};

const parseMetadata = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return { raw: String(value) };
  }
};

const normalizeAction = (value) => {
  const action = String(value || '').trim().toLowerCase();
  return allowedActions.has(action) ? action : 'system';
};

const buildLike = (value) => `%${String(value || '').trim()}%`;

const summaryCache = {
  expiresAt: 0,
  data: null,
};

const getCachedSummaryAndModules = async (connection) => {
  const now = Date.now();
  if (summaryCache.data && summaryCache.expiresAt > now) return summaryCache.data;

  const [[summaryRow]] = await connection.query(
    `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(action = 'create'), 0) AS created,
        COALESCE(SUM(action = 'update'), 0) AS updated,
        COALESCE(SUM(action = 'delete'), 0) AS deleted,
        COALESCE(SUM(audit_log_created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)), 0) AS last24Hours
      FROM audit_logs
    `
  );

  const [moduleRows] = await connection.query(
    `
      SELECT module, COUNT(*) AS total
      FROM audit_logs
      GROUP BY module
      ORDER BY module ASC
    `
  );

  summaryCache.data = {
    summary: {
      total: Number(summaryRow.total || 0),
      created: Number(summaryRow.created || 0),
      updated: Number(summaryRow.updated || 0),
      deleted: Number(summaryRow.deleted || 0),
      last24Hours: Number(summaryRow.last24Hours || 0),
    },
    modules: moduleRows.map((row) => ({
      module: row.module,
      total: Number(row.total || 0),
    })),
  };
  summaryCache.expiresAt = now + 45 * 1000;

  return summaryCache.data;
};

const requireAdmin = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error('You must be logged in to view audit logs.');
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

export const auditLogTableSql = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id INT UNSIGNED NULL,
    actor_name VARCHAR(255) NULL,
    actor_email VARCHAR(150) NULL,
    actor_role VARCHAR(80) NULL,
    action ENUM('create','update','delete','login','logout','send','approve','reject','release','system','view') NOT NULL DEFAULT 'system',
    module VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(120) NULL,
    entity_label VARCHAR(255) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    metadata_json JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    audit_log_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_id),
    KEY idx_audit_action (action),
    KEY idx_audit_module (module),
    KEY idx_audit_entity (entity_type, entity_id),
    KEY idx_audit_module_action (module, action),
    KEY idx_audit_actor (actor_user_id),
    KEY idx_audit_created (audit_log_created_at),
    CONSTRAINT fk_audit_actor
      FOREIGN KEY (actor_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

export const ensureAuditLogTable = async (connection = db) => {
  await connection.query(auditLogTableSql);
};

export const writeAuditLog = async (connection = db, req, payload = {}) => {
  await ensureAuditLogTable(connection);

  const actor = payload.actor || (req ? await getAuthenticatedUser(req) : null);
  const metadata = safeJsonString(payload.metadata || payload.metadataJson || null);

  await connection.query(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        actor_name,
        actor_email,
        actor_role,
        action,
        module,
        entity_type,
        entity_id,
        entity_label,
        title,
        description,
        metadata_json,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      actor?.id || null,
      actor ? getUserFullName(actor) : cleanText(payload.actorName, 'System'),
      actor?.email || payload.actorEmail || null,
      actor?.role || payload.actorRole || null,
      normalizeAction(payload.action),
      cleanText(payload.module, 'System'),
      cleanText(payload.entityType) || null,
      cleanText(payload.entityId) || null,
      cleanText(payload.entityLabel) || null,
      cleanText(payload.title, 'System activity'),
      cleanText(payload.description) || null,
      metadata,
      req?.ip || req?.headers?.['x-forwarded-for'] || null,
      String(req?.headers?.['user-agent'] || '').slice(0, 255) || null,
    ]
  );
};

const mapAuditLog = (row = {}) => ({
  id: row.audit_log_id,
  auditLogId: row.audit_log_id,
  actorUserId: row.actor_user_id,
  actorName: row.actor_name || row.user_full_name || 'System',
  actorEmail: row.actor_email || row.user_email || null,
  actorRole: row.actor_role || row.user_role || null,
  action: row.action,
  module: row.module,
  entityType: row.entity_type,
  entityId: row.entity_id,
  entityLabel: row.entity_label,
  title: row.title,
  description: row.description,
  metadata: parseMetadata(row.metadata_json),
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  createdAt: row.audit_log_created_at,
});

export const getAuditLogs = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await requireAdmin(req);
    await ensureAuditLogTable(connection);

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = clampLimit(req.query.limit);
    const offset = (page - 1) * limit;

    const conditions = [];
    const values = [];

    if (cleanText(req.query.search)) {
      conditions.push(`(
        al.title LIKE ? OR
        al.description LIKE ? OR
        al.module LIKE ? OR
        al.entity_type LIKE ? OR
        al.entity_id LIKE ? OR
        al.entity_label LIKE ? OR
        al.actor_name LIKE ? OR
        al.actor_email LIKE ?
      )`);
      values.push(...Array(8).fill(buildLike(req.query.search)));
    }

    if (cleanText(req.query.action) && req.query.action !== 'all') {
      conditions.push('al.action = ?');
      values.push(normalizeAction(req.query.action));
    }

    if (cleanText(req.query.module) && req.query.module !== 'all') {
      conditions.push('al.module = ?');
      values.push(cleanText(req.query.module));
    }

    if (cleanText(req.query.from)) {
      conditions.push('DATE(al.audit_log_created_at) >= ?');
      values.push(cleanText(req.query.from));
    }

    if (cleanText(req.query.to)) {
      conditions.push('DATE(al.audit_log_created_at) <= ?');
      values.push(cleanText(req.query.to));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await connection.query(
      `
        SELECT
          al.*,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS user_full_name,
          u.email AS user_email,
          u.role AS user_role
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.actor_user_id
        ${whereSql}
        ORDER BY al.audit_log_created_at DESC, al.audit_log_id DESC
        LIMIT ? OFFSET ?
      `,
      [...values, limit, offset]
    );

    const [[totalRow]] = await connection.query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${whereSql}`,
      values
    );

    const { summary, modules } = await getCachedSummaryAndModules(connection);

    return res.json({
      success: true,
      data: rows.map(mapAuditLog),
      summary,
      modules,
      pagination: {
        page,
        limit,
        total: Number(totalRow.total || 0),
        totalPages: Math.max(Math.ceil(Number(totalRow.total || 0) / limit), 1),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createAuditLog = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireAdmin(req);
    await ensureAuditLogTable(connection);

    const payload = {
      actor,
      action: normalizeAction(req.body.action || 'system'),
      module: cleanText(req.body.module, 'Manual Entry'),
      entityType: cleanText(req.body.entityType) || null,
      entityId: cleanText(req.body.entityId) || null,
      entityLabel: cleanText(req.body.entityLabel) || null,
      title: cleanText(req.body.title),
      description: cleanText(req.body.description),
      metadata: req.body.metadata || null,
    };

    if (!payload.title) {
      return res.status(400).json({ message: 'Audit title is required.' });
    }

    await writeAuditLog(connection, req, payload);

    return res.status(201).json({
      success: true,
      message: 'Audit log entry added successfully.',
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deleteAuditLog = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireAdmin(req);
    await ensureAuditLogTable(connection);

    const auditLogId = Number(req.params.auditLogId);
    if (!auditLogId) return res.status(400).json({ message: 'Audit log ID is required.' });

    const [rows] = await connection.query(
      `SELECT * FROM audit_logs WHERE audit_log_id = ? LIMIT 1`,
      [auditLogId]
    );

    const log = rows[0];
    if (!log) return res.status(404).json({ message: 'Audit log not found.' });

    await connection.beginTransaction();
    await connection.query(`DELETE FROM audit_logs WHERE audit_log_id = ?`, [auditLogId]);

    await writeAuditLog(connection, req, {
      actor,
      action: 'delete',
      module: 'Audit Logs',
      entityType: 'audit_log',
      entityId: String(auditLogId),
      title: 'Deleted audit log entry',
      description: `Deleted audit entry: ${log.title}`,
      metadata: { deletedAuditLogId: auditLogId, deletedTitle: log.title },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Audit log deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
