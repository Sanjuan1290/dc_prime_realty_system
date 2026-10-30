// One-time, idempotent notification repair for still-open admin-direct Audit Cases.
// Run with no arguments first (read-only); rerun with --apply after reviewing.
// Does not change existing review events, audit decisions, or case assignment.
import 'dotenv/config';
import { db } from '../db/connect.js';
import { isAdminDirectAuditCase, resolveAuditCaseResponders } from '../services/auditCaseResponder.service.js';
import { createInternalNotifications } from '../services/internalNotification.service.js';

const apply = process.argv.includes('--apply');
const caseArg = process.argv.find((arg) => arg.startsWith('--case='));
const caseId = caseArg ? Number(caseArg.split('=')[1]) : null;
if (caseArg && (!Number.isInteger(caseId) || caseId < 1)) {
  console.error('Use a positive numeric ID: --case=30001');
  process.exit(2);
}

const run = async () => {
  const connection = await db.getConnection();
  let repaired = 0;
  try {
    if (apply) await connection.beginTransaction();
    const [cases] = await connection.query(`
      SELECT c.audit_case_id, c.case_number, c.status, c.assigned_responder_user_id, c.finding,
             r.operational_review_id, r.approval_type, r.initiated_by_role,
             r.initiated_by_user_id, r.lot_project_id, r.department
      FROM audit_cases c
      INNER JOIN operational_reviews r ON r.operational_review_id = c.operational_review_id
      WHERE c.status = 'awaiting_head_response' AND r.status = 'audit_case_open'
        AND r.approval_type IN ('emergency_super_admin', 'system_admin_direct')
        ${caseId ? 'AND c.audit_case_id = ?' : ''}
      ORDER BY c.audit_case_id`, caseId ? [caseId] : []);
    for (const record of cases) {
      if (!isAdminDirectAuditCase(record)) continue;
      const responders = await resolveAuditCaseResponders(connection, record);
      const [existing] = await connection.query(`
        SELECT user_id FROM internal_notifications
        WHERE audit_case_id = ? AND notification_type = 'audit_case_response_required'`, [record.audit_case_id]);
      const present = new Set(existing.map((entry) => Number(entry.user_id)));
      const missing = responders.userIds.filter((id) => !present.has(id));
      console.log(JSON.stringify({
        caseNumber: record.case_number, mode: responders.mode,
        eligibleResponders: responders.userIds, missingNotifications: missing,
        action: apply ? 'apply' : 'dry-run',
      }));
      if (!apply || !missing.length) continue;
      await createInternalNotifications(connection, {
        userIds: missing,
        type: 'audit_case_response_required',
        title: `Audit Case requires explanation · ${record.case_number}`,
        message: String(record.finding || 'Open the Review Center and respond to the audit finding.'),
        reviewId: record.operational_review_id,
        auditCaseId: record.audit_case_id,
      });
      repaired += missing.length;
    }
    if (apply) await connection.commit();
    console.log(apply ? `Created ${repaired} missing notification(s).` : 'Dry run: nothing was changed.');
  } catch (error) {
    if (apply) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
};
try { await run(); }
catch (error) { console.error('Notification repair failed:', error.message); process.exitCode = 1; }
finally { await db.end(); }

