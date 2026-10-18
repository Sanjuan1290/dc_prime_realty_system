// Uses the SAME protected Cloudinary transport and Perception Point scanning as seller Proof of Income.
// Kept in a separate table: company income must never masquerade as seller earnings.
import { db, getErrorMessage, getProjectBySlug } from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import {
  createAuthenticatedSignedCopyUploadSignature,
  verifyAuthenticatedCloudinaryAsset, getCloudinaryMalwareScanState,
  getPerceptionPointQuotaState, validateDocumentUploadRequest,
  sendAuthenticatedAssetContent,
} from '../../../services/secureCloudinary.service.js';
import { buildAccountProtectedRoot } from '../../../services/secureCloudinary.service.js';
import { buildSignedCopyStoredFileName, getFileExtension } from '../../../services/storageCodes.service.js';

const clean = (value) => String(value ?? '').trim();
const basePath = (req) => `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/network-company-profit/${Number(req.params.profitId)}/releases/${Number(req.params.releaseId)}/signed-copy`;
const folderFor = (row) => `${buildAccountProtectedRoot({
  projectStorageCode: row.lot_project_storage_code,
  projectId: row.lot_project_id,
  accountReference: row.account_reference,
})}/commission-receipts/NETWORK-PROFIT-${String(row.profit_release_id).padStart(6, '0')}/signed`;

const context = async (connection, req) => {
  const project = await getProjectBySlug(clean(req.params.projectSlug));
  if (!project) return null;
  const [rows] = await connection.query(`SELECT r.id AS profit_release_id, r.release_stage, r.release_amount,
    r.release_status, r.actual_release_date, r.payment_method, r.payment_reference, r.payee_name,
    p.lot_project_id, p.lot_project_account_id, p.id AS profit_id, p.network_name_snapshot,
    p.payee_name_snapshot, a.account_reference, l.lot_project_listing_unit_id AS unit,
    lp.lot_project_storage_code
    FROM lot_project_network_profit_releases r
    JOIN lot_project_network_profit_accounts p ON p.id = r.profit_account_id
    JOIN lot_project_accounts a ON a.lot_project_account_id = p.lot_project_account_id
    JOIN lot_project_listings l ON l.lot_project_listing_id = p.lot_project_listing_id
    JOIN lot_projects lp ON lp.lot_project_id = p.lot_project_id
    WHERE p.id = ? AND r.id = ? AND p.lot_project_id = ? LIMIT 1`,
  [Number(req.params.profitId), Number(req.params.releaseId), project.lot_project_id]);
  return rows[0] || null;
};
const activeFile = async (connection, releaseId) => {
  const [rows] = await connection.query(`SELECT * FROM lot_project_network_profit_signed_files
     WHERE profit_release_id = ? AND file_status = 'active'
     ORDER BY file_version DESC LIMIT 1`, [releaseId]);
  return rows[0] || null;
};
const fileResponse = (req, row) => row ? ({
  signedCopyId: Number(row.id), fileName: row.file_name, fileType: row.file_mime_type,
  fileSize: Number(row.file_size_bytes), version: Number(row.file_version),
  malwareScanStatus: row.malware_scan_status, malwareScanProvider: row.malware_scan_provider,
  malwareScanReason: row.malware_scan_reason,
  contentPath: `${basePath(req)}/content`, accessPath: `${basePath(req)}/access-url`,
  uploadedAt: row.created_at,
}) : null;
const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, code: error.code, message: getErrorMessage(error) });

export const getNetworkProfitSignedCopy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const record = await context(connection, req);
    if (!record || record.release_status !== 'Released') return res.status(404).json({ message: 'Released Network Company Profit not found.' });
    return res.json({ success: true, data: {
      receipt: { receiptId: record.profit_release_id, referenceNumber: `NCP-${record.profit_release_id}`,
        unitId: record.unit, totalAmount: Number(record.release_amount),
        receiptDate: record.actual_release_date, payee: record.payee_name },
      signedCopy: fileResponse(req, await activeFile(connection, record.profit_release_id)),
    } });
  } catch (error) { return fail(res, error); } finally { connection.release(); }
};

export const createNetworkProfitSignedUploadSignature = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const record = await context(connection, req);
    if (!record || record.release_status !== 'Released') return res.status(404).json({ message: 'Release not found.' });
    if (req.body?.allowUnscanned) return res.status(409).json({ code: 'MALWARE_SCAN_REQUIRED', message: 'Company Profit signed acknowledgments must pass malware scanning.' });
    const file = { fileName: clean(req.body?.fileName), fileType: clean(req.body?.fileType), fileSize: Number(req.body?.fileSize || 0) };
    validateDocumentUploadRequest(file);
    const quota = await getPerceptionPointQuotaState({ requiredScans: 1 });
    if (!quota.configured || (quota.known && quota.insufficient)) {
      return res.status(503).json({ code: 'MALWARE_SCAN_UNAVAILABLE', message: 'Security scanning is unavailable. Try again when Cloudinary scanning is available.' });
    }
    const [[v]] = await connection.query(`SELECT COALESCE(MAX(file_version),0) + 1 AS version
      FROM lot_project_network_profit_signed_files WHERE profit_release_id = ?`, [record.profit_release_id]);
    const fileVersion = Number(v.version || 1);
    const storedFileName = buildSignedCopyStoredFileName({ prefix: `NCP-${record.profit_release_id}`, version: fileVersion, extension: getFileExtension(file) });
    const signature = createAuthenticatedSignedCopyUploadSignature({
      folder: folderFor(record), accountId: record.lot_project_account_id,
      parentType: 'network_company_profit', parentId: record.profit_release_id,
      storedFileName, scanRequested: true,
    });
    return res.json({ success: true, data: { ...signature, fileVersion } });
  } catch (error) { return fail(res, error); } finally { connection.release(); }
};

