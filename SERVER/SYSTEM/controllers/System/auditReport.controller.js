// Read-only investigation export, paged by immutable audit ID so activity from
// another session cannot move the rows between pages.
import { db, getAuthenticatedUser, getErrorMessage } from '../Lot_Projects/_shared/lotProject.shared.js';
import { PERMISSIONS, roleHasPermission } from '../../config/permissions.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { normalizeIpAddress } from '../../utils/requestIp.js';

import { parseAuditReportFilters, redactReportMetadata } from '../../utils/auditReportValidation.js';

const requireReportUser = async (req) => {
  const actor = await getAuthenticatedUser(req);
  if (!actor || !roleHasPermission(actor, PERMISSIONS.AUDIT_LOGS_VIEW) || !roleHasPermission(actor, PERMISSIONS.AUDIT_LOGS_EXPORT)) {
    throw Object.assign(new Error('You do not have permission to export Audit Reports.'), { statusCode: 403 });
  }
  return actor;
};

const filterSql = (filters) => {
  const parts = [], values = [];
  if (filters.action !== 'all') { parts.push('al.action = ?'); values.push(filters.action); }
  if (filters.module !== 'all') { parts.push('al.module = ?'); values.push(filters.module); }
  // Date-only comparisons exactly match the existing Audit Logs filter.
  if (filters.from) { parts.push('DATE(al.audit_log_created_at) >= ?'); values.push(filters.from); }
  if (filters.to) { parts.push('DATE(al.audit_log_created_at) <= ?'); values.push(filters.to); }
  if (filters.search) {
    const like = `%${filters.search}%`;
    parts.push(`(al.title LIKE ? OR al.description LIKE ? OR al.module LIKE ? OR al.entity_type LIKE ? OR al.entity_id LIKE ? OR al.entity_label LIKE ? OR al.actor_name LIKE ? OR al.actor_email LIKE ? OR CAST(al.metadata_json AS CHAR) LIKE ?)`);
    values.push(...Array(9).fill(like));
  }
  return { parts, values };
};

const parseJson = (value) => {
  try { return typeof value === 'string' ? JSON.parse(value) : (value || null); } catch { return null; }
};

const mapping = (r) => ({
  id: r.audit_log_id, createdAt: r.audit_log_created_at, actorUserId: r.actor_user_id,
  actorName: r.actor_name || r.user_full_name || 'System', actorEmail: r.actor_email || r.user_email || '', actorRole: r.actor_role || r.user_role || '',
  action: r.action, module: r.module, entityType: r.entity_type, entityId: r.entity_id,
  entityLabel: r.entity_label, title: r.title, description: r.description,
  metadata: redactReportMetadata(parseJson(r.metadata_json)),
  ipAddress: normalizeIpAddress(r.ip_address) || '', userAgent: r.user_agent || '',
  source: r.record_source, archiveBatchId: r.archive_batch_id || null,
});

const baseColumns = `actor_user_id, actor_name, actor_email, actor_role, action, module,
 entity_type, entity_id, entity_label, title, description, metadata_json,
 ip_address, user_agent, audit_log_created_at`;

export const getAuditReportData = async (req, res) => {
  let connection;
  try {
    const actor = await requireReportUser(req);
    const filters = parseAuditReportFilters(req.query);
    if (filters.includeArchived && !roleHasPermission(actor, PERMISSIONS.AUDIT_LOGS_ARCHIVE)) {
      return res.status(403).json({ message: 'Archived Audit Logs require the Archive Audit Logs permission. Select Current Logs or ask an administrator for access.' });
    }
    const limit = 500; // bounded batches; frontend fetches all batches
    const cursor = req.query.cursor === undefined ? null : Number(req.query.cursor);
    const snapshot = req.query.snapshot === undefined ? null : Number(req.query.snapshot);
    if ((cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1)) || (snapshot !== null && (!Number.isSafeInteger(snapshot) || snapshot < 0))) {
      return res.status(400).json({ message: 'The export session is invalid. Start the export again.' });
    }
    connection = await db.getConnection();
    const source = filters.includeArchived
      ? `(
          SELECT audit_log_id, ${baseColumns}, 'Current' AS record_source, NULL AS archive_batch_id FROM audit_logs
          UNION ALL
          SELECT a.original_audit_log_id AS audit_log_id, ${baseColumns}, 'Archived' AS record_source, a.audit_log_archive_batch_id AS archive_batch_id FROM audit_logs_archive a
          WHERE NOT EXISTS (SELECT 1 FROM audit_logs active_log WHERE active_log.audit_log_id = a.original_audit_log_id)
        )`
      : `(SELECT audit_log_id, ${baseColumns}, 'Current' AS record_source, NULL AS archive_batch_id FROM audit_logs)`;
    const [[top]] = snapshot === null ? await connection.query(`SELECT COALESCE(MAX(al.audit_log_id),0) AS maxId FROM ${source} al`) : [[{ maxId: snapshot }]];
    const frozen = Number(top.maxId || 0);
    const { parts, values } = filterSql(filters);
    parts.push('al.audit_log_id <= ?'); values.push(frozen);
    if (cursor !== null) { parts.push('al.audit_log_id < ?'); values.push(cursor); }
    const [rows] = await connection.query(`SELECT al.*, TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) AS user_full_name, u.email AS user_email, u.role AS user_role FROM ${source} al LEFT JOIN users u ON u.id = al.actor_user_id WHERE ${parts.join(' AND ')} ORDER BY al.audit_log_id DESC LIMIT ?`, [...values, limit + 1]);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map(mapping);
    return res.json({ success: true, data: page, hasMore, nextCursor: hasMore ? Number(page.at(-1).id) : null, snapshot: frozen });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : getErrorMessage(error) });
  } finally { connection?.release(); }
};

