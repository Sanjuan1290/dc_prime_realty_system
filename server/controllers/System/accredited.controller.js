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

    // System direct-sales agents stay inside Seller Group configuration and
    // are hidden from the normal accreditation directory.
    const where = ['COALESCE(a.is_system_dummy, 0) = 0'];
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
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email,
          u.contact_no,
          u.tin_no,
          u.prc_no,
          u.address,
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
      WHERE COALESCE(a.is_system_dummy, 0) = 0
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

const commissionReceiptTableSql = `
  CREATE TABLE IF NOT EXISTS lot_project_commission_receipts (
    lot_project_commission_receipt_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lot_project_id INT UNSIGNED NOT NULL,
    lot_project_listing_id INT UNSIGNED NOT NULL,
    lot_project_client_profile_id INT UNSIGNED NOT NULL,
    lot_project_commission_id INT UNSIGNED NOT NULL,
    accredited_seller_id INT UNSIGNED NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    receipt_date DATE NOT NULL,
    reference_number VARCHAR(150) NOT NULL,
    witness_name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    receipt_status ENUM('active', 'void') NOT NULL DEFAULT 'active',
    created_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_project_commission_receipt_id),
    KEY idx_commission_receipt_seller (accredited_seller_id),
    KEY idx_commission_receipt_commission (lot_project_commission_id),
    KEY idx_commission_receipt_listing (lot_project_listing_id),
    KEY idx_commission_receipt_date (receipt_date),
    KEY idx_commission_receipt_creator (created_by_user_id),
    CONSTRAINT fk_commission_receipt_project
      FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_listing
      FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_client
      FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_commission
      FOREIGN KEY (lot_project_commission_id) REFERENCES lot_project_commissions (lot_project_commission_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_seller
      FOREIGN KEY (accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_creator
      FOREIGN KEY (created_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const commissionReceiptItemTableSql = `
  CREATE TABLE IF NOT EXISTS lot_project_commission_receipt_items (
    lot_project_commission_receipt_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lot_project_commission_receipt_id INT UNSIGNED NOT NULL,
    lot_project_commission_release_id INT UNSIGNED NOT NULL,
    release_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_project_commission_receipt_item_id),
    UNIQUE KEY uq_commission_receipt_release (lot_project_commission_release_id),
    KEY idx_commission_receipt_item_receipt (lot_project_commission_receipt_id),
    CONSTRAINT fk_commission_receipt_item_receipt
      FOREIGN KEY (lot_project_commission_receipt_id) REFERENCES lot_project_commission_receipts (lot_project_commission_receipt_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_item_release
      FOREIGN KEY (lot_project_commission_release_id) REFERENCES lot_project_commission_releases (lot_project_commission_release_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const ensureCommissionReceiptTables = async (connection = db) => {
  await connection.query(commissionReceiptTableSql);
  await connection.query(commissionReceiptItemTableSql);
};

const requireReceiptManager = async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ message: 'Please login before managing proof of income receipts.' });
    return null;
  }

  if (!['super_admin', 'admin'].includes(user.role)) {
    res.status(403).json({ message: 'Admin access is required to manage proof of income receipts.' });
    return null;
  }

  return user;
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INCOME_RANGE_DAYS = 3660;

const parseIsoDateOnly = (value) => {
  const text = String(value || '').trim();
  if (!ISO_DATE_PATTERN.test(text)) return null;

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

// Income reports use the commission stage's actual release date because that is
// the date the seller received the income, not the reservation or receipt date.
export const normalizeSellerIncomeRange = (startDateValue, endDateValue) => {
  const startDate = String(startDateValue || '').trim();
  const endDate = String(endDateValue || '').trim();
  const start = parseIsoDateOnly(startDate);
  const end = parseIsoDateOnly(endDate);

  if (!start || !end) {
    throw Object.assign(new Error('Enter valid start and end dates.'), { statusCode: 400 });
  }

  if (start.getTime() > end.getTime()) {
    throw Object.assign(new Error('Start date cannot be after end date.'), { statusCode: 400 });
  }

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > MAX_INCOME_RANGE_DAYS) {
    throw Object.assign(new Error('Income report date range cannot exceed 10 years.'), { statusCode: 400 });
  }

  return { startDate, endDate, dayCount };
};

