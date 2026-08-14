import { db } from '../../db/connect.js';
import {
  getAuthenticatedUser,
  getErrorMessage,
  tableExists,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import { isFullAccessAdministrator } from '../../config/permissions.js';
import { writeAuditLog } from './auditLogs.controller.js';
import {
  authorizeMalwareQuotaFallback,
  buildCommissionReceiptSignedCopyFolder,
  buildMalwareQuotaError,
  createAuthenticatedAccessUrl,
  createAuthenticatedSignedCopyUploadSignature,
  getCloudinaryMalwareScanState,
  getPerceptionPointQuotaState,
  validateDocumentUploadRequest,
  verifyAuthenticatedCloudinaryAsset,
} from '../../services/secureCloudinary.service.js';
import {
  buildSignedCopyStoredFileName,
  deriveStoredFileNameFromPublicId,
  getFileExtension,
  resolveListingStorageCode,
  resolveProjectStorageCode,
} from '../../services/storageCodes.service.js';

const clean = (value) => String(value ?? '').trim();

const normalizeUploadedFile = (body = {}) => {
  const file = body.file && typeof body.file === 'object' ? body.file : body;
  return {
    fileName: clean(file.fileName || file.file_name || file.originalFilename || file.original_filename),
    storedFileName: clean(file.storedFileName || file.stored_file_name) || null,
    fileType: clean(file.fileType || file.file_type || file.mimeType || file.mime_type),
    fileSize: Number(file.fileSize || file.file_size || file.bytes || 0),
    cloudinaryAssetId: file.cloudinaryAssetId || file.cloudinary_asset_id || file.asset_id || null,
    cloudinaryPublicId: file.cloudinaryPublicId || file.cloudinary_public_id || file.public_id || null,
    cloudinaryResourceType: file.cloudinaryResourceType || file.cloudinary_resource_type || file.resource_type || null,
    cloudinaryDeliveryType: file.cloudinaryDeliveryType || file.cloudinary_delivery_type || file.type || null,
    cloudinaryVersion: Number(file.cloudinaryVersion || file.cloudinary_version || file.version || 0) || null,
    cloudinaryAssetFolder: file.cloudinaryAssetFolder || file.cloudinary_asset_folder || file.asset_folder || null,
    cloudinaryFormat: file.cloudinaryFormat || file.cloudinary_format || file.format || null,
  };
};

const requireManager = async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ message: 'Please login before managing signed Proof of Income copies.' });
    return null;
  }
  if (!isFullAccessAdministrator(user)) {
    res.status(403).json({ message: 'Admin access is required to manage signed Proof of Income copies.' });
    return null;
  }
  return user;
};

const getContext = async (connection, sellerId, receiptId) => {
  if (!(await tableExists(connection, 'lot_project_commission_receipt_files'))) {
    return { errorStatus: 500, errorMessage: 'Signed Proof of Income migration is required.' };
  }
  if (!(await tableExists(connection, 'lot_project_commission_receipts'))) {
    return { errorStatus: 500, errorMessage: 'Proof of Income receipt table is unavailable.' };
  }

  const [rows] = await connection.query(
    `
      SELECT
        receipt.*,
        commission.lot_project_account_id AS commission_account_id,
        project.lot_project_storage_code,
        project.lot_project_name,
        project.lot_project_location,
        listing.lot_project_listing_storage_code,
        listing.lot_project_listing_unit_id,
        profile.buyer_full_name,
        account.account_reference
      FROM lot_project_commission_receipts receipt
      INNER JOIN lot_project_commissions commission
        ON commission.lot_project_commission_id = receipt.lot_project_commission_id
      INNER JOIN lot_projects project
        ON project.lot_project_id = receipt.lot_project_id
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = receipt.lot_project_listing_id
      INNER JOIN lot_project_client_profiles profile
        ON profile.lot_project_client_profile_id = receipt.lot_project_client_profile_id
      LEFT JOIN lot_project_accounts account
        ON account.lot_project_account_id = COALESCE(receipt.lot_project_account_id, commission.lot_project_account_id)
      WHERE receipt.lot_project_commission_receipt_id = ?
        AND receipt.accredited_seller_id = ?
        AND receipt.receipt_status = 'active'
      LIMIT 1
    `,
    [receiptId, sellerId]
  );

  const receipt = rows[0];
  if (!receipt) return { errorStatus: 404, errorMessage: 'Proof of Income receipt not found.' };
  receipt.resolved_account_id = Number(receipt.lot_project_account_id || receipt.commission_account_id || 0);
  if (!receipt.resolved_account_id || !clean(receipt.account_reference)) {
    return { errorStatus: 409, errorMessage: 'This Proof of Income receipt is not linked to a valid buyer account. Repair the account relationship before uploading a signed copy.' };
  }
  return { receipt };
};

