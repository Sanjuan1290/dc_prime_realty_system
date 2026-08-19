import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getListingLookupWhere,
  getAuthenticatedUser,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import {
  buildPaymentProofFolder,
  sendAuthenticatedAssetContent,
  createAuthenticatedPaymentProofUploadSignature,
  destroyCloudinaryAssets,
  validateDocumentUploadRequest,
  verifyAuthenticatedCloudinaryAsset,
  getCloudinaryMalwareScanState,
  getPerceptionPointQuotaState,
  authorizeMalwareQuotaFallback,
  buildMalwareQuotaError,
} from '../../../services/secureCloudinary.service.js';
import {
  buildPaymentProofStoredFileName,
  deriveStoredFileNameFromPublicId,
  getFileExtension,
  parsePaymentProofSequenceFromName,
  resolveListingStorageCode,
  resolvePaymentStorageCode,
  resolveProjectStorageCode,
} from '../../../services/storageCodes.service.js';

const MAX_PROOFS_PER_PAYMENT = 5;

const clean = (value) => String(value ?? '').trim();

const normalizeUploadedProofs = (body = {}) => {
  const rawFiles = Array.isArray(body.files) ? body.files : [];

  return rawFiles
    .map((file) => {
      if (!file || typeof file !== 'object') return null;
      return {
        fileName: clean(file.fileName || file.file_name || file.originalFilename || file.original_filename),
        storedFileName: clean(file.storedFileName || file.stored_file_name) || null,
        proofSequence: Number(file.proofSequence || file.proof_sequence || 0) || null,
        fileType: clean(file.fileType || file.file_type || file.mimeType || file.mime_type),
        fileSize: Number(file.fileSize || file.file_size || file.bytes || 0),
        cloudinaryAssetId: file.cloudinaryAssetId || file.cloudinary_asset_id || file.asset_id || null,
        cloudinaryPublicId: file.cloudinaryPublicId || file.cloudinary_public_id || file.public_id || null,
        cloudinaryResourceType: file.cloudinaryResourceType || file.cloudinary_resource_type || file.resource_type || null,
        cloudinaryDeliveryType: file.cloudinaryDeliveryType || file.cloudinary_delivery_type || file.type || null,
        cloudinaryVersion: Number(file.cloudinaryVersion || file.cloudinary_version || file.version || 0) || null,
        cloudinaryFolder: file.cloudinaryFolder || file.cloudinary_folder || file.folder || null,
        cloudinaryAssetFolder: file.cloudinaryAssetFolder || file.cloudinary_asset_folder || file.asset_folder || null,
        cloudinaryFormat: file.cloudinaryFormat || file.cloudinary_format || file.format || null,
      };
    })
    .filter(Boolean);
};