export const mapSellerIncomeRangeRow = (row = {}) => ({
  releaseId: Number(row.lot_project_commission_release_id || 0),
  commissionId: Number(row.lot_project_commission_id || 0),
  recipientAccreditedSellerId: Number(row.accredited_seller_id || 0),
  saleOwnerAccreditedSellerId: Number(row.sale_owner_accredited_seller_id || row.accredited_seller_id || 0),
  projectId: Number(row.lot_project_id || 0),
  listingId: Number(row.lot_project_listing_id || 0),
  clientProfileId: Number(row.lot_project_client_profile_id || 0),
  projectName: row.lot_project_name,
  projectLocation: row.lot_project_location,
  unitId: row.lot_project_listing_unit_id,
  buyerName: row.buyer_full_name,
  commissionRole: row.commission_role,
  commissionRateType: row.commission_rate_type || (row.commission_seller_type === 'selling_agent' ? 'direct' : 'override'),
  commissionRate: Number(row.commission_rate || 0),
  releaseStage: row.release_stage,
  releasePercent: Number(row.release_percent || 0),
  releaseDate: row.actual_release_date,
  grossAmount: roundMoney(row.gross_release_amount),
  deductionAmount: roundMoney(row.deduction_amount),
  netAmount: roundMoney(row.net_release_amount),
  receiptId: row.lot_project_commission_receipt_id ? Number(row.lot_project_commission_receipt_id) : null,
  receiptDate: row.receipt_date || null,
  receiptReference: row.reference_number || null,
});

export const summarizeSellerIncomeRangeRows = (entries = []) => {
  const commissionIds = new Set();
  const listingIds = new Set();
  const monthMap = new Map();

  const summary = entries.reduce((totals, entry) => {
    commissionIds.add(Number(entry.commissionId || 0));
    listingIds.add(Number(entry.listingId || 0));

    totals.grossIncome = roundMoney(totals.grossIncome + Number(entry.grossAmount || 0));
    totals.deductions = roundMoney(totals.deductions + Number(entry.deductionAmount || 0));
    totals.netIncome = roundMoney(totals.netIncome + Number(entry.netAmount || 0));

    if (entry.commissionRateType === 'direct') {
      totals.directIncome = roundMoney(totals.directIncome + Number(entry.netAmount || 0));
    } else {
      totals.overrideIncome = roundMoney(totals.overrideIncome + Number(entry.netAmount || 0));
    }

    if (entry.receiptId) totals.receiptedReleaseCount += 1;

    const month = String(entry.releaseDate || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) {
      const current = monthMap.get(month) || { month, releaseCount: 0, grossIncome: 0, deductions: 0, netIncome: 0 };
      current.releaseCount += 1;
      current.grossIncome = roundMoney(current.grossIncome + Number(entry.grossAmount || 0));
      current.deductions = roundMoney(current.deductions + Number(entry.deductionAmount || 0));
      current.netIncome = roundMoney(current.netIncome + Number(entry.netAmount || 0));
      monthMap.set(month, current);
    }

    return totals;
  }, {
    releaseCount: entries.length,
    commissionCount: 0,
    propertyCount: 0,
    receiptedReleaseCount: 0,
    grossIncome: 0,
    deductions: 0,
    netIncome: 0,
    directIncome: 0,
    overrideIncome: 0,
    monthlyTotals: [],
  });

  summary.commissionCount = [...commissionIds].filter(Boolean).length;
  summary.propertyCount = [...listingIds].filter(Boolean).length;
  summary.monthlyTotals = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  return summary;
};