export const saveNetworkProfitSignedCopy = async (req, res) => {
  const connection = await db.getConnection(); let begun = false;
  try {
    const record = await context(connection, req);
    if (!record || record.release_status !== 'Released') return res.status(404).json({ message: 'Release not found.' });
    const file = req.body?.file || {};
    const safeFile = { fileName: clean(file.fileName), fileType: clean(file.fileType), fileSize: Number(file.fileSize || 0) };
    validateDocumentUploadRequest(safeFile);
    const publicId = clean(file.cloudinaryPublicId);
    if (!publicId) return res.status(400).json({ message: 'Missing Cloudinary public ID.' });
    const asset = await verifyAuthenticatedCloudinaryAsset({ publicId, resourceType: clean(file.cloudinaryResourceType) || 'image', expectedFolder: folderFor(record) });
    // Trust Cloudinary's actual metadata, NOT the client's fileSize/MIME claims.
    const assetBytes = Number(asset.bytes || 0);
    const format = clean(asset.format).toLowerCase();
    if (!assetBytes || assetBytes > 15 * 1024 * 1024 || !['pdf','jpg','jpeg','png'].includes(format)) {
      return res.status(422).json({ code: 'INVALID_SIGNED_FILE', message: 'Cloudinary file must be PDF, JPG, or PNG and no larger than 15MB.' });
    }
    const malware = getCloudinaryMalwareScanState(asset);
    if (malware.status === 'rejected' || malware.status === 'not_scanned') return res.status(422).json({ code: 'MALWARE_SCAN_REQUIRED', message: 'A malware scan is required for Company Profit signed acknowledgments.' });
    await connection.beginTransaction(); begun = true;
    // Serialize copy replacement and version assignment per released milestone.
    await connection.query(`SELECT id FROM lot_project_network_profit_releases WHERE id = ? FOR UPDATE`, [record.profit_release_id]);
    const [[v]] = await connection.query(`SELECT COALESCE(MAX(file_version),0) + 1 AS version
      FROM lot_project_network_profit_signed_files WHERE profit_release_id = ?`, [record.profit_release_id]);
    const version = Number(v.version || 1);
    await connection.query(`UPDATE lot_project_network_profit_signed_files SET file_status = 'replaced'
      WHERE profit_release_id = ? AND file_status = 'active'`, [record.profit_release_id]);
    const [created] = await connection.query(`INSERT INTO lot_project_network_profit_signed_files (
      profit_release_id, file_version, file_name, file_mime_type, file_size_bytes,
      cloudinary_asset_id, cloudinary_public_id, cloudinary_resource_type, cloudinary_version,
      cloudinary_format, cloudinary_asset_folder, malware_scan_status, malware_scan_provider,
      malware_scan_reason, malware_scanned_at, uploaded_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      record.profit_release_id, version, safeFile.fileName, format === 'pdf' ? 'application/pdf' : `image/${format === 'jpg' ? 'jpeg' : format}`,
      assetBytes, asset.asset_id, asset.public_id, asset.resource_type,
      asset.version || null, format, folderFor(record), malware.status || 'pending',
      malware.provider || 'perception_point', malware.reason || null,
      malware.status === 'approved' ? new Date() : null, req.authUser?.id || null,
    ]);
    await writeAuditLog(connection, req, {
      action: 'create', module: 'Commissions', entityType: 'lot_project_network_profit_signed_file',
      entityId: String(created.insertId), entityLabel: `${record.unit} · NCP-${record.profit_release_id}`,
      title: 'Uploaded signed Network Company Profit acknowledgment',
      description: `Stored signed acknowledgment version ${version} for Network Company Profit release NCP-${record.profit_release_id}.`,
      metadata: { releaseId: record.profit_release_id, fileName: safeFile.fileName, version },
    });
    await connection.commit(); begun = false;
    return res.status(201).json({ success: true, message: 'Signed Network Company Profit acknowledgment uploaded.',
      signedCopyId: Number(created.insertId), data: { signedCopy: fileResponse(req, await activeFile(connection, record.profit_release_id)) } });
  } catch (error) { if (begun) try { await connection.rollback(); } catch {} return fail(res, error); }
  finally { connection.release(); }
};

export const getNetworkProfitSignedAccessStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const record = await context(connection, req);
    if (!record || record.release_status !== 'Released') return res.status(404).json({ message: 'Release not found.' });
    const file = await activeFile(connection, record.profit_release_id);
    if (!file) return res.status(404).json({ message: 'Signed acknowledgment not found.' });
    // Status metadata only. Never expose private Cloudinary delivery URLs.
    return res.json({ success: true, data: {
      malwareScanStatus: file.malware_scan_status,
      contentPath: `${basePath(req)}/content`,
    } });
  } catch (error) { return fail(res, error); } finally { connection.release(); }
};

export const getNetworkProfitSignedContent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const record = await context(connection, req);
    if (!record || record.release_status !== 'Released') return res.status(404).json({ message: 'Release not found.' });
    const file = await activeFile(connection, record.profit_release_id);
    if (!file) return res.status(404).json({ message: 'Signed acknowledgment not found.' });
    if (file.malware_scan_status !== 'approved') return res.status(423).json({ code: 'MALWARE_SCAN_NOT_APPROVED', message: 'The signed acknowledgment is not yet cleared by security scanning.' });
    return sendAuthenticatedAssetContent(res, { publicId: file.cloudinary_public_id,
      format: file.cloudinary_format, resourceType: file.cloudinary_resource_type,
      fileName: file.file_name, fileMimeType: file.file_mime_type });
  } catch (error) { return fail(res, error); } finally { connection.release(); }
};

