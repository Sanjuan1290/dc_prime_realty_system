import {
  db,
  getErrorMessage,
  tableExists,
  columnExists,
  getProjectBySlug,
  getListingLookupWhere,
  getAuthenticatedUser,
  parseClientDocumentImages,
  toNullable,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import {
  buildBuyerDocumentFolder,
  createAuthenticatedAccessUrl,
  createAuthenticatedUploadSignature,
  validateDocumentUploadRequest,
  verifyAuthenticatedCloudinaryAsset,
} from '../../../services/secureCloudinary.service.js';


const normalizeUploadedDocumentFiles = (body = {}) => {
  const rawFiles = Array.isArray(body.files)
    ? body.files
    : Array.isArray(body.uploadedFiles)
      ? body.uploadedFiles
      : [];

  const normalizedFiles = rawFiles
    .map((file, index) => {
      if (!file || typeof file !== 'object') return null;
      const url = String(file.fileUrl || file.file_url || file.url || file.secure_url || '').trim();
      if (!url) return null;

      return {
        url,
        fileName: String(file.fileName || file.file_name || file.originalFilename || file.original_filename || `Document Image ${index + 1}`).trim(),
        fileSize: Number(file.fileSize || file.file_size || file.bytes || 0),
        fileType: String(file.fileType || file.file_type || file.format || '').trim(),
        cloudinaryPublicId: file.cloudinaryPublicId || file.cloudinary_public_id || file.public_id || null,
        cloudinaryResourceType: file.cloudinaryResourceType || file.cloudinary_resource_type || file.resource_type || null,
        cloudinaryFolder: file.cloudinaryFolder || file.cloudinary_folder || file.folder || null,
        cloudinaryAssetFolder: file.cloudinaryAssetFolder || file.cloudinary_asset_folder || file.asset_folder || null,
        cloudinaryAssetId: file.cloudinaryAssetId || file.cloudinary_asset_id || file.asset_id || null,
        cloudinaryDeliveryType: file.cloudinaryDeliveryType || file.cloudinary_delivery_type || file.type || null,
        cloudinaryVersion: Number(file.cloudinaryVersion || file.cloudinary_version || file.version || 0) || null,
        cloudinaryFormat: file.cloudinaryFormat || file.cloudinary_format || file.format || null,
        uploadedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const singleUrl = toNullable(body.fileUrl || body.file_url || body.url || body.secure_url);
  const singleName = String(body.fileName || body.file_name || body.originalFilename || body.original_filename || '').trim();

  if (!normalizedFiles.length && singleUrl) {
    normalizedFiles.push({
      url: singleUrl,
      fileName: singleName || 'Document Image 1',
      fileSize: Number(body.fileSize || body.file_size || 0),
      fileType: String(body.fileType || body.file_type || '').trim(),
      cloudinaryPublicId: body.cloudinaryPublicId || body.cloudinary_public_id || body.public_id || null,
      cloudinaryResourceType: body.cloudinaryResourceType || body.cloudinary_resource_type || body.resource_type || null,
      cloudinaryFolder: body.cloudinaryFolder || body.cloudinary_folder || body.folder || null,
      cloudinaryAssetFolder: body.cloudinaryAssetFolder || body.cloudinary_asset_folder || body.asset_folder || null,
      cloudinaryAssetId: body.cloudinaryAssetId || body.cloudinary_asset_id || body.asset_id || null,
      cloudinaryDeliveryType: body.cloudinaryDeliveryType || body.cloudinary_delivery_type || body.type || null,
      cloudinaryVersion: Number(body.cloudinaryVersion || body.cloudinary_version || body.version || 0) || null,
      cloudinaryFormat: body.cloudinaryFormat || body.cloudinary_format || body.format || null,
      uploadedAt: new Date().toISOString(),
    });
  }

  return normalizedFiles;
};

const getStoredDocumentFileName = (imageEntries = []) => {
  if (!imageEntries.length) return null;
  if (imageEntries.length === 1) return String(imageEntries[0].fileName || 'Document Image 1').slice(0, 255);
  return `${imageEntries.length} document image(s)`.slice(0, 255);
};

const getDocumentContext = async (connection, req) => {
  const slug = String(req.params.projectSlug || '').trim();
  const listingLookup = String(req.params.listingId || '').trim();
  const documentLookup = Number(req.params.documentId || 0);
  const project = await getProjectBySlug(slug);

  if (!project) return { errorStatus: 404, errorMessage: 'Lot project not found.' };
  if (!listingLookup) return { errorStatus: 400, errorMessage: 'Listing id is required.' };
  if (!documentLookup) return { errorStatus: 400, errorMessage: 'Document id is required.' };

  const requiredTables = [
    'lot_project_listings',
    'lot_project_client_profiles',
    'lot_project_listing_documents',
    'lot_project_client_documents',
  ];

  for (const tableName of requiredTables) {
    if (!(await tableExists(connection, tableName))) {
      return { errorStatus: 500, errorMessage: `${tableName} table does not exist.` };
    }
  }

  const hasAccounts = await tableExists(connection, 'lot_project_accounts');
  const lookup = getListingLookupWhere(listingLookup);
  const profileJoin = hasAccounts
    ? `
        LEFT JOIN lot_project_accounts account
          ON account.lot_project_account_id = l.current_account_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
      `
    : `
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
         AND cp.lot_project_client_profile_status = 'active'
      `;
  const accountSelect = hasAccounts
    ? `account.lot_project_account_id, account.account_reference, account.account_status,`
    : `NULL AS lot_project_account_id, NULL AS account_reference, NULL AS account_status,`;

  const [listingRows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_status,
        ${accountSelect}
        cp.lot_project_client_profile_id,
        cp.buyer_full_name
      FROM lot_project_listings l
      ${profileJoin}
      WHERE l.lot_project_id = ?
        AND ${lookup.sql}
      LIMIT 1
    `,
    [project.lot_project_id, ...lookup.params]
  );

  const listing = listingRows[0];
  if (!listing) return { errorStatus: 404, errorMessage: 'Listing not found.' };
  if (!listing.lot_project_client_profile_id) {
    return { errorStatus: 400, errorMessage: 'Reserve this unit first before managing documents.' };
  }
  if (hasAccounts && listing.account_status !== 'active') {
    return { errorStatus: 409, errorMessage: 'Cancelled buyer documents are read-only.' };
  }

  const [documentRows] = await connection.query(
    `
      SELECT
        lpd.lot_project_listing_document_id,
        lpd.document_id,
        d.document_name
      FROM lot_project_listing_documents lpd
      INNER JOIN documents d ON d.document_id = lpd.document_id
      WHERE lpd.lot_project_id = ?
        AND lpd.lot_project_listing_id = ?
        AND lpd.lot_project_listing_document_status = 'active'
        AND lpd.lot_project_listing_document_id = ?
      LIMIT 1
    `,
    [project.lot_project_id, listing.lot_project_listing_id, documentLookup]
  );

  const document = documentRows[0];
  if (!document) return { errorStatus: 404, errorMessage: 'Document requirement not found for this listing.' };

  return { project, listing, document };
};

export const updateLotProjectListingDocumentRequirements = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const requiredTables = ['lot_project_listings', 'lot_project_listing_documents', 'documents'];
    for (const tableName of requiredTables) {
      if (!(await tableExists(connection, tableName))) {
        return res.status(500).json({ message: `${tableName} table does not exist.` });
      }
    }

    const lookup = getListingLookupWhere(listingLookup);
    const [listingRows] = await connection.query(
      `
        SELECT lot_project_listing_id
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const rawDocuments = Array.isArray(req.body.documents)
      ? req.body.documents
      : Array.isArray(req.body.documentRequirements)
        ? req.body.documentRequirements
        : [];

    const documentMap = new Map();
    rawDocuments.forEach((document) => {
      const documentId = Number(document.document_id || document.documentId || document.id || 0);
      if (!documentId) return;

      documentMap.set(documentId, {
        document_id: documentId,
        is_required: String(document.requirement || '').toLowerCase() === 'optional' || document.is_required === false ? 0 : 1,
        status: String(document.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      });
    });

    const cleanDocuments = [...documentMap.values()];

    await connection.beginTransaction();

    if (cleanDocuments.length > 0) {
      await connection.query(
        `
          UPDATE lot_project_listing_documents
          SET lot_project_listing_document_status = 'inactive'
          WHERE lot_project_id = ?
            AND lot_project_listing_id = ?
            AND document_id NOT IN (${cleanDocuments.map(() => '?').join(', ')})
        `,
        [project.lot_project_id, listing.lot_project_listing_id, ...cleanDocuments.map((document) => document.document_id)]
      );

      await connection.query(
        `
          INSERT INTO lot_project_listing_documents (
            lot_project_id,
            lot_project_listing_id,
            document_id,
            lot_project_listing_document_is_required,
            lot_project_listing_document_status
          ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?)').join(', ')}
          ON DUPLICATE KEY UPDATE
            lot_project_listing_document_is_required = VALUES(lot_project_listing_document_is_required),
            lot_project_listing_document_status = VALUES(lot_project_listing_document_status),
            lot_project_listing_document_updated_at = NOW()
        `,
        cleanDocuments.flatMap((document) => [
          project.lot_project_id,
          listing.lot_project_listing_id,
          document.document_id,
          document.is_required,
          document.status,
        ])
      );
    } else {
      await connection.query(
        `
          UPDATE lot_project_listing_documents
          SET lot_project_listing_document_status = 'inactive'
          WHERE lot_project_id = ?
            AND lot_project_listing_id = ?
        `,
        [project.lot_project_id, listing.lot_project_listing_id]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Document requirements updated successfully.',
      document_count: cleanDocuments.length,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createLotProjectDocumentUploadSignature = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    if (!context.listing.lot_project_account_id || !context.listing.account_reference) {
      return res.status(500).json({ message: 'Run the buyer account retention migration before using signed uploads.' });
    }

    const file = validateDocumentUploadRequest(req.body || {});
    const folder = buildBuyerDocumentFolder({
      projectSlug: context.project.lot_project_slug || req.params.projectSlug,
      listingId: context.listing.lot_project_listing_id,
      unitId: context.listing.lot_project_listing_unit_id,
      accountReference: context.listing.account_reference,
      buyerName: context.listing.buyer_full_name,
      documentName: context.document.document_name,
    });
    const signature = createAuthenticatedUploadSignature({
      folder,
      accountId: context.listing.lot_project_account_id,
      documentId: context.document.document_id,
      fileName: file.fileName,
    });

    return res.json({ success: true, data: { ...signature, maxFileBytes: 15 * 1024 * 1024 } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const uploadLotProjectListingDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const user = await getAuthenticatedUser(req);
    const uploadedFiles = normalizeUploadedDocumentFiles(req.body);
    if (!uploadedFiles.length) return res.status(400).json({ message: 'Choose at least one PDF, JPG, or PNG file before saving.' });
    if (!context.listing.lot_project_account_id) {
      return res.status(500).json({ message: 'Run the buyer account retention migration before saving protected documents.' });
    }

    const expectedFolder = buildBuyerDocumentFolder({
      projectSlug: context.project.lot_project_slug || req.params.projectSlug,
      listingId: context.listing.lot_project_listing_id,
      unitId: context.listing.lot_project_listing_unit_id,
      accountReference: context.listing.account_reference,
      buyerName: context.listing.buyer_full_name,
      documentName: context.document.document_name,
    });

    const verifiedFiles = [];
    for (const file of uploadedFiles) {
      validateDocumentUploadRequest({ fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize });
      if (!file.cloudinaryPublicId) throw Object.assign(new Error('Cloudinary public ID is missing.'), { statusCode: 400 });
      const asset = await verifyAuthenticatedCloudinaryAsset({
        publicId: file.cloudinaryPublicId,
        resourceType: file.cloudinaryResourceType || 'image',
        expectedFolder,
      });
      verifiedFiles.push({
        ...file,
        url: '',
        protected: true,
        cloudinaryAssetId: asset.asset_id || file.cloudinaryAssetId || null,
        cloudinaryPublicId: asset.public_id,
        cloudinaryResourceType: asset.resource_type || file.cloudinaryResourceType || 'image',
        cloudinaryDeliveryType: asset.type || 'authenticated',
        cloudinaryVersion: Number(asset.version || file.cloudinaryVersion || 0) || null,
        cloudinaryAssetFolder: asset.asset_folder || expectedFolder,
        cloudinaryFolder: asset.asset_folder || expectedFolder,
        cloudinaryFormat: asset.format || file.cloudinaryFormat || null,
        fileSize: Number(asset.bytes || file.fileSize || 0),
      });
    }

    const [existingRows] = await connection.query(
      `
        SELECT lot_project_client_document_id, lot_project_client_document_file_name, lot_project_client_document_file_url
        FROM lot_project_client_documents
        WHERE lot_project_client_profile_id = ?
          AND document_id = ?
        LIMIT 1
      `,
      [context.listing.lot_project_client_profile_id, context.document.document_id]
    );
    const existingImages = parseClientDocumentImages(existingRows[0]?.lot_project_client_document_file_url, existingRows[0]?.lot_project_client_document_file_name);

    await connection.beginTransaction();
    const hasAccountColumn = await columnExists(connection, 'lot_project_client_documents', 'lot_project_account_id');
    const insertColumns = [
      'lot_project_id',
      'lot_project_listing_id',
      'lot_project_client_profile_id',
      ...(hasAccountColumn ? ['lot_project_account_id'] : []),
      'document_id',
      'lot_project_client_document_status',
      'lot_project_client_document_uploaded_at',
      'lot_project_client_document_approved_at',
      'lot_project_client_document_approved_by_user_id',
    ];
    const insertValues = [
      context.project.lot_project_id,
      context.listing.lot_project_listing_id,
      context.listing.lot_project_client_profile_id,
      ...(hasAccountColumn ? [context.listing.lot_project_account_id] : []),
      context.document.document_id,
      'Submitted',
      new Date(),
      null,
      null,
    ];
    await connection.query(
      `
        INSERT INTO lot_project_client_documents (${insertColumns.join(', ')})
        VALUES (${insertColumns.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE
          ${hasAccountColumn ? 'lot_project_account_id = VALUES(lot_project_account_id),' : ''}
          lot_project_client_document_status = 'Submitted',
          lot_project_client_document_uploaded_at = NOW(),
          lot_project_client_document_approved_at = NULL,
          lot_project_client_document_approved_by_user_id = NULL
      `,
      insertValues
    );

    const [clientDocumentRows] = await connection.query(
      `SELECT lot_project_client_document_id FROM lot_project_client_documents WHERE lot_project_client_profile_id = ? AND document_id = ? LIMIT 1 FOR UPDATE`,
      [context.listing.lot_project_client_profile_id, context.document.document_id]
    );
    const clientDocumentId = Number(clientDocumentRows[0]?.lot_project_client_document_id || 0);
    if (!clientDocumentId) throw new Error('Client document row was not created.');

    const storedNewEntries = [];
    for (const file of verifiedFiles) {
      const [fileResult] = await connection.query(
        `
          INSERT INTO lot_project_client_document_files (
            lot_project_account_id,
            lot_project_client_document_id,
            cloudinary_asset_id,
            cloudinary_public_id,
            cloudinary_resource_type,
            cloudinary_delivery_type,
            cloudinary_version,
            cloudinary_asset_folder,
            original_file_name,
            stored_file_name,
            file_format,
            file_mime_type,
            file_size_bytes,
            file_status,
            uploaded_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
          ON DUPLICATE KEY UPDATE
            lot_project_client_document_id = VALUES(lot_project_client_document_id),
            file_status = 'active',
            removed_at = NULL,
            removal_reason = NULL,
            uploaded_by_user_id = VALUES(uploaded_by_user_id)
        `,
        [
          context.listing.lot_project_account_id,
          clientDocumentId,
          file.cloudinaryAssetId,
          file.cloudinaryPublicId,
          file.cloudinaryResourceType,
          file.cloudinaryDeliveryType || 'authenticated',
          file.cloudinaryVersion,
          file.cloudinaryAssetFolder,
          file.fileName,
          file.fileName,
          file.cloudinaryFormat,
          file.fileType,
          file.fileSize,
          user?.id || null,
        ]
      );
      let fileId = Number(fileResult.insertId || 0);
      if (!fileId && file.cloudinaryAssetId) {
        const [fileRows] = await connection.query(`SELECT lot_project_client_document_file_id FROM lot_project_client_document_files WHERE cloudinary_asset_id = ? LIMIT 1`, [file.cloudinaryAssetId]);
        fileId = Number(fileRows[0]?.lot_project_client_document_file_id || 0);
      }
      storedNewEntries.push({
        ...file,
        fileId,
        accessPath: `/projects/lot-projects/${req.params.projectSlug}/document-files/${fileId}/access-url`,
      });
    }

    const combinedImages = [...existingImages, ...storedNewEntries];
    const storedFileName = getStoredDocumentFileName(combinedImages);
    await connection.query(
      `
        UPDATE lot_project_client_documents
        SET lot_project_client_document_file_name = ?,
            lot_project_client_document_file_url = ?,
            lot_project_client_document_status = 'Submitted',
            lot_project_client_document_uploaded_at = NOW(),
            lot_project_client_document_approved_at = NULL,
            lot_project_client_document_approved_by_user_id = NULL
        WHERE lot_project_client_document_id = ?
      `,
      [storedFileName, JSON.stringify(combinedImages), clientDocumentId]
    );

    const clientName = context.listing.buyer_full_name || context.listing.lot_project_listing_unit_id;
    await writeAuditLog(connection, req, {
      action: existingImages.length ? 'update' : 'create',
      module: 'Documents',
      entityType: 'lot_project_client_document',
      entityId: String(clientDocumentId),
      entityLabel: `${context.document.document_name} — ${clientName}`,
      title: 'Uploaded protected client document',
      description: `Uploaded ${storedNewEntries.length} authenticated file(s) for ${context.document.document_name} of ${clientName}.`,
      metadata: {
        accountId: context.listing.lot_project_account_id,
        accountReference: context.listing.account_reference,
        listingId: context.listing.lot_project_listing_id,
        unitId: context.listing.lot_project_listing_unit_id,
        clientProfileId: context.listing.lot_project_client_profile_id,
        documentId: context.document.document_id,
        documentName: context.document.document_name,
        uploadedCount: storedNewEntries.length,
        totalImages: combinedImages.length,
      },
    });

    await connection.commit();
    return res.json({
      success: true,
      message: `${storedNewEntries.length} protected file(s) added to ${context.document.document_name}.`,
      fileName: storedFileName,
      imageEntries: combinedImages,
      uploadedCount: storedNewEntries.length,
      totalImages: combinedImages.length,
      verified_by_user_id: user?.id || null,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getLotProjectDocumentFileAccessUrl = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    const fileId = Number(req.params.fileId || 0);
    if (!fileId) return res.status(400).json({ message: 'Document file id is required.' });

    const [rows] = await connection.query(
      `
        SELECT file_row.*, account.account_status
        FROM lot_project_client_document_files file_row
        INNER JOIN lot_project_accounts account
          ON account.lot_project_account_id = file_row.lot_project_account_id
        WHERE file_row.lot_project_client_document_file_id = ?
          AND account.lot_project_id = ?
          AND file_row.file_status = 'active'
        LIMIT 1
      `,
      [fileId, project.lot_project_id]
    );
    const file = rows[0];
    if (!file) return res.status(404).json({ message: 'Document file not found.' });

    const url = createAuthenticatedAccessUrl({
      publicId: file.cloudinary_public_id,
      format: file.file_format,
      resourceType: file.cloudinary_resource_type,
      expiresInSeconds: 600,
    });
    return res.json({ success: true, data: { url, expiresInSeconds: 600, accountStatus: file.account_status } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const approveLotProjectListingDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const user = await getAuthenticatedUser(req);
    const [rows] = await connection.query(
      `
        SELECT lot_project_client_document_id, lot_project_client_document_file_name
        FROM lot_project_client_documents
        WHERE lot_project_client_profile_id = ?
          AND document_id = ?
        LIMIT 1
      `,
      [context.listing.lot_project_client_profile_id, context.document.document_id]
    );

    const clientDocument = rows[0];
    if (!clientDocument?.lot_project_client_document_file_name) {
      return res.status(400).json({ message: `Upload ${context.document.document_name} before approving it.` });
    }

    await connection.query(
      `
        UPDATE lot_project_client_documents
        SET lot_project_client_document_status = 'Approved',
            lot_project_client_document_approved_at = NOW(),
            lot_project_client_document_approved_by_user_id = ?
        WHERE lot_project_client_document_id = ?
      `,
      [user?.id || null, clientDocument.lot_project_client_document_id]
    );

    return res.json({
      success: true,
      message: `${context.document.document_name} approved successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const clearLotProjectListingDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    if (await tableExists(connection, 'lot_project_client_document_files')) {
      await connection.query(
        `
          UPDATE lot_project_client_document_files file_row
          INNER JOIN lot_project_client_documents document_row
            ON document_row.lot_project_client_document_id = file_row.lot_project_client_document_id
          SET file_row.file_status = 'removed',
              file_row.removed_at = NOW(),
              file_row.removal_reason = 'Cleared from the active document checklist'
          WHERE document_row.lot_project_client_profile_id = ?
            AND document_row.document_id = ?
            AND file_row.file_status = 'active'
        `,
        [context.listing.lot_project_client_profile_id, context.document.document_id]
      );
    }

    await connection.query(
      `
        INSERT INTO lot_project_client_documents (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          document_id,
          lot_project_client_document_status
        ) VALUES (?, ?, ?, ?, 'Missing')
        ON DUPLICATE KEY UPDATE
          lot_project_client_document_file_name = NULL,
          lot_project_client_document_file_url = NULL,
          lot_project_client_document_status = 'Missing',
          lot_project_client_document_uploaded_at = NULL,
          lot_project_client_document_approved_at = NULL,
          lot_project_client_document_approved_by_user_id = NULL
      `,
      [
        context.project.lot_project_id,
        context.listing.lot_project_listing_id,
        context.listing.lot_project_client_profile_id,
        context.document.document_id,
      ]
    );

    return res.json({
      success: true,
      message: `${context.document.document_name} cleared and marked as missing.`,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