const getActiveFile = async (connection, receiptId) => {
  const [rows] = await connection.query(
    `
      SELECT file_row.*, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS uploaded_by_name
      FROM lot_project_commission_receipt_files file_row
      LEFT JOIN users u ON u.id = file_row.uploaded_by_user_id
      WHERE file_row.lot_project_commission_receipt_id = ?
        AND file_row.file_status = 'active'
      ORDER BY file_row.lot_project_commission_receipt_file_id DESC
      LIMIT 1
    `,
    [receiptId]
  );
  return rows[0] || null;
};

const mapSignedCopy = (sellerId, receiptId, row = {}) => row?.lot_project_commission_receipt_file_id ? ({
  id: Number(row.lot_project_commission_receipt_file_id),
  signedCopyId: Number(row.lot_project_commission_receipt_file_id),
  receiptId: Number(row.lot_project_commission_receipt_id),
  fileName: row.file_name || 'Signed Proof of Income',
  storedFileName: row.stored_file_name || null,
  version: Number(row.file_version || 1),
  fileType: row.file_mime_type || '',
  fileSize: Number(row.file_size_bytes || 0),
  uploadedAt: row.created_at || null,
  uploadedBy: row.uploaded_by_name || '-',
  malwareScanStatus: clean(row.malware_scan_status || 'not_scanned').toLowerCase(),
  malwareScanProvider: row.malware_scan_provider || null,
  malwareScanReason: row.malware_scan_reason || null,
  malwareScannedAt: row.malware_scanned_at || null,
  accessPath: `/accredited/${Number(sellerId)}/proof-of-income-receipts/${Number(receiptId)}/signed-copy/access-url`,
}) : null;

export const getAccreditedSellerProofOfIncomeSignedCopy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const user = await requireManager(req, res);
    if (!user) return;
    const sellerId = Number(req.params.sellerId || 0);
    const receiptId = Number(req.params.receiptId || 0);
    if (!sellerId || !receiptId) return res.status(400).json({ message: 'Seller id and receipt id are required.' });
    const context = await getContext(connection, sellerId, receiptId);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const file = await getActiveFile(connection, receiptId);
    return res.json({
      success: true,
      data: {
        receipt: {
          receiptId,
          referenceNumber: context.receipt.reference_number,
          receiptDate: context.receipt.receipt_date,
          totalAmount: Number(context.receipt.total_amount || 0),
          projectName: context.receipt.lot_project_name,
          unitId: context.receipt.lot_project_listing_unit_id,
          buyerName: context.receipt.buyer_full_name,
        },
        signedCopy: mapSignedCopy(sellerId, receiptId, file),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createAccreditedSellerProofOfIncomeSignedCopyUploadSignature = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const user = await requireManager(req, res);
    if (!user) return;
    const sellerId = Number(req.params.sellerId || 0);
    const receiptId = Number(req.params.receiptId || 0);
    if (!sellerId || !receiptId) return res.status(400).json({ message: 'Seller id and receipt id are required.' });
    const context = await getContext(connection, sellerId, receiptId);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const file = validateDocumentUploadRequest(req.body || {});
    const allowUnscanned = req.body?.allowUnscanned === true;
    const fallbackToken = clean(req.body?.fallbackToken);
    const subjectId = `proof_income:${context.receipt.resolved_account_id}:${receiptId}`;
    let authorizedFallbackToken = fallbackToken;
    if (allowUnscanned) {
      const fallback = await authorizeMalwareQuotaFallback({
        token: fallbackToken,
        scope: 'proof_income_signed_copy',
        subjectId,
        uploadCount: 1,
      });
      authorizedFallbackToken = fallback.token;
    } else {
      const quota = await getPerceptionPointQuotaState({ requiredScans: 1 });
      if (!quota.configured) {
        const error = new Error('Security scanning is not configured. Set CLOUDINARY_MALWARE_NOTIFICATION_URL before accepting uploads.');
        error.statusCode = 503;
        error.code = 'MALWARE_SCAN_NOT_CONFIGURED';
        throw error;
      }
      if (quota.known && quota.insufficient) throw buildMalwareQuotaError({
        quota,
        scope: 'proof_income_signed_copy',
        subjectId,
        uploadCount: 1,
      });
    }

    const [[versionRow]] = await connection.query(
      `SELECT COALESCE(MAX(file_version), 0) + 1 AS next_version FROM lot_project_commission_receipt_files WHERE lot_project_commission_receipt_id = ?`,
      [receiptId]
    );
    const nextVersion = Math.max(1, Number(versionRow?.next_version || 1));
    const storedFileName = buildSignedCopyStoredFileName({
      prefix: `POI-${String(receiptId).padStart(6, '0')}`,
      version: nextVersion,
      extension: getFileExtension(file),
    });
    const folder = buildCommissionReceiptSignedCopyFolder({
      projectStorageCode: resolveProjectStorageCode(context.receipt),
      projectId: context.receipt.lot_project_id,
      listingStorageCode: resolveListingStorageCode(context.receipt),
      listingId: context.receipt.lot_project_listing_id,
      accountReference: context.receipt.account_reference,
      receiptId,
    });
    const signed = createAuthenticatedSignedCopyUploadSignature({
      folder,
      accountId: context.receipt.resolved_account_id,
      parentType: 'proof_of_income',
      parentId: receiptId,
      storedFileName,
      scanRequested: !allowUnscanned,
      fallbackToken: authorizedFallbackToken,
    });
    return res.json({ success: true, data: { ...signed, fileVersion: nextVersion } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error), data: error.data || undefined });
  } finally {
    connection.release();
  }
};

