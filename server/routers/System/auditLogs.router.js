import express from 'express';
import { listArchivedRecords,listArchiveBatches,readArchiveSettings,updateArchiveSettings,previewArchiveRemoval,requestArchiveRemoval,confirmArchiveRemoval,setArchiveProtection,listArchiveDeletionHistory } from '../../controllers/System/auditArchiveManagement.controller.js';
import {
  confirmAuditLogArchive,
  downloadAuditLogArchiveExport,
  getAuditLogs,
  requestAuditLogArchive,
} from '../../controllers/System/auditLogs.controller.js';
import { authenticateUser, requireExactRole, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { getAuditReportData, getAuditReportCaseDetails, recordAuditReportExport } from '../../controllers/System/auditReport.controller.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/report/data', requirePermission(PERMISSIONS.AUDIT_LOGS_EXPORT), getAuditReportData);
router.post('/report/cases', requirePermission(PERMISSIONS.AUDIT_LOGS_EXPORT), getAuditReportCaseDetails);
router.post('/report/record', requirePermission(PERMISSIONS.AUDIT_LOGS_EXPORT), recordAuditReportExport);
router.get('/archive/records', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin','system_admin'), listArchivedRecords);
router.get('/archive/files', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin','system_admin'), listArchiveBatches);
router.get('/archive/settings', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin','system_admin'), readArchiveSettings);
router.post('/archive/settings', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin'), updateArchiveSettings);
router.get('/archive/remove-preview', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin'), previewArchiveRemoval);
router.post('/archive/remove-request', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin'), requestArchiveRemoval);
router.post('/archive/remove-confirm', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin'), confirmArchiveRemoval);
router.post('/archive/protect', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin'), setArchiveProtection);
router.get('/archive/deletion-history', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin','system_admin'), listArchiveDeletionHistory);
router.get('/', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW), getAuditLogs);
router.post('/archive/request', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin', 'system_admin'), requestAuditLogArchive);
router.post('/archive/confirm', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin', 'system_admin'), confirmAuditLogArchive);
router.get('/archive/exports/:batchId', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requireExactRole('super_admin', 'system_admin'), downloadAuditLogArchiveExport);

export default router;



