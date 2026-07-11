import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { getAuthenticatedUser } from '../Lot_Projects/_shared/lotProject.shared.js';

const getErrorMessage = (error) => {
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};
const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

const accreditedSellerDocumentsTableSql = `
  CREATE TABLE IF NOT EXISTS accredited_seller_documents (
    accredited_seller_document_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    accredited_seller_id INT UNSIGNED NOT NULL,
    document_type VARCHAR(100) NOT NULL DEFAULT 'proof_of_income',
    file_name VARCHAR(255) NULL,
    file_url LONGTEXT NOT NULL,
    file_mime_type VARCHAR(150) NULL,
    file_size_bytes INT UNSIGNED NULL,
    uploaded_by_user_id INT UNSIGNED NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document_status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (accredited_seller_document_id),
    KEY idx_accredited_seller_documents_seller (accredited_seller_id),
    KEY idx_accredited_seller_documents_type (document_type),
    KEY idx_accredited_seller_documents_uploader (uploaded_by_user_id),
    CONSTRAINT fk_accredited_seller_documents_seller
      FOREIGN KEY (accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_accredited_seller_documents_uploader
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const ensureAccreditedSellerDocumentsTable = async (connection = db) => {
  await connection.query(accreditedSellerDocumentsTableSql);
};

const mapProofOfIncomeDocument = (row = {}) => ({
  id: row.accredited_seller_document_id,
  accreditedSellerId: row.accredited_seller_id,
  documentType: row.document_type,
  fileName: row.file_name,
  fileUrl: row.file_url,
  fileMimeType: row.file_mime_type,
  fileSizeBytes: row.file_size_bytes,
  uploadedAt: row.uploaded_at,
  status: row.document_status,
});

const hydrateSellerDocuments = async (sellers) => {
  const sellerIds = sellers.map((seller) => seller.accredited_seller_id).filter(Boolean);
  if (!sellerIds.length) return sellers.map((seller) => ({ ...seller, proof_of_income_document: null, proofOfIncomeDocument: null }));

  await ensureAccreditedSellerDocumentsTable();

  const [documentRows] = await db.query(
    `
      SELECT d.*
      FROM accredited_seller_documents d
      INNER JOIN (
        SELECT accredited_seller_id, MAX(accredited_seller_document_id) AS latest_document_id
        FROM accredited_seller_documents
        WHERE document_type = 'proof_of_income'
          AND document_status = 'active'
          AND accredited_seller_id IN (${sellerIds.map(() => '?').join(', ')})
        GROUP BY accredited_seller_id
      ) latest
        ON latest.latest_document_id = d.accredited_seller_document_id
      ORDER BY d.uploaded_at DESC, d.accredited_seller_document_id DESC
    `,
    sellerIds
  );

  const documentMap = new Map();
  documentRows.forEach((document) => {
    documentMap.set(document.accredited_seller_id, mapProofOfIncomeDocument(document));
  });

  return sellers.map((seller) => {
    const document = documentMap.get(seller.accredited_seller_id) || null;
    return {
      ...seller,
      proof_of_income_document: document,
      proofOfIncomeDocument: document,
    };
  });
};


const hydrateSellerRates = async (sellers) => {
  const sellerIds = sellers.map((seller) => seller.accredited_seller_id).filter(Boolean);
  if (!sellerIds.length) return sellers.map((seller) => ({ ...seller, project_rates: [], group_project_rates: [] }));

  const placeholders = sellerIds.map(() => '?').join(', ');

  const [sellerRateRows] = await db.query(
    `
      SELECT
        asr.accredited_seller_id,
        asr.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location_code,
        asr.accredited_seller_project_rate,
        asr.accredited_seller_lot_project_rate_status
      FROM accredited_seller_lot_project_rates asr
      INNER JOIN lot_projects lp ON lp.lot_project_id = asr.lot_project_id
      WHERE asr.accredited_seller_id IN (${placeholders})
      ORDER BY lp.lot_project_name ASC
    `,
    sellerIds
  );

  const groupIds = sellers.map((seller) => seller.seller_group_id).filter(Boolean);
  const groupRateRows = groupIds.length
    ? (await db.query(
        `
          SELECT
            sgr.seller_group_id,
            sgr.lot_project_id,
            lp.lot_project_name,
            lp.lot_project_slug,
            lp.lot_project_location_code,
            sgr.seller_group_pool_rate,
            sgr.seller_group_lot_project_rate_status
          FROM seller_group_lot_project_rates sgr
          INNER JOIN lot_projects lp ON lp.lot_project_id = sgr.lot_project_id
          WHERE sgr.seller_group_id IN (${groupIds.map(() => '?').join(', ')})
          ORDER BY lp.lot_project_name ASC
        `,
        groupIds
      ))[0]
    : [];

  const sellerRateMap = new Map();
  sellerRateRows.forEach((rate) => {
    if (!sellerRateMap.has(rate.accredited_seller_id)) sellerRateMap.set(rate.accredited_seller_id, []);
    sellerRateMap.get(rate.accredited_seller_id).push(rate);
  });

  const groupRateMap = new Map();
  groupRateRows.forEach((rate) => {
    if (!groupRateMap.has(rate.seller_group_id)) groupRateMap.set(rate.seller_group_id, []);
    groupRateMap.get(rate.seller_group_id).push(rate);
  });

  return sellers.map((seller) => ({
    ...seller,
    project_rates: sellerRateMap.get(seller.accredited_seller_id) || [],
    group_project_rates: groupRateMap.get(seller.seller_group_id) || [],
  }));
};

export const getAccredited = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || 'all');
    const status = String(req.query.status || 'all');

    const where = [];
    const params = [];

    if (search) {
      where.push(`(
        ${fullNameSql('u')} LIKE ? OR
        u.email LIKE ? OR
        IFNULL(u.contact_no, '') LIKE ? OR
        IFNULL(sg.seller_group_name, '') LIKE ? OR
        IFNULL(${fullNameSql('parent')}, '') LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    if (role !== 'all') {
      where.push('u.role = ?');
      params.push(role);
    }

    if (status !== 'all') {
      where.push('a.accredited_seller_status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [rows] = await db.query(
      `
        SELECT
          a.accredited_seller_id,
          a.user_id,
          ${fullNameSql('u')} AS full_name,
          u.email,
          u.contact_no,
          u.role,
          a.accredited_seller_reports_under_user_id AS reports_under_user_id,
          ${fullNameSql('parent')} AS reports_under_name,
          a.seller_group_id,
          sg.seller_group_name,
          a.accredited_seller_accreditation_date,
          a.accredited_seller_status,
          a.accredited_seller_updated_at
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        ${whereSql}
        ORDER BY a.accredited_seller_updated_at DESC, a.accredited_seller_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const hydratedRows = await hydrateSellerDocuments(await hydrateSellerRates(rows));

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(a.accredited_seller_status = 'active') AS active,
        SUM(a.accredited_seller_status = 'inactive') AS inactive,
        SUM(u.role = 'broker_network_manager') AS broker_network_manager,
        SUM(u.role = 'broker') AS broker,
        SUM(u.role = 'manager') AS manager,
        SUM(u.role = 'agent') AS agent
      FROM accredited_sellers a
      INNER JOIN users u ON u.id = a.user_id
    `);

    return res.json({
      data: hydratedRows,
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
        roleBreakdown: {
          broker_network_manager: Number(summaryRows[0]?.broker_network_manager || 0),
          broker: Number(summaryRows[0]?.broker || 0),
          manager: Number(summaryRows[0]?.manager || 0),
          agent: Number(summaryRows[0]?.agent || 0),
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getParentSellers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        u.id AS user_id,
        a.accredited_seller_id,
        ${fullNameSql('u')} AS full_name,
        u.role,
        a.seller_group_id
      FROM accredited_sellers a
      INNER JOIN users u ON u.id = a.user_id
      WHERE u.status = 'active'
        AND a.accredited_seller_status = 'active'
        AND u.role IN ('broker_network_manager', 'broker', 'manager')
      ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager'), full_name ASC
    `);

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};




export const uploadAccreditedSellerProofOfIncome = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please login before uploading proof of income.' });

    const sellerId = Number(req.params.sellerId || 0);
    const fileName = String(req.body.fileName || '').trim();
    const fileUrl = String(req.body.fileUrl || '').trim();
    const fileMimeType = String(req.body.fileType || req.body.fileMimeType || '').trim() || 'application/octet-stream';
    const fileSizeBytes = Math.max(Number(req.body.fileSize || req.body.fileSizeBytes || 0), 0);

    if (!sellerId) return res.status(400).json({ message: 'Seller id is required.' });
    if (!fileUrl) return res.status(400).json({ message: 'Proof of income file is required.' });

    await ensureAccreditedSellerDocumentsTable(connection);
    await connection.beginTransaction();

    const [sellerRows] = await connection.query(
      `
        SELECT
          acs.accredited_seller_id,
          ${fullNameSql('u')} AS seller_name
        FROM accredited_sellers acs
        INNER JOIN users u ON u.id = acs.user_id
        WHERE acs.accredited_seller_id = ?
        LIMIT 1
      `,
      [sellerId]
    );

    if (!sellerRows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Accredited seller not found.' });
    }

    const [result] = await connection.query(
      `
        INSERT INTO accredited_seller_documents (
          accredited_seller_id,
          document_type,
          file_name,
          file_url,
          file_mime_type,
          file_size_bytes,
          uploaded_by_user_id,
          uploaded_at,
          document_status
        ) VALUES (?, 'proof_of_income', ?, ?, ?, ?, ?, NOW(), 'active')
      `,
      [sellerId, fileName || 'proof-of-income', fileUrl, fileMimeType, fileSizeBytes, user.id]
    );

    const [documentRows] = await connection.query(
      `
        SELECT *
        FROM accredited_seller_documents
        WHERE accredited_seller_document_id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Accreditation',
      entityType: 'accredited_seller',
      entityId: String(sellerId),
      entityLabel: sellerRows[0]?.seller_name || `Seller #${sellerId}`,
      title: 'Uploaded proof of income',
      description: `Uploaded proof of income for ${sellerRows[0]?.seller_name || `seller #${sellerId}`}.`,
      metadata: {
        documentId: result.insertId,
        fileName: fileName || 'proof-of-income',
        fileMimeType,
        fileSizeBytes,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Proof of income uploaded successfully.',
      document: mapProofOfIncomeDocument(documentRows[0]),
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