export const SELLER_INCOME_RANGE_QUERY = `
  SELECT
    r.lot_project_commission_release_id,
    c.lot_project_commission_id,
    c.lot_project_id,
    c.lot_project_listing_id,
    c.lot_project_client_profile_id,
    c.accredited_seller_id,
    c.sale_owner_accredited_seller_id,
    c.commission_role,
    c.commission_seller_type,
    c.commission_rate_type,
    c.commission_rate,
    lp.lot_project_name,
    lp.lot_project_location,
    l.lot_project_listing_unit_id,
    cp.buyer_full_name,
    r.release_stage,
    r.release_percent,
    r.gross_release_amount,
    r.deduction_amount,
    r.net_release_amount,
    r.actual_release_date,
    receipt.lot_project_commission_receipt_id,
    receipt.receipt_date,
    receipt.reference_number
  FROM lot_project_commission_releases r
  INNER JOIN lot_project_commissions c
    ON c.lot_project_commission_id = r.lot_project_commission_id
  INNER JOIN lot_projects lp
    ON lp.lot_project_id = c.lot_project_id
  INNER JOIN lot_project_listings l
    ON l.lot_project_listing_id = c.lot_project_listing_id
  INNER JOIN lot_project_client_profiles cp
    ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
  LEFT JOIN lot_project_commission_receipt_items receipt_item
    ON receipt_item.lot_project_commission_release_id = r.lot_project_commission_release_id
  LEFT JOIN lot_project_commission_receipts receipt
    ON receipt.lot_project_commission_receipt_id = receipt_item.lot_project_commission_receipt_id
   AND receipt.receipt_status = 'active'
  WHERE (
      c.accredited_seller_id = ?
      OR (
        c.commission_rate_type = 'direct'
        AND c.sale_owner_accredited_seller_id = ?
      )
    )
    AND r.release_status = 'Released'
    AND r.actual_release_date BETWEEN ? AND ?
  ORDER BY r.actual_release_date ASC,
    lp.lot_project_name ASC,
    l.lot_project_listing_unit_id ASC,
    FIELD(r.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention') ASC,
    r.lot_project_commission_release_id ASC
`;

const mapReleaseForReceipt = (row = {}) => ({
  releaseId: Number(row.lot_project_commission_release_id || row.release_id || 0),
  stage: row.release_stage,
  releasePercent: Number(row.release_percent || 0),
  grossAmount: roundMoney(row.gross_release_amount),
  deductionAmount: roundMoney(row.deduction_amount),
  amount: roundMoney(row.net_release_amount ?? row.release_amount),
  actualReleaseDate: row.actual_release_date,
});

const mapReceiptRows = (receiptRows = [], itemRows = []) => {
  const itemMap = new Map();
  itemRows.forEach((row) => {
    const receiptId = Number(row.lot_project_commission_receipt_id || 0);
    if (!itemMap.has(receiptId)) itemMap.set(receiptId, []);
    itemMap.get(receiptId).push(mapReleaseForReceipt(row));
  });

  return receiptRows.map((row) => ({
    receiptId: Number(row.lot_project_commission_receipt_id),
    commissionId: Number(row.lot_project_commission_id),
    projectId: Number(row.lot_project_id),
    listingId: Number(row.lot_project_listing_id),
    clientProfileId: Number(row.lot_project_client_profile_id),
    accreditedSellerId: Number(row.accredited_seller_id),
    projectName: row.lot_project_name,
    projectLocation: row.lot_project_location,
    unitId: row.lot_project_listing_unit_id,
    buyerName: row.buyer_full_name,
    commissionRole: row.commission_role,
    commissionRate: Number(row.commission_rate || 0),
    bankName: row.bank_name,
    accountNumber: row.account_number,
    receiptDate: row.receipt_date,
    referenceNumber: row.reference_number,
    witnessName: row.witness_name,
    totalAmount: roundMoney(row.total_amount),
    status: row.receipt_status,
    createdAt: row.created_at,
    createdByName: row.created_by_name,
    releases: itemMap.get(Number(row.lot_project_commission_receipt_id)) || [],
  }));
};

const getSellerReceiptIdentity = async (connection, sellerId) => {
  const [rows] = await connection.query(
    `
      SELECT
        a.accredited_seller_id,
        a.user_id,
        ${fullNameSql('u')} AS full_name,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        u.contact_no,
        u.tin_no,
        u.prc_no,
        u.address,
        u.role,
        a.seller_group_id,
        sg.seller_group_name,
        a.accredited_seller_status
      FROM accredited_sellers a
      INNER JOIN users u ON u.id = a.user_id
      LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
      WHERE a.accredited_seller_id = ?
      LIMIT 1
    `,
    [sellerId]
  );
  return rows[0] || null;
};