export const getAuditReportCaseDetails = async (req, res) => {
  let connection;
  try {
    const actor = await requireReportUser(req);
    if (!roleHasPermission(actor, PERMISSIONS.WORKFLOW_AUDIT_REVIEW)) {
      return res.status(403).json({ message: 'Full Audit Case history is available to authorized Auditors and administrators only. Uncheck Include Related Case History to export the activity report.' });
    }
    const ids = Array.isArray(req.body?.reviewIds) ? [...new Set(req.body.reviewIds.map(Number))] : [];
    const caseIds = Array.isArray(req.body?.caseIds) ? [...new Set(req.body.caseIds.map(Number))] : [];
    if (ids.length > 500 || caseIds.length > 500 || [...ids, ...caseIds].some((id) => !Number.isSafeInteger(id) || id < 1)) {
      return res.status(400).json({ message: 'Too many or invalid review references in this report.' });
    }
    if (!ids.length && !caseIds.length) return res.json({ reviews: [], events: [], cases: [] });
    connection = await db.getConnection();
    let cases = [], reviews = [], events = [];
    // These governance tables are optional on older deployments. Do not guess
    // relationships or silently join by a matching unit name.
    const [tables] = await connection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('operational_reviews','operational_review_events','audit_cases')`);
    const existing = new Set(tables.map((r) => String(r.TABLE_NAME || r.table_name)));
    if (!existing.has('operational_reviews')) return res.json({ reviews, events, cases, unavailable: 'Review history tables are not installed.' });
    if (existing.has('audit_cases') && (ids.length || caseIds.length)) {
      const clauses = [], params = [];
      if (ids.length) { clauses.push(`operational_review_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
      if (caseIds.length) { clauses.push(`audit_case_id IN (${caseIds.map(() => '?').join(',')})`); params.push(...caseIds); }
      const [result] = await connection.query(`SELECT * FROM audit_cases WHERE ${clauses.join(' OR ')}`, params);
      cases = result;
    }
    const allReviewIds = [...new Set([...ids, ...cases.map((c) => Number(c.operational_review_id))])];
    if (allReviewIds.length) {
      const placeholders = allReviewIds.map(() => '?').join(',');
      const [result] = await connection.query(`SELECT r.operational_review_id, r.review_number, r.action_key, r.department,
        r.entity_type, r.entity_id, r.entity_label, r.initiated_by_user_id,
        r.head_reviewed_by_user_id, r.auditor_reviewed_by_user_id, r.status,
        r.created_at, r.updated_at,
        TRIM(CONCAT_WS(' ', initiator.first_name, initiator.middle_name, initiator.last_name)) AS initiated_by_name,
        TRIM(CONCAT_WS(' ', head.first_name, head.middle_name, head.last_name)) AS head_reviewed_by_name,
        TRIM(CONCAT_WS(' ', auditor.first_name, auditor.middle_name, auditor.last_name)) AS auditor_reviewed_by_name
        FROM operational_reviews r
        LEFT JOIN users initiator ON initiator.id = r.initiated_by_user_id
        LEFT JOIN users head ON head.id = r.head_reviewed_by_user_id
        LEFT JOIN users auditor ON auditor.id = r.auditor_reviewed_by_user_id
        WHERE r.operational_review_id IN (${placeholders})`, allReviewIds);
      reviews = result;
      if (existing.has('operational_review_events')) {
        const [history] = await connection.query(`SELECT e.operational_review_event_id, e.operational_review_id, e.event_type,
          e.from_status, e.to_status, e.actor_user_id, e.actor_role, e.message,
          e.metadata_json, e.created_at,
          TRIM(CONCAT_WS(' ', actor.first_name, actor.middle_name, actor.last_name)) AS actor_name
          FROM operational_review_events e
          LEFT JOIN users actor ON actor.id = e.actor_user_id
          WHERE e.operational_review_id IN (${placeholders})
          ORDER BY e.created_at, e.operational_review_event_id`, allReviewIds);
        events = history.map((event) => ({ ...event, metadata_json: redactReportMetadata(parseJson(event.metadata_json)) }));
      }
    }
    return res.json({ reviews, events, cases });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : getErrorMessage(error) }); }
  finally { connection?.release(); }
};

export const recordAuditReportExport = async (req, res) => {
  try {
    await requireReportUser(req);
    const filters = parseAuditReportFilters(req.body || {});
    const count = Number(req.body?.recordCount);
    if (!Number.isSafeInteger(count) || count < 0) return res.status(400).json({ message: 'Invalid report record count.' });
    if (filters.includeArchived) {
      const actor = await getAuthenticatedUser(req);
      if (!roleHasPermission(actor, PERMISSIONS.AUDIT_LOGS_ARCHIVE)) return res.status(403).json({ message: 'Archived record export requires additional permission.' });
    }
    await writeAuditLog(db, req, {
      action: 'export', module: 'Audit Logs', entityType: 'audit_report', entityLabel: 'Audit Report',
      title: 'Exported Audit Report', description: `Downloaded Excel Audit Report (${count} audit events).`,
      metadata: { filters, recordCount: count, format: 'xlsx' },
    });
    return res.json({ success: true });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) }); }
};


