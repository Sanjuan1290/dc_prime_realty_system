import crypto from 'node:crypto';
import {
  bcrypt,
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

const DELETE_CODE_EXPIRY_MINUTES = 10;
const DELETE_CODE_COOLDOWN_SECONDS = 60;
const DELETE_CODE_MAX_ATTEMPTS = 5;

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
const getRequestIp = (req) => String(req?.ip || req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45) || null;
const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const summaryCache = {
  expiresAt: 0,
  data: null,
};

const invalidateSummaryCache = () => {
  summaryCache.expiresAt = 0;
  summaryCache.data = null;
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

const requireSuperAdmin = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error('You must be logged in to delete audit logs.');
    error.statusCode = 401;
    throw error;
  }

  if (user.role !== 'super_admin') {
    const error = new Error('Only a super admin can delete audit logs.');
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

const auditDeletionVerificationTableSql = `
  CREATE TABLE IF NOT EXISTS audit_log_deletion_verifications (
    audit_log_deletion_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    status ENUM('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME NULL,
    request_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_deletion_verification_id),
    KEY idx_audit_delete_verification_user (user_id),
    KEY idx_audit_delete_verification_status (status, expires_at),
    CONSTRAINT fk_audit_delete_verification_user
      FOREIGN KEY (user_id) REFERENCES users (id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

export const ensureAuditLogTable = async (connection = db) => {
  await connection.query(auditLogTableSql);
};

const ensureAuditDeletionVerificationTable = async (connection = db) => {
  await connection.query(auditDeletionVerificationTableSql);
};

const insertAuditLog = async (connection, req, payload = {}) => {
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
      getRequestIp(req),
      String(req?.headers?.['user-agent'] || '').slice(0, 255) || null,
    ]
  );

  invalidateSummaryCache();
};

export const writeAuditLog = async (connection = db, req, payload = {}) => {
  await ensureAuditLogTable(connection);
  await insertAuditLog(connection, req, payload);
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

const maskEmail = (email = '') => {
  const [local = '', domain = ''] = String(email).split('@');
  if (!domain) return 'your account email';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
};

const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const hashVerificationCode = (code) => {
  const secret = String(process.env.AUDIT_DELETE_CODE_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) {
    const error = new Error('Audit deletion verification is not configured. Set JWT_SECRET or AUDIT_DELETE_CODE_SECRET.');
    error.statusCode = 500;
    throw error;
  }

  return crypto.createHmac('sha256', secret).update(String(code)).digest('hex');
};

const verificationCodeMatches = (code, expectedHash) => {
  const actual = Buffer.from(hashVerificationCode(code), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const sendAuditDeletionCodeEmail = async ({ to, name, code }) => {
  const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredEnv.filter((key) => !String(process.env[key] || '').trim());

  if (missing.length > 0) {
    const error = new Error(`SMTP is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    const error = new Error('Email package is missing. Run npm install in the server folder first.');
    error.statusCode = 500;
    throw error;
  }

  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const safeName = cleanText(name, 'Super Admin');
  const safeHtmlName = escapeHtml(safeName);
  const subject = 'D&C Prime audit log deletion code';
  const text = [
    `Hello ${safeName},`,
    '',
    'A request was made to delete all audit logs.',
    `Verification code: ${code}`,
    `This code expires in ${DELETE_CODE_EXPIRY_MINUTES} minutes.`,
    '',
    'Do not share this code. If you did not make this request, change your password.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:8px">Audit log deletion verification</h2>
      <p>Hello ${safeHtmlName},</p>
      <p>A request was made to delete all audit logs in D&amp;C Prime.</p>
      <div style="margin:24px 0;padding:18px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;text-align:center">
        <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase">Verification code</div>
        <div style="margin-top:8px;font-size:32px;font-weight:800;letter-spacing:8px;color:#7f1d1d">${code}</div>
      </div>
      <p>This code expires in ${DELETE_CODE_EXPIRY_MINUTES} minutes.</p>
      <p style="font-size:13px;color:#475569">Do not share this code. If you did not make this request, change your password.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

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

export const requestAuditLogDeletion = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSuperAdmin(req);
    const password = String(req.body.password || '');

    if (!password) return res.status(400).json({ message: 'Your password is required.' });
    if (!actor.email) return res.status(400).json({ message: 'Your super-admin account has no email address.' });

    const passwordMatches = await bcrypt.compare(password, actor.password_hash);
    if (!passwordMatches) return res.status(401).json({ message: 'Password is incorrect.' });

    await ensureAuditDeletionVerificationTable(connection);

    const [[recentRequest]] = await connection.query(
      `
        SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_since_request
        FROM audit_log_deletion_verifications
        WHERE user_id = ?
        ORDER BY audit_log_deletion_verification_id DESC
        LIMIT 1
      `,
      [actor.id]
    );

    const secondsSinceRequest = Number(recentRequest?.seconds_since_request);
    if (Number.isFinite(secondsSinceRequest) && secondsSinceRequest < DELETE_CODE_COOLDOWN_SECONDS) {
      return res.status(429).json({
        message: `Please wait ${DELETE_CODE_COOLDOWN_SECONDS - secondsSinceRequest} second(s) before requesting another code.`,
      });
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE audit_log_deletion_verifications
        SET status = 'expired'
        WHERE user_id = ? AND status = 'pending'
      `,
      [actor.id]
    );

    const [insertResult] = await connection.query(
      `
        INSERT INTO audit_log_deletion_verifications (
          user_id,
          code_hash,
          status,
          attempt_count,
          max_attempts,
          expires_at,
          request_ip
        ) VALUES (?, ?, 'pending', 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
      `,
      [
        actor.id,
        codeHash,
        DELETE_CODE_MAX_ATTEMPTS,
        DELETE_CODE_EXPIRY_MINUTES,
        getRequestIp(req),
      ]
    );

    await sendAuditDeletionCodeEmail({
      to: actor.email,
      name: getUserFullName(actor),
      code,
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `A verification code was sent to ${maskEmail(actor.email)}.`,
      data: {
        verificationId: Number(insertResult.insertId),
        maskedEmail: maskEmail(actor.email),
        expiresInMinutes: DELETE_CODE_EXPIRY_MINUTES,
      },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const confirmAuditLogDeletion = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSuperAdmin(req);
    const verificationId = Number(req.body.verificationId);
    const code = String(req.body.code || '').trim();

    if (!verificationId) return res.status(400).json({ message: 'Verification request is missing.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the 6-digit verification code.' });

    await ensureAuditLogTable(connection);
    await ensureAuditDeletionVerificationTable(connection);
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT *, expires_at <= NOW() AS is_expired
        FROM audit_log_deletion_verifications
        WHERE audit_log_deletion_verification_id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [verificationId, actor.id]
    );

    const verification = rows[0];
    if (!verification) {
      await connection.rollback();
      return res.status(404).json({ message: 'Verification request was not found.' });
    }

    if (verification.status !== 'pending') {
      await connection.rollback();
      const messages = {
        used: 'This verification code has already been used.',
        expired: 'This verification code has expired. Request a new code.',
        locked: 'This verification request is locked. Request a new code.',
      };
      return res.status(400).json({ message: messages[verification.status] || 'Verification request is no longer active.' });
    }

    if (Number(verification.is_expired || 0) === 1) {
      await connection.query(
        `UPDATE audit_log_deletion_verifications SET status = 'expired' WHERE audit_log_deletion_verification_id = ?`,
        [verificationId]
      );
      await connection.commit();
      return res.status(400).json({ message: 'This verification code has expired. Request a new code.' });
    }

    const nextAttemptCount = Number(verification.attempt_count || 0) + 1;
    const maxAttempts = Number(verification.max_attempts || DELETE_CODE_MAX_ATTEMPTS);

    if (!verificationCodeMatches(code, verification.code_hash)) {
      const nextStatus = nextAttemptCount >= maxAttempts ? 'locked' : 'pending';
      await connection.query(
        `
          UPDATE audit_log_deletion_verifications
          SET attempt_count = ?, status = ?
          WHERE audit_log_deletion_verification_id = ?
        `,
        [nextAttemptCount, nextStatus, verificationId]
      );
      await connection.commit();

      return res.status(nextStatus === 'locked' ? 429 : 401).json({
        message: nextStatus === 'locked'
          ? 'Too many incorrect codes. Request a new code.'
          : `Verification code is incorrect. ${maxAttempts - nextAttemptCount} attempt(s) remaining.`,
      });
    }

    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM audit_logs`);
    const deletedCount = Number(countRow.total || 0);

    await connection.query(`DELETE FROM audit_logs`);
    await connection.query(
      `
        UPDATE audit_log_deletion_verifications
        SET status = 'used', attempt_count = ?, verified_at = NOW()
        WHERE audit_log_deletion_verification_id = ?
      `,
      [nextAttemptCount, verificationId]
    );

    await insertAuditLog(connection, req, {
      actor,
      action: 'delete',
      module: 'Audit Logs',
      entityType: 'audit_logs',
      entityId: 'all',
      entityLabel: 'All previous audit records',
      title: 'Deleted all audit logs',
      description: `${getUserFullName(actor)} deleted ${deletedCount} previous audit log record(s) after password and email-code verification.`,
      metadata: {
        deletedCount,
        verificationId,
        verificationMethod: 'password_and_email_code',
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `${deletedCount} audit log record(s) deleted. One new security record was created for this action.`,
      data: { deletedCount },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

