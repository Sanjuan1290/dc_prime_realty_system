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

const ARCHIVE_CODE_EXPIRY_MINUTES = 10;
const ARCHIVE_CODE_COOLDOWN_SECONDS = 60;
const ARCHIVE_CODE_MAX_ATTEMPTS = 5;
const DEFAULT_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 3650;

const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
const clampLimit = (value) => Math.min(Math.max(Number(value || 10), 5), 100);
const normalizeRetentionDays = (value) => {
  const parsed = Math.round(Number(value || DEFAULT_RETENTION_DAYS));
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.min(Math.max(parsed, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS);
};

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
const getRequestIp = (req) => String(req?.ip || req?.headers?.['x-forwarded-for'] || '')
  .split(',')[0]
  .trim()
  .slice(0, 45) || null;
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
    const error = new Error('You must be logged in to archive audit logs.');
    error.statusCode = 401;
    throw error;
  }

  if (user.role !== 'super_admin') {
    const error = new Error('Only a Super Admin can archive audit logs.');
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

const auditArchivePolicyTableSql = `
  CREATE TABLE IF NOT EXISTS audit_log_archive_policy (
    policy_id TINYINT UNSIGNED NOT NULL,
    retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 365,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (policy_id),
    CONSTRAINT fk_audit_archive_policy_user
      FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const auditArchiveVerificationTableSql = `
  CREATE TABLE IF NOT EXISTS audit_log_archive_verifications (
    audit_log_archive_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    code_hash CHAR(64) NOT NULL,
    retention_days SMALLINT UNSIGNED NOT NULL,
    cutoff_at DATETIME NOT NULL,
    eligible_count INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME NULL,
    request_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_archive_verification_id),
    KEY idx_audit_archive_verification_user (user_id),
    KEY idx_audit_archive_verification_status (status, expires_at),
    CONSTRAINT fk_audit_archive_verification_user
      FOREIGN KEY (user_id) REFERENCES users (id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const auditArchiveBatchTableSql = `
  CREATE TABLE IF NOT EXISTS audit_log_archive_batches (
    audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    retention_days SMALLINT UNSIGNED NOT NULL,
    cutoff_at DATETIME NOT NULL,
    record_count INT UNSIGNED NOT NULL,
    export_filename VARCHAR(255) NOT NULL,
    export_sha256 CHAR(64) NOT NULL,
    export_csv LONGBLOB NOT NULL,
    archived_by_user_id INT UNSIGNED NULL,
    archived_by_name VARCHAR(255) NULL,
    archived_by_email VARCHAR(150) NULL,
    request_ip VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_archive_batch_id),
    KEY idx_audit_archive_batch_created (created_at),
    KEY idx_audit_archive_batch_cutoff (cutoff_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const archivedAuditLogsTableSql = `
  CREATE TABLE IF NOT EXISTS audit_logs_archive (
    audit_log_archive_record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL,
    original_audit_log_id BIGINT UNSIGNED NOT NULL,
    actor_user_id INT UNSIGNED NULL,
    actor_name VARCHAR(255) NULL,
    actor_email VARCHAR(150) NULL,
    actor_role VARCHAR(80) NULL,
    action VARCHAR(40) NOT NULL,
    module VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(120) NULL,
    entity_label VARCHAR(255) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    metadata_json JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    audit_log_created_at DATETIME NOT NULL,
    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_archive_record_id),
    UNIQUE KEY uq_archived_original_audit_log (original_audit_log_id),
    KEY idx_archived_audit_batch (audit_log_archive_batch_id),
    KEY idx_archived_audit_created (audit_log_created_at),
    KEY idx_archived_audit_module (module),
    CONSTRAINT fk_archived_audit_batch
      FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const auditArchiveEventsTableSql = `
  CREATE TABLE IF NOT EXISTS audit_log_archive_events (
    audit_log_archive_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    audit_log_archive_batch_id BIGINT UNSIGNED NULL,
    actor_user_id INT UNSIGNED NULL,
    actor_name VARCHAR(255) NULL,
    actor_email VARCHAR(150) NULL,
    event_type ENUM('archive_created','export_downloaded') NOT NULL,
    record_count INT UNSIGNED NOT NULL DEFAULT 0,
    retention_days SMALLINT UNSIGNED NULL,
    cutoff_at DATETIME NULL,
    export_sha256 CHAR(64) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    event_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_archive_event_id),
    KEY idx_audit_archive_event_batch (audit_log_archive_batch_id),
    KEY idx_audit_archive_event_created (event_created_at),
    CONSTRAINT fk_audit_archive_event_batch
      FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

export const ensureAuditLogTable = async (connection = db) => {
  await connection.query(auditLogTableSql);
};

const ensureAuditArchiveTables = async (connection = db) => {
  await connection.query(auditArchivePolicyTableSql);
  await connection.query(auditArchiveVerificationTableSql);
  await connection.query(auditArchiveBatchTableSql);
  await connection.query(archivedAuditLogsTableSql);
  await connection.query(auditArchiveEventsTableSql);
  await connection.query(
    `INSERT IGNORE INTO audit_log_archive_policy (policy_id, retention_days) VALUES (1, ?)`,
    [DEFAULT_RETENTION_DAYS]
  );
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
  const secret = String(
    process.env.AUDIT_ARCHIVE_CODE_SECRET
      || process.env.AUDIT_DELETE_CODE_SECRET
      || process.env.JWT_SECRET
      || ''
  ).trim();

  if (!secret) {
    const error = new Error('Audit archive verification is not configured. Set JWT_SECRET or AUDIT_ARCHIVE_CODE_SECRET.');
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

const sendAuditArchiveCodeEmail = async ({ to, name, code, retentionDays, cutoffAt, eligibleCount }) => {
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
  const safeCutoff = cleanText(cutoffAt);
  const subject = 'D&C Prime audit archive verification code';
  const text = [
    `Hello ${safeName},`,
    '',
    `A request was made to archive ${eligibleCount} audit log record(s) older than ${retentionDays} days.`,
    `Cutoff: ${safeCutoff}`,
    `Verification code: ${code}`,
    `This code expires in ${ARCHIVE_CODE_EXPIRY_MINUTES} minutes.`,
    '',
    'The system will create and store a CSV export before moving records to the archive tables.',
    'Do not share this code. If you did not make this request, change your password.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:8px">Audit archive verification</h2>
      <p>Hello ${safeHtmlName},</p>
      <p>A request was made to archive <strong>${eligibleCount}</strong> audit log record(s) older than <strong>${retentionDays} days</strong>.</p>
      <p>Cutoff: <strong>${escapeHtml(safeCutoff)}</strong></p>
      <div style="margin:24px 0;padding:18px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;text-align:center">
        <div style="font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase">Verification code</div>
        <div style="margin-top:8px;font-size:32px;font-weight:800;letter-spacing:8px;color:#1e3a8a">${code}</div>
      </div>
      <p>This code expires in ${ARCHIVE_CODE_EXPIRY_MINUTES} minutes.</p>
      <p style="font-size:13px;color:#475569">A CSV export is stored before records move to the archive. Do not share this code.</p>
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

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const buildAuditCsv = (rows = []) => {
  const columns = [
    'audit_log_id',
    'actor_user_id',
    'actor_name',
    'actor_email',
    'actor_role',
    'action',
    'module',
    'entity_type',
    'entity_id',
    'entity_label',
    'title',
    'description',
    'metadata_json',
    'ip_address',
    'user_agent',
    'audit_log_created_at',
  ];

  const lines = [columns.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
};

const getArchivePolicySummary = async (connection) => {
  await ensureAuditArchiveTables(connection);

  const [[policyRow]] = await connection.query(
    `SELECT retention_days FROM audit_log_archive_policy WHERE policy_id = 1 LIMIT 1`
  );
  const retentionDays = normalizeRetentionDays(policyRow?.retention_days);

  const [[summaryRow]] = await connection.query(
    `
      SELECT
        (SELECT COUNT(*) FROM audit_logs_archive) AS archived_total,
        (SELECT COUNT(*) FROM audit_logs WHERE audit_log_created_at < DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)) AS eligible_total,
        (SELECT MAX(created_at) FROM audit_log_archive_batches) AS last_archived_at
    `
  );

  return {
    retentionDays,
    minRetentionDays: MIN_RETENTION_DAYS,
    maxRetentionDays: MAX_RETENTION_DAYS,
    archivedTotal: Number(summaryRow.archived_total || 0),
    eligibleTotal: Number(summaryRow.eligible_total || 0),
    lastArchivedAt: summaryRow.last_archived_at || null,
  };
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
    const archivePolicy = await getArchivePolicySummary(connection);

    return res.json({
      success: true,
      data: rows.map(mapAuditLog),
      summary,
      modules,
      archivePolicy,
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

export const requestAuditLogArchive = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSuperAdmin(req);
    const password = String(req.body.password || '');
    const retentionDays = normalizeRetentionDays(req.body.retentionDays);

    if (!password) return res.status(400).json({ message: 'Your password is required.' });
    if (!actor.email) return res.status(400).json({ message: 'Your Super Admin account has no email address.' });

    const passwordMatches = await bcrypt.compare(password, actor.password_hash);
    if (!passwordMatches) return res.status(401).json({ message: 'Password is incorrect.' });

    await ensureAuditLogTable(connection);
    await ensureAuditArchiveTables(connection);

    const [[recentRequest]] = await connection.query(
      `
        SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_since_request
        FROM audit_log_archive_verifications
        WHERE user_id = ?
        ORDER BY audit_log_archive_verification_id DESC
        LIMIT 1
      `,
      [actor.id]
    );

    const secondsSinceRequest = Number(recentRequest?.seconds_since_request);
    if (Number.isFinite(secondsSinceRequest) && secondsSinceRequest < ARCHIVE_CODE_COOLDOWN_SECONDS) {
      return res.status(429).json({
        message: `Please wait ${ARCHIVE_CODE_COOLDOWN_SECONDS - secondsSinceRequest} second(s) before requesting another code.`,
      });
    }

    const [[cutoffRow]] = await connection.query(
      `SELECT DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY) AS cutoff_at`
    );
    const cutoffAt = cutoffRow.cutoff_at;

    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE audit_log_created_at < ?`,
      [cutoffAt]
    );
    const eligibleCount = Number(countRow.total || 0);

    if (eligibleCount === 0) {
      return res.status(400).json({
        message: `No active audit records are older than ${retentionDays} days. Nothing needs archival.`,
      });
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE audit_log_archive_verifications
        SET status = 'expired'
        WHERE user_id = ? AND status = 'pending'
      `,
      [actor.id]
    );

    const [insertResult] = await connection.query(
      `
        INSERT INTO audit_log_archive_verifications (
          user_id,
          code_hash,
          retention_days,
          cutoff_at,
          eligible_count,
          status,
          attempt_count,
          max_attempts,
          expires_at,
          request_ip
        ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
      `,
      [
        actor.id,
        codeHash,
        retentionDays,
        cutoffAt,
        eligibleCount,
        ARCHIVE_CODE_MAX_ATTEMPTS,
        ARCHIVE_CODE_EXPIRY_MINUTES,
        getRequestIp(req),
      ]
    );

    await sendAuditArchiveCodeEmail({
      to: actor.email,
      name: getUserFullName(actor),
      code,
      retentionDays,
      cutoffAt,
      eligibleCount,
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `A verification code was sent to ${maskEmail(actor.email)}.`,
      data: {
        verificationId: Number(insertResult.insertId),
        maskedEmail: maskEmail(actor.email),
        expiresInMinutes: ARCHIVE_CODE_EXPIRY_MINUTES,
        retentionDays,
        cutoffAt,
        eligibleCount,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const confirmAuditLogArchive = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSuperAdmin(req);
    const verificationId = Number(req.body.verificationId);
    const code = String(req.body.code || '').trim();

    if (!verificationId) return res.status(400).json({ message: 'Verification request is missing.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the 6-digit verification code.' });

    await ensureAuditLogTable(connection);
    await ensureAuditArchiveTables(connection);
    await connection.beginTransaction();

    const [verificationRows] = await connection.query(
      `
        SELECT *, expires_at <= NOW() AS is_expired
        FROM audit_log_archive_verifications
        WHERE audit_log_archive_verification_id = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [verificationId, actor.id]
    );

    const verification = verificationRows[0];
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
        `UPDATE audit_log_archive_verifications SET status = 'expired' WHERE audit_log_archive_verification_id = ?`,
        [verificationId]
      );
      await connection.commit();
      return res.status(400).json({ message: 'This verification code has expired. Request a new code.' });
    }

    const nextAttemptCount = Number(verification.attempt_count || 0) + 1;
    const maxAttempts = Number(verification.max_attempts || ARCHIVE_CODE_MAX_ATTEMPTS);

    if (!verificationCodeMatches(code, verification.code_hash)) {
      const nextStatus = nextAttemptCount >= maxAttempts ? 'locked' : 'pending';
      await connection.query(
        `
          UPDATE audit_log_archive_verifications
          SET attempt_count = ?, status = ?
          WHERE audit_log_archive_verification_id = ?
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

    const retentionDays = normalizeRetentionDays(verification.retention_days);
    const cutoffAt = verification.cutoff_at;

    const [eligibleRows] = await connection.query(
      `
        SELECT *
        FROM audit_logs
        WHERE audit_log_created_at < ?
        ORDER BY audit_log_created_at ASC, audit_log_id ASC
        FOR UPDATE
      `,
      [cutoffAt]
    );

    if (eligibleRows.length === 0) {
      await connection.query(
        `
          UPDATE audit_log_archive_verifications
          SET status = 'used', attempt_count = ?, verified_at = NOW()
          WHERE audit_log_archive_verification_id = ?
        `,
        [nextAttemptCount, verificationId]
      );
      await connection.commit();
      return res.status(400).json({ message: 'No eligible audit records remain for this archival request.' });
    }

    const csvBuffer = buildAuditCsv(eligibleRows);
    const exportSha256 = crypto.createHash('sha256').update(csvBuffer).digest('hex');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFilename = `audit-logs-archive-${timestamp}.csv`;

    const [batchResult] = await connection.query(
      `
        INSERT INTO audit_log_archive_batches (
          retention_days,
          cutoff_at,
          record_count,
          export_filename,
          export_sha256,
          export_csv,
          archived_by_user_id,
          archived_by_name,
          archived_by_email,
          request_ip,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        retentionDays,
        cutoffAt,
        eligibleRows.length,
        exportFilename,
        exportSha256,
        csvBuffer,
        actor.id,
        getUserFullName(actor),
        actor.email || null,
        getRequestIp(req),
        String(req?.headers?.['user-agent'] || '').slice(0, 255) || null,
      ]
    );

    const batchId = Number(batchResult.insertId);

    await connection.query(
      `
        INSERT INTO audit_logs_archive (
          audit_log_archive_batch_id,
          original_audit_log_id,
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
          user_agent,
          audit_log_created_at
        )
        SELECT
          ?,
          audit_log_id,
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
          user_agent,
          audit_log_created_at
        FROM audit_logs
        WHERE audit_log_created_at < ?
      `,
      [batchId, cutoffAt]
    );

    await connection.query(`SET @audit_archive_operation = 1`);
    const [archiveRemovalResult] = await connection.query(
      `DELETE FROM audit_logs WHERE audit_log_created_at < ?`,
      [cutoffAt]
    );
    await connection.query(`SET @audit_archive_operation = NULL`);
    const archivedCount = Number(archiveRemovalResult.affectedRows || 0);

    if (archivedCount !== eligibleRows.length) {
      const error = new Error('Audit archive count changed during processing. No records were moved.');
      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `
        UPDATE audit_log_archive_verifications
        SET status = 'used', attempt_count = ?, verified_at = NOW()
        WHERE audit_log_archive_verification_id = ?
      `,
      [nextAttemptCount, verificationId]
    );

    await connection.query(
      `
        INSERT INTO audit_log_archive_policy (policy_id, retention_days, updated_by_user_id)
        VALUES (1, ?, ?)
        ON DUPLICATE KEY UPDATE
          retention_days = VALUES(retention_days),
          updated_by_user_id = VALUES(updated_by_user_id)
      `,
      [retentionDays, actor.id]
    );

    await connection.query(
      `
        INSERT INTO audit_log_archive_events (
          audit_log_archive_batch_id,
          actor_user_id,
          actor_name,
          actor_email,
          event_type,
          record_count,
          retention_days,
          cutoff_at,
          export_sha256,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, 'archive_created', ?, ?, ?, ?, ?, ?)
      `,
      [
        batchId,
        actor.id,
        getUserFullName(actor),
        actor.email || null,
        archivedCount,
        retentionDays,
        cutoffAt,
        exportSha256,
        getRequestIp(req),
        String(req?.headers?.['user-agent'] || '').slice(0, 255) || null,
      ]
    );

    await insertAuditLog(connection, req, {
      actor,
      action: 'system',
      module: 'Audit Logs',
      entityType: 'audit_log_archive_batch',
      entityId: String(batchId),
      entityLabel: exportFilename,
      title: 'Archived old audit logs',
      description: `${getUserFullName(actor)} archived ${archivedCount} audit log record(s) older than ${retentionDays} days.`,
      metadata: {
        archivedCount,
        retentionDays,
        cutoffAt,
        verificationId,
        archiveBatchId: batchId,
        exportFilename,
        exportSha256,
        verificationMethod: 'password_and_email_code',
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `${archivedCount} audit log record(s) were exported and moved to the archive.`,
      data: {
        archivedCount,
        retentionDays,
        cutoffAt,
        archiveBatchId: batchId,
        exportFilename,
        exportSha256,
        exportUrl: `/audit-logs/archive/exports/${batchId}`,
      },
    });
  } catch (error) {
    try { await connection.query(`SET @audit_archive_operation = NULL`); } catch {}
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const downloadAuditLogArchiveExport = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const actor = await requireSuperAdmin(req);
    const batchId = Number(req.params.batchId);
    if (!batchId) return res.status(400).json({ message: 'Archive batch id is required.' });

    await ensureAuditArchiveTables(connection);

    const [rows] = await connection.query(
      `
        SELECT
          audit_log_archive_batch_id,
          record_count,
          retention_days,
          cutoff_at,
          export_filename,
          export_sha256,
          export_csv
        FROM audit_log_archive_batches
        WHERE audit_log_archive_batch_id = ?
        LIMIT 1
      `,
      [batchId]
    );

    const archive = rows[0];
    if (!archive) return res.status(404).json({ message: 'Audit archive export was not found.' });

    await connection.query(
      `
        INSERT INTO audit_log_archive_events (
          audit_log_archive_batch_id,
          actor_user_id,
          actor_name,
          actor_email,
          event_type,
          record_count,
          retention_days,
          cutoff_at,
          export_sha256,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, 'export_downloaded', ?, ?, ?, ?, ?, ?)
      `,
      [
        batchId,
        actor.id,
        getUserFullName(actor),
        actor.email || null,
        Number(archive.record_count || 0),
        Number(archive.retention_days || 0),
        archive.cutoff_at,
        archive.export_sha256,
        getRequestIp(req),
        String(req?.headers?.['user-agent'] || '').slice(0, 255) || null,
      ]
    );

    const filename = String(archive.export_filename || `audit-logs-archive-${batchId}.csv`)
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(archive.export_csv);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