const getPaymentProofContext = async (connection, req) => {
  const slug = clean(req.params.projectSlug);
  const listingLookup = clean(req.params.listingId);
  const paymentId = Number(req.params.paymentId || 0);
  const project = await getProjectBySlug(slug);

  if (!project) return { errorStatus: 404, errorMessage: 'Lot project not found.' };
  if (!listingLookup) return { errorStatus: 400, errorMessage: 'Listing id is required.' };
  if (!paymentId) return { errorStatus: 400, errorMessage: 'Payment id is required.' };
  if (!(await tableExists(connection, 'lot_project_payment_proofs'))) {
    return { errorStatus: 500, errorMessage: 'Payment proof migration is required.' };
  }

  const lookup = getListingLookupWhere(listingLookup);
  const [rows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_listing_storage_code,
        l.lot_project_listing_unit_id,
        p.lot_project_payment_id,
        p.lot_project_payment_storage_code,
        p.lot_project_payment_created_at,
        p.lot_project_client_profile_id,
        p.lot_project_account_id,
        p.lot_project_payment_amount,
        p.lot_project_payment_date,
        p.lot_project_payment_reference_id,
        p.lot_project_payment_method,
        p.lot_project_payment_status,
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
      LIMIT 1
    `,
    [paymentId, project.lot_project_id, ...lookup.params]
  );

  const payment = rows[0];
  if (!payment) return { errorStatus: 404, errorMessage: 'Payment not found for this listing.' };

  return { project, payment };
};

const mapProof = (req, row = {}) => ({
  id: Number(row.lot_project_payment_proof_id || 0),
  proofId: Number(row.lot_project_payment_proof_id || 0),
  paymentId: Number(row.lot_project_payment_id || 0),
  fileName: row.file_name || 'Payment proof',
  storedFileName: row.stored_file_name || null,
  proofSequence: Number(row.proof_sequence || 0) || null,
  fileType: row.file_mime_type || '',
  fileSize: Number(row.file_size_bytes || 0),
  note: row.note || '',
  protected: true,
  uploadedBy: row.uploaded_by_name || '-',
  uploadedAt: row.created_at || null,
  malwareScanStatus: clean(row.malware_scan_status || 'not_scanned').toLowerCase(),
  malwareScanProvider: row.malware_scan_provider || null,
  malwareScanReason: row.malware_scan_reason || null,
  malwareScannedAt: row.malware_scanned_at || null,
  accessPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(row.lot_project_payment_id || 0)}/proofs/${Number(row.lot_project_payment_proof_id || 0)}/access-url`,
  contentPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(row.lot_project_payment_id || 0)}/proofs/${Number(row.lot_project_payment_proof_id || 0)}/content`,
});

export const getLotProjectPaymentProofs = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const [rows] = await connection.query(
      `
        SELECT
          proof.*,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS uploaded_by_name
        FROM lot_project_payment_proofs proof
        LEFT JOIN users u ON u.id = proof.uploaded_by_user_id
        WHERE proof.lot_project_payment_id = ?
          AND proof.proof_status = 'active'
        ORDER BY proof.created_at DESC, proof.lot_project_payment_proof_id DESC
      `,
      [context.payment.lot_project_payment_id]
    );

    return res.json({
      success: true,
      data: {
        payment: {
          paymentId: context.payment.lot_project_payment_id,
          storageCode: resolvePaymentStorageCode(context.payment),
          buyerName: context.payment.buyer_full_name || '-',
          unitId: context.payment.lot_project_listing_unit_id,
          amount: Number(context.payment.lot_project_payment_amount || 0),
          paymentDate: context.payment.lot_project_payment_date,
          method: context.payment.lot_project_payment_method,
          referenceId: context.payment.lot_project_payment_reference_id || '-',
          status: context.payment.lot_project_payment_status,
        },
        proofs: rows.map((row) => mapProof(req, row)),
        maxProofs: MAX_PROOFS_PER_PAYMENT,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createLotProjectPaymentProofUploadSignature = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_payment_proofs WHERE lot_project_payment_id = ? AND proof_status = 'active'`,
      [context.payment.lot_project_payment_id]
    );
    if (Number(countRows[0]?.total || 0) >= MAX_PROOFS_PER_PAYMENT) {
      return res.status(400).json({ message: `A payment can have up to ${MAX_PROOFS_PER_PAYMENT} proof files.` });
    }

    const file = validateDocumentUploadRequest(req.body || {});
    const uploadIndex = Math.max(1, Number(req.body?.uploadIndex || 1));
    const uploadCount = Math.max(uploadIndex, Number(req.body?.uploadCount || 1));
    if (uploadIndex > MAX_PROOFS_PER_PAYMENT || uploadCount > MAX_PROOFS_PER_PAYMENT) {
      return res.status(400).json({ message: `A payment can have up to ${MAX_PROOFS_PER_PAYMENT} proof files.` });
    }

    const allowUnscanned = req.body?.allowUnscanned === true;
    const fallbackToken = clean(req.body?.fallbackToken);
    const subjectId = `payment:${Number(context.payment.lot_project_account_id || 0)}:${Number(context.payment.lot_project_payment_id)}`;
    let authorizedFallbackToken = fallbackToken;

    if (allowUnscanned) {
      const fallback = await authorizeMalwareQuotaFallback({
        token: fallbackToken,
        scope: 'payment_proof',
        subjectId,
        uploadCount,
      });
      authorizedFallbackToken = fallback.token;
    } else if (uploadIndex === 1) {
      const quota = await getPerceptionPointQuotaState({ requiredScans: uploadCount });
      if (!quota.configured) {
        const error = new Error('Security scanning is not configured. Set CLOUDINARY_MALWARE_NOTIFICATION_URL before accepting uploads.');
        error.statusCode = 503;
        error.code = 'MALWARE_SCAN_NOT_CONFIGURED';
        throw error;
      }
      if (quota.known && quota.insufficient) {
        throw buildMalwareQuotaError({
          quota,
          scope: 'payment_proof',
          subjectId,
          uploadCount,
        });
      }
    }

    const [sequenceRows] = await connection.query(
      `SELECT COALESCE(MAX(proof_sequence), 0) AS max_sequence FROM lot_project_payment_proofs WHERE lot_project_payment_id = ?`,
      [context.payment.lot_project_payment_id]
    );
    const proofSequence = Number(sequenceRows[0]?.max_sequence || 0) + uploadIndex;
    const paymentStorageCode = resolvePaymentStorageCode(context.payment);
    const storedFileName = buildPaymentProofStoredFileName({
      paymentStorageCode,
      sequence: proofSequence,
      extension: getFileExtension(file),
    });
    const folder = buildPaymentProofFolder({
      projectStorageCode: resolveProjectStorageCode(context.project),
      projectId: context.project.lot_project_id,
      projectLocationCode: context.project.lot_project_location_code,
      listingStorageCode: resolveListingStorageCode(context.payment),
      listingId: context.payment.lot_project_listing_id,
      accountReference: context.payment.account_reference || `ACC-${String(Number(context.payment.lot_project_account_id || 0)).padStart(6, '0')}`,
      paymentStorageCode,
      paymentId: context.payment.lot_project_payment_id,
    });

    const signature = createAuthenticatedPaymentProofUploadSignature({
      folder,
      accountId: context.payment.lot_project_account_id,
      paymentId: context.payment.lot_project_payment_id,
      storedFileName,
      scanRequested: !allowUnscanned,
      fallbackToken: authorizedFallbackToken,
    });

    return res.json({
      success: true,
      data: {
        ...signature,
        proofSequence,
        maxFileBytes: 15 * 1024 * 1024,
        maxProofs: MAX_PROOFS_PER_PAYMENT,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      code: error.code || undefined,
      message: getErrorMessage(error),
      ...(error.data ? { data: error.data } : {}),
    });
  } finally {
    connection.release();
  }
};