const loadSellerReceiptData = async (connection, sellerId) => {
  const seller = await getSellerReceiptIdentity(connection, sellerId);
  if (!seller) return null;

  const [availableRows] = await connection.query(
    `
      SELECT
        c.lot_project_commission_id,
        c.lot_project_id,
        c.lot_project_listing_id,
        c.lot_project_client_profile_id,
        c.accredited_seller_id,
        c.sale_owner_accredited_seller_id,
        c.commission_rate_type,
        c.commission_role,
        c.commission_rate,
        lp.lot_project_name,
        lp.lot_project_location,
        l.lot_project_listing_unit_id,
        cp.buyer_full_name,
        r.lot_project_commission_release_id,
        r.release_stage,
        r.release_percent,
        r.gross_release_amount,
        r.deduction_amount,
        r.net_release_amount,
        r.actual_release_date
      FROM lot_project_commission_releases r
      INNER JOIN lot_project_commissions c
        ON c.lot_project_commission_id = r.lot_project_commission_id
      INNER JOIN lot_projects lp
        ON lp.lot_project_id = c.lot_project_id
      INNER JOIN lot_project_listings l
        ON l.lot_project_listing_id = c.lot_project_listing_id
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
      LEFT JOIN lot_project_commission_receipt_items receipt_item
        ON receipt_item.lot_project_commission_release_id = r.lot_project_commission_release_id
      WHERE (
          c.accredited_seller_id = ?
          OR (
            c.commission_rate_type = 'direct'
            AND c.sale_owner_accredited_seller_id = ?
          )
        )
        AND r.release_status = 'Released'
        AND receipt_item.lot_project_commission_receipt_item_id IS NULL
      ORDER BY r.actual_release_date ASC,
        FIELD(r.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention') ASC,
        r.lot_project_commission_release_id ASC
    `,
    [sellerId, sellerId]
  );

  const groupMap = new Map();
  availableRows.forEach((row) => {
    const commissionId = Number(row.lot_project_commission_id);
    if (!groupMap.has(commissionId)) {
      groupMap.set(commissionId, {
        commissionId,
        projectId: Number(row.lot_project_id),
        listingId: Number(row.lot_project_listing_id),
        clientProfileId: Number(row.lot_project_client_profile_id),
        accreditedSellerId: sellerId,
        recipientAccreditedSellerId: Number(row.accredited_seller_id),
        saleOwnerAccreditedSellerId: Number(row.sale_owner_accredited_seller_id || row.accredited_seller_id),
        commissionRateType: row.commission_rate_type,
        commissionRole: row.commission_role,
        commissionRate: Number(row.commission_rate || 0),
        projectName: row.lot_project_name,
        projectLocation: row.lot_project_location,
        unitId: row.lot_project_listing_unit_id,
        buyerName: row.buyer_full_name,
        releases: [],
        totalAmount: 0,
      });
    }

    const group = groupMap.get(commissionId);
    const release = mapReleaseForReceipt(row);
    group.releases.push(release);
    group.totalAmount = roundMoney(group.totalAmount + release.amount);
  });

  const [receiptRows] = await connection.query(
    `
      SELECT
        receipt.*,
        lp.lot_project_name,
        lp.lot_project_location,
        l.lot_project_listing_unit_id,
        cp.buyer_full_name,
        c.commission_role,
        c.commission_rate,
        ${fullNameSql('creator')} AS created_by_name
      FROM lot_project_commission_receipts receipt
      INNER JOIN lot_projects lp ON lp.lot_project_id = receipt.lot_project_id
      INNER JOIN lot_project_listings l ON l.lot_project_listing_id = receipt.lot_project_listing_id
      INNER JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = receipt.lot_project_client_profile_id
      INNER JOIN lot_project_commissions c ON c.lot_project_commission_id = receipt.lot_project_commission_id
      LEFT JOIN users creator ON creator.id = receipt.created_by_user_id
      WHERE receipt.accredited_seller_id = ?
      ORDER BY receipt.receipt_date DESC, receipt.lot_project_commission_receipt_id DESC
    `,
    [sellerId]
  );

  let itemRows = [];
  if (receiptRows.length) {
    const receiptIds = receiptRows.map((row) => row.lot_project_commission_receipt_id);
    [itemRows] = await connection.query(
      `
        SELECT
          item.lot_project_commission_receipt_id,
          item.release_amount,
          r.lot_project_commission_release_id,
          r.release_stage,
          r.release_percent,
          r.gross_release_amount,
          r.deduction_amount,
          r.net_release_amount,
          r.actual_release_date
        FROM lot_project_commission_receipt_items item
        INNER JOIN lot_project_commission_releases r
          ON r.lot_project_commission_release_id = item.lot_project_commission_release_id
        WHERE item.lot_project_commission_receipt_id IN (${receiptIds.map(() => '?').join(', ')})
        ORDER BY item.lot_project_commission_receipt_id DESC,
          FIELD(r.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention') ASC
      `,
      receiptIds
    );
  }

  return {
    seller,
    availableGroups: [...groupMap.values()],
    receipts: mapReceiptRows(receiptRows, itemRows),
  };
};

