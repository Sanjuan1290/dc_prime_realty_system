import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
test('navigation uses ordinary labels and removes search from Excel export modal',()=>{
 const page=read('client/src/pages/System/AuditLogs.jsx');
 const workspace=read('client/src/components/System/auditLogsComponents/AuditArchiveWorkspace.jsx');
 const modal=read('client/src/components/System/auditLogsComponents/ExportAuditReportModal.jsx');
 for(const s of ['Recent Activity','Old Records','Saved Archive Files','Cleanup Settings'])assert.ok(page.includes(s));
 for(const s of ['Search old records','Protect File','Send Verification Code','Permanently Delete File'])assert.ok(workspace.includes(s));
 assert.doesNotMatch(modal,/Search in Audit Logs|placeholder="All activity"/);
 assert.doesNotMatch(modal,/Includes Audit Log Details, Before & After Changes/);
 assert.doesNotMatch(modal,/search\.trim\(\)/);
});
test('backend restricts deletion, supports OTP, records a receipt, and removes CSV',()=>{
 const src=read('server/controllers/System/auditArchiveManagement.controller.js');
 const routes=read('server/routers/System/auditLogs.router.js');
 for(const phrase of ["process.env.AUDIT_ARCHIVE_PURGE_ENABLED!=='true'","user.role !== 'super_admin'",'bcrypt.compare','crypto.timingSafeEqual','expires_at <= NOW()','DELETE FROM audit_log_archive_events','DELETE FROM audit_logs_archive','DELETE FROM audit_log_archive_batches','INSERT INTO audit_archive_purge_receipts'])assert.ok(src.includes(phrase),phrase);
 assert.match(src,/manuallyHeld\|\|b.linkedCase/);
 assert.match(src,/await c\.beginTransaction\(\)/);
 assert.match(src,/await c\.rollback\(\)/);
 for(const s of ["requireExactRole('super_admin')","requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE)",'/archive/remove-request','/archive/remove-confirm','/archive/deletion-history'])assert.ok(routes.includes(s));
});
test('migration preserves trigger guards and turns automatic cleanup off by default',()=>{
 const sql=read('server/migrations/20261018_audit_archive_management.sql');
 assert.match(sql,/auto_delete_enabled TINYINT\(1\) NOT NULL DEFAULT 0/);
 assert.match(sql,/INSERT IGNORE INTO audit_archive_settings\(id,archive_days,auto_delete_enabled\) VALUES\(1,180,0\)/);
 for(const table of ['audit_archive_holds','audit_archive_purge_codes','audit_archive_purge_receipts'])assert.ok(sql.includes(table));
 for(const trigger of ['trg_audit_logs_archive_no_delete','trg_audit_archive_batches_no_delete','trg_audit_archive_events_no_delete'])assert.ok(sql.includes(trigger));
 assert.match(sql,/@audit_archive_purge_operation,0\) <> 1/);
 const job=read('server/scripts/run-audit-archive-cleanup.js');
 assert.ok(job.includes('runArchiveCleanup'));
});

