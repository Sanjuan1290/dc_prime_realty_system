import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  getListingLookupWhere,
  getProjectBySlug,
  tableExists,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import {
  authorizeMalwareQuotaFallback,
  buildMalwareQuotaError,
  buildPaymentAcknowledgementSignedCopyFolder,
  sendAuthenticatedAssetContent,
  createAuthenticatedSignedCopyUploadSignature,
  getCloudinaryMalwareScanState,
  getPerceptionPointQuotaState,
  validateDocumentUploadRequest,
  verifyAuthenticatedCloudinaryAsset,
} from '../../../services/secureCloudinary.service.js';
import {
  buildSignedCopyStoredFileName,
  deriveStoredFileNameFromPublicId,
  getFileExtension,
  resolveListingStorageCode,
  resolvePaymentStorageCode,
  resolveProjectStorageCode,
} from '../../../services/storageCodes.service.js';

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

const getContext = async (connection, req) => {
  const slug = clean(req.params.projectSlug);
  const listingLookup = clean(req.params.listingId);
  const paymentId = Number(req.params.paymentId || 0);
  const project = await getProjectBySlug(slug);

  if (!project) return { errorStatus: 404, errorMessage: 'Lot project not found.' };
  if (!listingLookup) return { errorStatus: 400, errorMessage: 'Listing id is required.' };
  if (!paymentId) return { errorStatus: 400, errorMessage: 'Payment id is required.' };
  if (!(await tableExists(connection, 'lot_project_payment_acknowledgement_files'))) {
    return { errorStatus: 500, errorMessage: 'Signed acknowledgement receipt migration is required.' };
  }

  const lookup = getListingLookupWhere(listingLookup);
  const [rows] = await connection.query(
    `
      SELECT
        p.*,
        l.lot_project_listing_storage_code,
        l.lot_project_listing_unit_id,
        cp.buyer_full_name,
        account.account_reference,
        account.account_status
      FROM lot_project_payments p
      INNER JOIN lot_project_listings l
        ON l.lot_project_listing_id = p.lot_project_listing_id
       AND l.lot_project_id = p.lot_project_id
      LEFT JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = p.lot_project_client_profile_id
      LEFT JOIN lot_project_accounts account
        ON account.lot_project_account_id = p.lot_project_account_id
      WHERE p.lot_project_payment_id = ?
        AND p.lot_project_id = ?
        AND ${lookup.sql}
        AND p.lot_project_payment_status = 'Verified'
      LIMIT 1
    `,
    [paymentId, project.lot_project_id, ...lookup.params]
  );

  const payment = rows[0];
  if (!payment) return { errorStatus: 404, errorMessage: 'Verified payment not found for this listing.' };
  if (!Number(payment.lot_project_account_id || 0) || !clean(payment.account_reference)) {
    return { errorStatus: 409, errorMessage: 'This payment is not linked to a valid buyer account. Repair the account relationship before uploading a signed acknowledgement receipt.' };
  }

  return { project, payment };
};

const mapSignedCopy = (req, row = {}) => row?.lot_project_payment_acknowledgement_file_id ? ({
  id: Number(row.lot_project_payment_acknowledgement_file_id),
  signedCopyId: Number(row.lot_project_payment_acknowledgement_file_id),
  paymentId: Number(row.lot_project_payment_id),
  fileName: row.file_name || 'Signed acknowledgement receipt',
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
  accessPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(row.lot_project_payment_id)}/acknowledgement-signed-copy/access-url`,
  contentPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(row.lot_project_payment_id)}/acknowledgement-signed-copy/content`,
}) : null;

const getActiveFile = async (connection, paymentId) => {
  const [rows] = await connection.query(
    `
      SELECT file_row.*, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS uploaded_by_name
      FROM lot_project_payment_acknowledgement_files file_row
      LEFT JOIN users u ON u.id = file_row.uploaded_by_user_id
      WHERE file_row.lot_project_payment_id = ?
        AND file_row.file_status = 'active'
      ORDER BY file_row.lot_project_payment_acknowledgement_file_id DESC
      LIMIT 1
    `,
    [paymentId]
  );
  return rows[0] || null;
};