export const saveAccreditedSellerProofOfIncomeSignedCopy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const user = await requireManager(req, res);
    if (!user) return;
    const sellerId = Number(req.params.sellerId || 0);
    const receiptId = Number(req.params.receiptId || 0);
    if (!sellerId || !receiptId) return res.status(400).json({ message: 'Seller id and receipt id are required.' });
    const context = await getContext(connection, sellerId, receiptId);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const file = normalizeUploadedFile(req.body || {});
    validateDocumentUploadRequest(file);
    if (!file.cloudinaryPublicId) return res.status(400).json({ message: 'Cloudinary public ID is required.' });
    const expectedFolder = buildCommissionReceiptSignedCopyFolder({
      projectStorageCode: resolveProjectStorageCode(context.receipt),
      projectId: context.receipt.lot_project_id,
      listingStorageCode: resolveListingStorageCode(context.receipt),
      listingId: context.receipt.lot_project_listing_id,
      accountReference: context.receipt.account_reference,
      receiptId,
    });
    const asset = await verifyAuthenticatedCloudinaryAsset({
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType || 'image',
      expectedFolder,
    });
    const malwareScan = getCloudinaryMalwareScanState(asset);
    if (malwareScan.status === 'rejected') {
      const error = new Error('The signed Proof of Income was rejected because malware or malicious content was detected.');
      error.statusCode = 422;
      error.code = 'MALWARE_DETECTED';
      throw error;
    }

    const [[versionRow]] = await connection.query(
      `SELECT COALESCE(MAX(file_version), 0) + 1 AS next_version FROM lot_project_commission_receipt_files WHERE lot_project_commission_receipt_id = ?`,
      [receiptId]
    );
    const nextVersion = Math.max(1, Number(versionRow?.next_version || 1));
    const storedFileName = deriveStoredFileNameFromPublicId(asset.public_id, getFileExtension(file)) || file.storedFileName || file.fileName;

    await connection.beginTransaction();
    await connection.query(
      `UPDATE lot_project_commission_receipt_files SET file_status = 'replaced', replaced_at = NOW(), updated_at = NOW() WHERE lot_project_commission_receipt_id = ? AND file_status = 'active'`,
      [receiptId]
    );
    const [result] = await connection.query(
      `
        INSERT INTO lot_project_commission_receipt_files (
          lot_project_commission_receipt_id,
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          accredited_seller_id,
          file_name,
          stored_file_name,
          file_version,
          file_mime_type,
          file_size_bytes,
          cloudinary_asset_id,
          cloudinary_public_id,
          cloudinary_resource_type,
          cloudinary_delivery_type,
          cloudinary_version,
          cloudinary_asset_folder,
          cloudinary_format,
          malware_scan_status,
          malware_scan_provider,
          malware_scan_reason,
          malware_scanned_at,
          uploaded_by_user_id,
          file_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        receiptId,
        context.receipt.lot_project_id,
        context.receipt.lot_project_listing_id,
        context.receipt.lot_project_client_profile_id,
        context.receipt.resolved_account_id,
        sellerId,
        file.fileName,
        storedFileName,
        nextVersion,
        file.fileType,
        Number(asset.bytes || file.fileSize || 0),
        asset.asset_id || file.cloudinaryAssetId || null,
        asset.public_id,
        asset.resource_type || file.cloudinaryResourceType || 'image',
        asset.type || 'authenticated',
        Number(asset.version || file.cloudinaryVersion || 0) || null,
        asset.asset_folder || expectedFolder,
        asset.format || file.cloudinaryFormat || null,
        malwareScan.status || 'not_scanned',
        malwareScan.provider || null,
        malwareScan.reason || null,
        malwareScan.status === 'approved' ? new Date() : null,
        user?.id || null,
      ]
    );

    await connection.query(
      `UPDATE lot_project_commission_receipts SET lot_project_account_id = COALESCE(lot_project_account_id, ?) WHERE lot_project_commission_receipt_id = ?`,
      [context.receipt.resolved_account_id, receiptId]
    );
    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Commissions',
      entityType: 'lot_project_commission_receipt_file',
      entityId: String(result.insertId),
      entityLabel: `${context.receipt.reference_number} — ${context.receipt.lot_project_listing_unit_id}`,
      title: nextVersion > 1 ? 'Replaced signed Proof of Income' : 'Uploaded signed Proof of Income',
      description: `Stored signed Proof of Income version ${nextVersion} for receipt ${context.receipt.reference_number}.`,
      metadata: {
        sellerId,
        receiptId,
        accountId: context.receipt.resolved_account_id,
        signedCopyId: result.insertId,
        fileVersion: nextVersion,
        fileName: file.fileName,
      },
    });
    await connection.commit();

    const activeFile = await getActiveFile(connection, receiptId);
    return res.status(201).json({
      success: true,
      message: nextVersion > 1 ? 'Signed Proof of Income replaced successfully.' : 'Signed Proof of Income uploaded successfully.',
      signedCopyId: Number(result.insertId),
      data: { signedCopy: mapSignedCopy(sellerId, receiptId, activeFile) },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getAccreditedSellerProofOfIncomeSignedCopyAccessUrl = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const user = await requireManager(req, res);
    if (!user) return;
    const sellerId = Number(req.params.sellerId || 0);
    const receiptId = Number(req.params.receiptId || 0);
    if (!sellerId || !receiptId) return res.status(400).json({ message: 'Seller id and receipt id are required.' });
    const context = await getContext(connection, sellerId, receiptId);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const file = await getActiveFile(connection, receiptId);
    if (!file) return res.status(404).json({ message: 'Signed Proof of Income not found.' });

    const malwareScanStatus = clean(file.malware_scan_status || 'not_scanned').toLowerCase();
    if (malwareScanStatus === 'pending') return res.status(423).json({ code: 'MALWARE_SCAN_PENDING', message: 'The signed Proof of Income is still being scanned. Try again shortly.' });
    if (malwareScanStatus === 'rejected') return res.status(403).json({ code: 'MALWARE_DETECTED', message: 'The signed Proof of Income was blocked because malware was detected.' });
    if (malwareScanStatus === 'error') return res.status(503).json({ code: 'MALWARE_SCAN_ERROR', message: 'The security scan did not complete successfully. The signed Proof of Income is temporarily unavailable.' });

    return res.json({
      success: true,
      data: {
        url: createAuthenticatedAccessUrl({
          publicId: file.cloudinary_public_id,
          format: file.cloudinary_format,
          resourceType: file.cloudinary_resource_type,
          expiresInSeconds: 600,
        }),
        expiresInSeconds: 600,
        malwareScanStatus,
        securityWarning: malwareScanStatus === 'not_scanned'
          ? 'This signed Proof of Income was uploaded without malware scanning because the scanning quota was unavailable.'
          : null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
