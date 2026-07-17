import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getListingLookupWhere,
  getAuthenticatedUser,
  parseClientDocumentImages,
  toNullable,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';


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

  const lookup = getListingLookupWhere(listingLookup);
  const [listingRows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_status,
        cp.lot_project_client_profile_id,
        cp.buyer_full_name
      FROM lot_project_listings l
      LEFT JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id
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

export const uploadLotProjectListingDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const user = await getAuthenticatedUser(req);
    const uploadedFiles = normalizeUploadedDocumentFiles(req.body);

    if (!uploadedFiles.length) return res.status(400).json({ message: 'Please choose at least one image before saving.' });

    const [existingRows] = await connection.query(
      `
        SELECT lot_project_client_document_file_name, lot_project_client_document_file_url
        FROM lot_project_client_documents
        WHERE lot_project_client_profile_id = ?
          AND document_id = ?
        LIMIT 1
      `,
      [context.listing.lot_project_client_profile_id, context.document.document_id]
    );

    const existingImages = parseClientDocumentImages(
      existingRows[0]?.lot_project_client_document_file_url,
      existingRows[0]?.lot_project_client_document_file_name
    );
    const combinedImages = [...existingImages, ...uploadedFiles];
    const storedFileName = getStoredDocumentFileName(combinedImages);
    const storedFileUrl = JSON.stringify(combinedImages);

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO lot_project_client_documents (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          document_id,
          lot_project_client_document_file_name,
          lot_project_client_document_file_url,
          lot_project_client_document_status,
          lot_project_client_document_uploaded_at,
          lot_project_client_document_approved_at,
          lot_project_client_document_approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'Submitted', NOW(), NULL, NULL)
        ON DUPLICATE KEY UPDATE
          lot_project_client_document_file_name = VALUES(lot_project_client_document_file_name),
          lot_project_client_document_file_url = VALUES(lot_project_client_document_file_url),
          lot_project_client_document_status = 'Submitted',
          lot_project_client_document_uploaded_at = NOW(),
          lot_project_client_document_approved_at = NULL,
          lot_project_client_document_approved_by_user_id = NULL
      `,
      [
        context.project.lot_project_id,
        context.listing.lot_project_listing_id,
        context.listing.lot_project_client_profile_id,
        context.document.document_id,
        storedFileName,
        storedFileUrl,
      ]
    );

    const [clientDocumentRows] = await connection.query(
      `
        SELECT lot_project_client_document_id
        FROM lot_project_client_documents
        WHERE lot_project_client_profile_id = ?
          AND document_id = ?
        LIMIT 1
      `,
      [context.listing.lot_project_client_profile_id, context.document.document_id]
    );

    const clientDocumentId = clientDocumentRows[0]?.lot_project_client_document_id;
    const clientName = context.listing.buyer_full_name || context.listing.lot_project_listing_unit_id;

    await writeAuditLog(connection, req, {
      action: existingImages.length ? 'update' : 'create',
      module: 'Documents',
      entityType: 'lot_project_client_document',
      entityId: clientDocumentId ? String(clientDocumentId) : String(context.document.document_id),
      entityLabel: `${context.document.document_name} — ${clientName}`,
      title: 'Uploaded client document',
      description: `Uploaded ${uploadedFiles.length} image(s) for ${context.document.document_name} of ${clientName}.`,
      metadata: {
        listingId: context.listing.lot_project_listing_id,
        unitId: context.listing.lot_project_listing_unit_id,
        clientProfileId: context.listing.lot_project_client_profile_id,
        documentId: context.document.document_id,
        documentName: context.document.document_name,
        uploadedCount: uploadedFiles.length,
        totalImages: combinedImages.length,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `${uploadedFiles.length} image(s) added to ${context.document.document_name}.`,
      fileName: storedFileName,
      fileUrl: combinedImages[0]?.url || '',
      images: combinedImages.map((image) => image.url).filter(Boolean),
      imageEntries: combinedImages,
      uploadedCount: uploadedFiles.length,
      totalImages: combinedImages.length,
      verified_by_user_id: user?.id || null,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(500).json({ message: getErrorMessage(error) });
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