export const getAccreditedSellerProofOfIncomeData = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const user = await requireReceiptManager(req, res);
    if (!user) return;

    const sellerId = Number(req.params.sellerId || 0);
    if (!sellerId) return res.status(400).json({ message: 'Seller id is required.' });

    await ensureCommissionReceiptTables(connection);
    const data = await loadSellerReceiptData(connection, sellerId);
    if (!data) return res.status(404).json({ message: 'Accredited seller not found.' });

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getAccreditedSellerIncomeRangeReport = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requireReceiptManager(req, res);
    if (!user) return;

    const sellerId = Number(req.params.sellerId || 0);
    if (!sellerId) return res.status(400).json({ message: 'Seller id is required.' });

    const range = normalizeSellerIncomeRange(req.query.startDate, req.query.endDate);

    await ensureCommissionReceiptTables(connection);
    const seller = await getSellerReceiptIdentity(connection, sellerId);
    if (!seller) return res.status(404).json({ message: 'Accredited seller not found.' });

    const [rows] = await connection.query(
      SELLER_INCOME_RANGE_QUERY,
      [sellerId, sellerId, range.startDate, range.endDate]
    );

    const entries = rows.map(mapSellerIncomeRangeRow);
    const summary = summarizeSellerIncomeRangeRows(entries);

    return res.json({
      success: true,
      data: {
        seller,
        range,
        summary,
        entries,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createAccreditedSellerProofOfIncomeReceipt = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requireReceiptManager(req, res);
    if (!user) return;

    const sellerId = Number(req.params.sellerId || 0);
    const commissionId = Number(req.body.commissionId || 0);
    const releaseIds = [...new Set((Array.isArray(req.body.releaseIds) ? req.body.releaseIds : []).map(Number).filter(Boolean))];
    const bankName = String(req.body.bankName || '').trim();
    const accountNumber = String(req.body.accountNumber || '').trim();
    const receiptDate = String(req.body.receiptDate || '').trim();
    const referenceNumber = String(req.body.referenceNumber || '').trim();
    const witnessName = String(req.body.witnessName || '').trim();

    if (!sellerId) return res.status(400).json({ message: 'Seller id is required.' });
    if (!commissionId) return res.status(400).json({ message: 'Select a commission release group.' });
    if (!releaseIds.length) return res.status(400).json({ message: 'Select at least one released commission stage.' });
    if (!bankName) return res.status(400).json({ message: 'Bank is required.' });
    if (!accountNumber) return res.status(400).json({ message: 'Account number is required.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) return res.status(400).json({ message: 'Enter a valid receipt date.' });
    if (!referenceNumber) return res.status(400).json({ message: 'Reference number is required.' });
    if (!witnessName) return res.status(400).json({ message: 'Witness name is required.' });

    await ensureCommissionReceiptTables(connection);
    await connection.beginTransaction();

    const seller = await getSellerReceiptIdentity(connection, sellerId);
    if (!seller) throw Object.assign(new Error('Accredited seller not found.'), { statusCode: 404 });

    const placeholders = releaseIds.map(() => '?').join(', ');
    const [releaseRows] = await connection.query(
      `
        SELECT
          c.lot_project_commission_id,
          c.lot_project_id,
          c.lot_project_listing_id,
          c.lot_project_client_profile_id,
          c.accredited_seller_id,
          c.sale_owner_accredited_seller_id,
          c.commission_rate_type,
          c.commission_role,
          lp.lot_project_name,
          lp.lot_project_location,
          l.lot_project_listing_unit_id,
          cp.buyer_full_name,
          r.lot_project_commission_release_id,
          r.release_stage,
          r.release_percent,
          r.gross_release_amount,
          r.deduction_amount,
          r.net_release_amount,
          r.release_status,
          r.actual_release_date,
          receipt_item.lot_project_commission_receipt_item_id
        FROM lot_project_commission_releases r
        INNER JOIN lot_project_commissions c
          ON c.lot_project_commission_id = r.lot_project_commission_id
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = c.lot_project_id
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = c.lot_project_listing_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
        LEFT JOIN lot_project_commission_receipt_items receipt_item
          ON receipt_item.lot_project_commission_release_id = r.lot_project_commission_release_id
        WHERE r.lot_project_commission_release_id IN (${placeholders})
        FOR UPDATE
      `,
      releaseIds
    );

    if (releaseRows.length !== releaseIds.length) {
      throw Object.assign(new Error('One or more selected commission releases no longer exist.'), { statusCode: 400 });
    }

    const invalidRow = releaseRows.find((row) => {
      const belongsToSeller =
        Number(row.accredited_seller_id) === sellerId ||
        (
          row.commission_rate_type === 'direct' &&
          Number(row.sale_owner_accredited_seller_id) === sellerId
        );

      return (
        !belongsToSeller ||
        Number(row.lot_project_commission_id) !== commissionId ||
        row.release_status !== 'Released' ||
        row.lot_project_commission_receipt_item_id
      );
    });

    if (invalidRow) {
      throw Object.assign(new Error('Selected releases must be released, belong to the same seller and listing, and not be included in another receipt.'), { statusCode: 409 });
    }

    const first = releaseRows[0];
    const totalAmount = roundMoney(releaseRows.reduce((sum, row) => sum + Number(row.net_release_amount || 0), 0));
    if (totalAmount <= 0) throw Object.assign(new Error('Selected releases have no payable amount.'), { statusCode: 400 });

    const [receiptResult] = await connection.query(
      `
        INSERT INTO lot_project_commission_receipts (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_commission_id,
          accredited_seller_id,
          bank_name,
          account_number,
          receipt_date,
          reference_number,
          witness_name,
          total_amount,
          receipt_status,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `,
      [
        first.lot_project_id,
        first.lot_project_listing_id,
        first.lot_project_client_profile_id,
        commissionId,
        sellerId,
        bankName,
        accountNumber,
        receiptDate,
        referenceNumber,
        witnessName,
        totalAmount,
        user.id,
      ]
    );

    const itemValues = releaseRows.map((row) => [
      receiptResult.insertId,
      row.lot_project_commission_release_id,
      roundMoney(row.net_release_amount),
    ]);

    await connection.query(
      `
        INSERT INTO lot_project_commission_receipt_items (
          lot_project_commission_receipt_id,
          lot_project_commission_release_id,
          release_amount
        ) VALUES ?
      `,
      [itemValues]
    );

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Commissions',
      entityType: 'lot_project_commission_receipt',
      entityId: String(receiptResult.insertId),
      entityLabel: `${seller.full_name} — ${first.lot_project_listing_unit_id}`,
      title: 'Generated seller proof of income receipt',
      description: `Generated a ${totalAmount.toFixed(2)} proof of income receipt from ${releaseRows.length} released commission stage(s).`,
      metadata: {
        sellerId,
        commissionId,
        releaseIds,
        referenceNumber,
        totalAmount,
      },
    });

    await connection.commit();

    const data = await loadSellerReceiptData(connection, sellerId);
    const receipt = data?.receipts?.find((item) => Number(item.receiptId) === Number(receiptResult.insertId));

    return res.status(201).json({
      success: true,
      message: `Proof of income receipt generated from ${releaseRows.length} released commission stage(s).`,
      receipt,
      data,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