export const getLotProjectPaymentAcknowledgementSignedCopy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const file = await getActiveFile(connection, context.payment.lot_project_payment_id);
    return res.json({
      success: true,
      data: {
        payment: {
          paymentId: Number(context.payment.lot_project_payment_id),
          storageCode: resolvePaymentStorageCode(context.payment),
          buyerName: context.payment.buyer_full_name || '-',
          unitId: context.payment.lot_project_listing_unit_id,
          amount: Number(context.payment.lot_project_payment_amount || 0),
          paymentDate: context.payment.lot_project_payment_date,
          method: context.payment.lot_project_payment_method,
          referenceId: context.payment.lot_project_payment_reference_id || '-',
        },
        signedCopy: mapSignedCopy(req, file),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createLotProjectPaymentAcknowledgementSignedCopyUploadSignature = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const file = validateDocumentUploadRequest(req.body || {});
    const allowUnscanned = req.body?.allowUnscanned === true;
    const fallbackToken = clean(req.body?.fallbackToken);
    const subjectId = `payment_ack:${Number(context.payment.lot_project_account_id)}:${Number(context.payment.lot_project_payment_id)}`;
    let authorizedFallbackToken = fallbackToken;

    if (allowUnscanned) {
      const fallback = await authorizeMalwareQuotaFallback({
        token: fallbackToken,
        scope: 'payment_ack_signed_copy',
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
        scope: 'payment_ack_signed_copy',
        subjectId,
        uploadCount: 1,
      });
    }

    const [[versionRow]] = await connection.query(
      `SELECT COALESCE(MAX(file_version), 0) + 1 AS next_version FROM lot_project_payment_acknowledgement_files WHERE lot_project_payment_id = ?`,
      [context.payment.lot_project_payment_id]
    );
    const nextVersion = Math.max(1, Number(versionRow?.next_version || 1));
    const paymentStorageCode = resolvePaymentStorageCode(context.payment);
    const storedFileName = buildSignedCopyStoredFileName({
      prefix: `${paymentStorageCode}-ACK`,
      version: nextVersion,
      extension: getFileExtension(file),
    });
    const folder = buildPaymentAcknowledgementSignedCopyFolder({
      projectStorageCode: resolveProjectStorageCode(context.project),
      projectId: context.project.lot_project_id,
      listingStorageCode: resolveListingStorageCode(context.payment),
      listingId: context.payment.lot_project_listing_id,
      accountReference: context.payment.account_reference,
      paymentStorageCode,
      paymentId: context.payment.lot_project_payment_id,
    });
    const signed = createAuthenticatedSignedCopyUploadSignature({
      folder,
      accountId: context.payment.lot_project_account_id,
      parentType: 'payment_acknowledgement',
      parentId: context.payment.lot_project_payment_id,
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

export const saveLotProjectPaymentAcknowledgementSignedCopy = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const user = await getAuthenticatedUser(req);
    const file = normalizeUploadedFile(req.body || {});
    validateDocumentUploadRequest(file);
    if (!file.cloudinaryPublicId) return res.status(400).json({ message: 'Cloudinary public ID is required.' });

    const paymentStorageCode = resolvePaymentStorageCode(context.payment);
    const expectedFolder = buildPaymentAcknowledgementSignedCopyFolder({
      projectStorageCode: resolveProjectStorageCode(context.project),
      projectId: context.project.lot_project_id,
      listingStorageCode: resolveListingStorageCode(context.payment),
      listingId: context.payment.lot_project_listing_id,
      accountReference: context.payment.account_reference,
      paymentStorageCode,
      paymentId: context.payment.lot_project_payment_id,
    });
    const asset = await verifyAuthenticatedCloudinaryAsset({
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType || 'image',
      expectedFolder,
    });
    const malwareScan = getCloudinaryMalwareScanState(asset);
    if (malwareScan.status === 'rejected') {
      const error = new Error('The signed acknowledgement receipt was rejected because malware or malicious content was detected.');
      error.statusCode = 422;
      error.code = 'MALWARE_DETECTED';
      throw error;
    }

    const [[versionRow]] = await connection.query(
      `SELECT COALESCE(MAX(file_version), 0) + 1 AS next_version FROM lot_project_payment_acknowledgement_files WHERE lot_project_payment_id = ?`,
      [context.payment.lot_project_payment_id]
    );
    const nextVersion = Math.max(1, Number(versionRow?.next_version || 1));
    const storedFileName = deriveStoredFileNameFromPublicId(asset.public_id, getFileExtension(file)) || file.storedFileName || file.fileName;

    await connection.beginTransaction();
    await connection.query(
      `
        UPDATE lot_project_payment_acknowledgement_files
        SET file_status = 'replaced', replaced_at = NOW(), updated_at = NOW()
        WHERE lot_project_payment_id = ? AND file_status = 'active'
      `,
      [context.payment.lot_project_payment_id]
    );
    const [result] = await connection.query(
      `
        INSERT INTO lot_project_payment_acknowledgement_files (
          lot_project_payment_id,
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        context.payment.lot_project_payment_id,
        context.project.lot_project_id,
        context.payment.lot_project_listing_id,
        context.payment.lot_project_client_profile_id,
        context.payment.lot_project_account_id,
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

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_payment_acknowledgement_file',
      entityId: String(result.insertId),
      entityLabel: `${context.payment.lot_project_payment_reference_id || `Payment #${context.payment.lot_project_payment_id}`} — ${context.payment.lot_project_listing_unit_id}`,
      title: nextVersion > 1 ? 'Replaced signed acknowledgement receipt' : 'Uploaded signed acknowledgement receipt',
      description: `Stored signed acknowledgement receipt version ${nextVersion} for payment ${context.payment.lot_project_payment_reference_id || context.payment.lot_project_payment_id}.`,
      metadata: {
        paymentId: context.payment.lot_project_payment_id,
        accountId: context.payment.lot_project_account_id,
        signedCopyId: result.insertId,
        fileVersion: nextVersion,
        fileName: file.fileName,
      },
    });
    await connection.commit();

    const activeFile = await getActiveFile(connection, context.payment.lot_project_payment_id);
    return res.status(201).json({
      success: true,
      message: nextVersion > 1 ? 'Signed acknowledgement receipt replaced successfully.' : 'Signed acknowledgement receipt uploaded successfully.',
      signedCopyId: Number(result.insertId),
      data: { signedCopy: mapSignedCopy(req, activeFile) },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getLotProjectPaymentAcknowledgementSignedCopyAccessUrl = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const file = await getActiveFile(connection, context.payment.lot_project_payment_id);
    if (!file) return res.status(404).json({ message: 'Signed acknowledgement receipt not found.' });

    const malwareScanStatus = clean(file.malware_scan_status || 'not_scanned').toLowerCase();
    if (malwareScanStatus === 'pending') return res.status(423).json({ code: 'MALWARE_SCAN_PENDING', message: 'The signed acknowledgement receipt is still being scanned. Try again shortly.' });
    if (malwareScanStatus === 'rejected') return res.status(403).json({ code: 'MALWARE_DETECTED', message: 'The signed acknowledgement receipt was blocked because malware was detected.' });
    if (malwareScanStatus === 'error') return res.status(503).json({ code: 'MALWARE_SCAN_ERROR', message: 'The security scan did not complete successfully. The signed acknowledgement receipt is temporarily unavailable.' });

    return res.json({
      success: true,
      data: {
        contentPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(context.payment.lot_project_payment_id)}/acknowledgement-signed-copy/content`,
        malwareScanStatus,
        securityWarning: malwareScanStatus === 'not_scanned'
          ? 'This signed acknowledgement receipt was uploaded without malware scanning because the scanning quota was unavailable.'
          : null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
export const getLotProjectPaymentAcknowledgementSignedCopyContent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const file = await getActiveFile(connection, context.payment.lot_project_payment_id);
    if (!file) return res.status(404).json({ message: 'Signed acknowledgement receipt not found.' });

    const malwareScanStatus = clean(file.malware_scan_status || 'not_scanned').toLowerCase();
    if (malwareScanStatus === 'pending') return res.status(423).json({ code: 'MALWARE_SCAN_PENDING', message: 'The signed acknowledgement receipt is still being scanned. Try again shortly.' });
    if (malwareScanStatus === 'rejected') return res.status(403).json({ code: 'MALWARE_DETECTED', message: 'The signed acknowledgement receipt was blocked because malware was detected.' });
    if (malwareScanStatus === 'error') return res.status(503).json({ code: 'MALWARE_SCAN_ERROR', message: 'The security scan did not complete successfully. The signed acknowledgement receipt is temporarily unavailable.' });

    return await sendAuthenticatedAssetContent(res, {
      publicId: file.cloudinary_public_id,
      format: file.cloudinary_format,
      resourceType: file.cloudinary_resource_type,
      fileName: file.file_name || file.stored_file_name || 'signed-acknowledgement-receipt',
      fileMimeType: file.file_mime_type,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

