
import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getListingLookupWhere,
  getAuthenticatedUser,
  toNullable,
} from '../_shared/lotProject.shared.js';

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
        cp.lot_project_client_profile_id
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
        AND (lpd.lot_project_listing_document_id = ? OR lpd.document_id = ?)
      LIMIT 1
    `,
    [project.lot_project_id, listing.lot_project_listing_id, documentLookup, documentLookup]
  );

  const document = documentRows[0];
  if (!document) return { errorStatus: 404, errorMessage: 'Document requirement not found for this listing.' };

  return { project, listing, document };
};

const safeMockUrl = (fileName) => {
  const clean = String(fileName || 'uploaded-document.pdf')
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-');

  return `/mock-documents/${encodeURIComponent(clean || 'uploaded-document.pdf')}`;
};

export const uploadLotProjectListingDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const context = await getDocumentContext(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });

    const user = await getAuthenticatedUser(req);
    const fileName = String(req.body.fileName || req.body.file_name || '').trim();
    const fileUrl = toNullable(req.body.fileUrl || req.body.file_url) || safeMockUrl(fileName);

    if (!fileName) return res.status(400).json({ message: 'Please choose a file before saving.' });

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
        fileName,
        fileUrl,
      ]
    );

    return res.json({
      success: true,
      message: `${context.document.document_name} uploaded and marked as submitted.`,
      fileName,
      fileUrl,
      verified_by_user_id: user?.id || null,
    });
  } catch (error) {
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