export const saveLotProjectPaymentProofs = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const user = await getAuthenticatedUser(req);
    const files = normalizeUploadedProofs(req.body || {});
    const note = clean(req.body?.note).slice(0, 500) || null;
    if (!files.length) return res.status(400).json({ message: 'Choose at least one payment proof file.' });

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_payment_proofs WHERE lot_project_payment_id = ? AND proof_status = 'active'`,
      [context.payment.lot_project_payment_id]
    );
    const existingCount = Number(countRows[0]?.total || 0);
    if (existingCount + files.length > MAX_PROOFS_PER_PAYMENT) {
      return res.status(400).json({ message: `A payment can have up to ${MAX_PROOFS_PER_PAYMENT} proof files. ${existingCount} already exist.` });
    }

    const paymentStorageCode = resolvePaymentStorageCode(context.payment);
    const expectedFolder = buildPaymentProofFolder({
      projectStorageCode: resolveProjectStorageCode(context.project),
      projectId: context.project.lot_project_id,
      projectLocationCode: context.project.lot_project_location_code,
      listingStorageCode: resolveListingStorageCode(context.payment),
      listingId: context.payment.lot_project_listing_id,
      accountReference: context.payment.account_reference || `ACC-${String(Number(context.payment.lot_project_account_id || 0)).padStart(6, '0')}`,
      paymentStorageCode,
      paymentId: context.payment.lot_project_payment_id,
    });

    const verified = [];
    for (const file of files) {
      validateDocumentUploadRequest({ fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize });
      if (!file.cloudinaryPublicId) throw Object.assign(new Error('Cloudinary public ID is missing.'), { statusCode: 400 });
      const asset = await verifyAuthenticatedCloudinaryAsset({
        publicId: file.cloudinaryPublicId,
        resourceType: file.cloudinaryResourceType || 'image',
        expectedFolder,
      });
      const malwareScan = getCloudinaryMalwareScanState(asset);
      if (malwareScan.status === 'rejected') {
        const error = new Error(`${file.fileName} was rejected because malware or malicious content was detected.`);
        error.statusCode = 422;
        error.code = 'MALWARE_DETECTED';
        throw error;
      }
      const storedFileName = deriveStoredFileNameFromPublicId(
        asset.public_id,
        getFileExtension({ fileName: file.fileName, fileType: file.fileType })
      );
      verified.push({
        file: {
          ...file,
          storedFileName,
          proofSequence: parsePaymentProofSequenceFromName(storedFileName),
          malwareScanStatus: malwareScan.status,
          malwareScanProvider: malwareScan.provider,
          malwareScanReason: malwareScan.reason,
          malwareScannedAt: malwareScan.status === 'approved' ? new Date().toISOString() : null,
        },
        asset,
      });
    }

    await connection.beginTransaction();
    const insertedIds = [];
    for (const { file, asset } of verified) {
      const [result] = await connection.query(
        `
          INSERT INTO lot_project_payment_proofs (
            lot_project_id,
            lot_project_listing_id,
            lot_project_client_profile_id,
            lot_project_account_id,
            lot_project_payment_id,
            file_name,
            stored_file_name,
            proof_sequence,
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
            note,
            uploaded_by_user_id,
            proof_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `,
        [
          context.project.lot_project_id,
          context.payment.lot_project_listing_id,
          context.payment.lot_project_client_profile_id,
          context.payment.lot_project_account_id || null,
          context.payment.lot_project_payment_id,
          file.fileName,
          file.storedFileName || file.fileName,
          Number(file.proofSequence || parsePaymentProofSequenceFromName(file.storedFileName) || 1),
          file.fileType,
          Number(asset.bytes || file.fileSize || 0),
          asset.asset_id || file.cloudinaryAssetId || null,
          asset.public_id,
          asset.resource_type || file.cloudinaryResourceType || 'image',
          asset.type || 'authenticated',
          Number(asset.version || file.cloudinaryVersion || 0) || null,
          asset.asset_folder || expectedFolder,
          asset.format || file.cloudinaryFormat || null,
          file.malwareScanStatus || 'not_scanned',
          file.malwareScanProvider || null,
          file.malwareScanReason || null,
          file.malwareScannedAt ? new Date(file.malwareScannedAt) : null,
          note,
          user?.id || null,
        ]
      );
      insertedIds.push(result.insertId);
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_payment_proof',
      entityId: String(context.payment.lot_project_payment_id),
      entityLabel: `${context.payment.lot_project_payment_reference_id || `Payment #${context.payment.lot_project_payment_id}`} — ${context.payment.lot_project_listing_unit_id}`,
      title: 'Uploaded payment proof',
      description: `Uploaded ${insertedIds.length} protected payment proof file(s).`,
      metadata: {
        paymentId: context.payment.lot_project_payment_id,
        listingId: context.payment.lot_project_listing_id,
        proofIds: insertedIds,
        fileCount: insertedIds.length,
      },
    });

    await connection.commit();
    return res.status(201).json({ success: true, message: `${insertedIds.length} payment proof file(s) uploaded successfully.`, proofIds: insertedIds });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getLotProjectPaymentProofAccessUrl = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const proofId = Number(req.params.proofId || 0);
    if (!proofId) return res.status(400).json({ message: 'Payment proof id is required.' });

    const [rows] = await connection.query(
      `
        SELECT *
        FROM lot_project_payment_proofs
        WHERE lot_project_payment_proof_id = ?
          AND lot_project_payment_id = ?
          AND proof_status = 'active'
        LIMIT 1
      `,
      [proofId, context.payment.lot_project_payment_id]
    );
    const proof = rows[0];
    if (!proof) return res.status(404).json({ message: 'Payment proof not found.' });

    const malwareScanStatus = clean(proof.malware_scan_status || 'not_scanned').toLowerCase();
    if (malwareScanStatus === 'pending') {
      return res.status(423).json({
        code: 'MALWARE_SCAN_PENDING',
        message: 'This payment proof is still being scanned for security threats. Try again shortly.',
      });
    }
    if (malwareScanStatus === 'rejected') {
      return res.status(403).json({
        code: 'MALWARE_DETECTED',
        message: 'This payment proof was blocked because the security scan detected malicious content.',
      });
    }
    if (malwareScanStatus === 'error') {
      return res.status(503).json({
        code: 'MALWARE_SCAN_ERROR',
        message: 'The security scan did not complete successfully. This payment proof is temporarily unavailable.',
      });
    }

    return res.json({
      success: true,
      data: {
        contentPath: `/projects/lot-projects/${encodeURIComponent(req.params.projectSlug)}/listings/${encodeURIComponent(req.params.listingId)}/payments/${Number(context.payment.lot_project_payment_id)}/proofs/${proofId}/content`,
        malwareScanStatus,
        securityWarning: malwareScanStatus === 'not_scanned'
          ? 'This payment proof was uploaded without malware scanning because the scanning quota was unavailable.'
          : null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getLotProjectPaymentProofContent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const proofId = Number(req.params.proofId || 0);
    if (!proofId) return res.status(400).json({ message: 'Payment proof id is required.' });

    const [rows] = await connection.query(
      `
        SELECT *
        FROM lot_project_payment_proofs
        WHERE lot_project_payment_proof_id = ?
          AND lot_project_payment_id = ?
          AND proof_status = 'active'
        LIMIT 1
      `,
      [proofId, context.payment.lot_project_payment_id]
    );
    const proof = rows[0];
    if (!proof) return res.status(404).json({ message: 'Payment proof not found.' });

    const malwareScanStatus = clean(proof.malware_scan_status || 'not_scanned').toLowerCase();
    if (malwareScanStatus === 'pending') return res.status(423).json({ code: 'MALWARE_SCAN_PENDING', message: 'This payment proof is still being scanned for security threats. Try again shortly.' });
    if (malwareScanStatus === 'rejected') return res.status(403).json({ code: 'MALWARE_DETECTED', message: 'This payment proof was blocked because the security scan detected malicious content.' });
    if (malwareScanStatus === 'error') return res.status(503).json({ code: 'MALWARE_SCAN_ERROR', message: 'The security scan did not complete successfully. This payment proof is temporarily unavailable.' });

    return await sendAuthenticatedAssetContent(res, {
      publicId: proof.cloudinary_public_id,
      format: proof.cloudinary_format,
      resourceType: proof.cloudinary_resource_type,
      fileName: proof.file_name || proof.stored_file_name || 'payment-proof',
      fileMimeType: proof.file_mime_type,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ code: error.code || undefined, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deleteLotProjectPaymentProof = async (req, res) => {
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    const context = await getPaymentProofContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const user = await getAuthenticatedUser(req);
    const proofId = Number(req.params.proofId || 0);
    if (!proofId) return res.status(400).json({ message: 'Payment proof id is required.' });

    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query(
      `SELECT * FROM lot_project_payment_proofs WHERE lot_project_payment_proof_id = ? AND lot_project_payment_id = ? AND proof_status = 'active' LIMIT 1 FOR UPDATE`,
      [proofId, context.payment.lot_project_payment_id]
    );
    const proof = rows[0];
    if (!proof) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Payment proof not found.' });
    }

    const cloudinaryCleanup = await destroyCloudinaryAssets([{
      publicId: proof.cloudinary_public_id,
      resourceType: proof.cloudinary_resource_type || 'image',
      deliveryType: proof.cloudinary_delivery_type || 'authenticated',
    }]);

    await connection.query(
      `
        UPDATE lot_project_payment_proofs
        SET proof_status = 'removed',
            removed_by_user_id = ?,
            removed_at = NOW(),
            updated_at = NOW()
        WHERE lot_project_payment_proof_id = ?
      `,
      [user?.id || null, proofId]
    );

    await writeAuditLog(connection, req, {
      action: 'delete',
      module: 'Payments',
      entityType: 'lot_project_payment_proof',
      entityId: String(proofId),
      entityLabel: `${proof.file_name} — ${context.payment.lot_project_listing_unit_id}`,
      title: 'Removed payment proof',
      description: `Removed payment proof ${proof.file_name} from payment ${context.payment.lot_project_payment_reference_id || context.payment.lot_project_payment_id} and deleted its Cloudinary asset.`,
      metadata: {
        paymentId: context.payment.lot_project_payment_id,
        proofId,
        fileName: proof.file_name,
        cloudinaryPublicId: proof.cloudinary_public_id,
        cloudinaryDeletedCount: cloudinaryCleanup.deletedCount,
        cloudinaryAlreadyMissingCount: cloudinaryCleanup.alreadyMissingCount,
      },
    });

    await connection.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message: 'Payment proof removed successfully and deleted from Cloudinary.',
      data: {
        cloudinaryDeletedCount: cloudinaryCleanup.deletedCount,
        cloudinaryAlreadyMissingCount: cloudinaryCleanup.alreadyMissingCount,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch {}
    }
    return res.status(error.statusCode || 500).json({
      code: error.code || undefined,
      message: getErrorMessage(error),
    });
  } finally {
    connection.release();
  }
};

