import { db } from '../db/connect.js';

export const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

export const getActorId = (req) => req.user?.id || req.user?.user_id || null;

export const getMainProject = async () => {
  const [rows] = await db.query('SELECT * FROM project_bailen ORDER BY project_bailen_id ASC LIMIT 1');
  return rows[0] || null;
};

export const getProjectDocuments = async (projectId) => {
  const [rows] = await db.query(
    `
      SELECT
        pbd.project_bailen_default_document_id,
        pbd.document_id,
        d.document_name,
        d.document_description,
        pbd.requirement,
        pbd.status
      FROM project_bailen_default_documents pbd
      INNER JOIN documents d ON d.document_id = pbd.document_id
      WHERE pbd.project_bailen_id = ?
      ORDER BY d.document_name ASC
    `,
    [projectId]
  );
  return rows;
};

export const getProjectTemplateIds = async (projectId) => {
  const [rows] = await db.query(
    `
      SELECT pdt.template_id, dt.template_name
      FROM project_bailen_document_templates pdt
      INNER JOIN document_templates dt ON dt.template_id = pdt.template_id
      WHERE pdt.project_bailen_id = ?
      ORDER BY dt.template_name ASC
    `,
    [projectId]
  );
  return rows;
};

export const getListingCollectionPercent = async (listingId) => {
  const [[listing]] = await db.query('SELECT tcp FROM bailen_listings WHERE bailen_listing_id = ? LIMIT 1', [listingId]);
  const [[paid]] = await db.query('SELECT COALESCE(SUM(amount),0) AS total_paid FROM bailen_payments WHERE bailen_listing_id = ?', [listingId]);
  const tcp = toNumber(listing?.tcp);
  if (!tcp) return 0;
  return Math.min((toNumber(paid?.total_paid) / tcp) * 100, 100);
};

export const syncSoaPayment = async (listingId, paymentId, soaRowId, amount, paymentDate, referenceId) => {
  let targetSoaRowId = soaRowId;

  if (!targetSoaRowId) {
    const [rows] = await db.query(
      `
        SELECT soa_row_id
        FROM bailen_soa_rows
        WHERE bailen_listing_id = ? AND status IN ('unpaid','partial')
        ORDER BY due_date ASC, soa_row_id ASC
        LIMIT 1
      `,
      [listingId]
    );
    targetSoaRowId = rows[0]?.soa_row_id || null;
  }

  if (!targetSoaRowId) return null;

  const [[row]] = await db.query('SELECT due_amount, amount_paid FROM bailen_soa_rows WHERE soa_row_id = ? LIMIT 1', [targetSoaRowId]);
  if (!row) return null;

  const newPaid = toNumber(row.amount_paid) + toNumber(amount);
  const dueAmount = toNumber(row.due_amount);
  const status = newPaid >= dueAmount ? 'paid' : 'partial';
  const endingBalance = Math.max(dueAmount - newPaid, 0);

  await db.query(
    `
      UPDATE bailen_soa_rows
      SET amount_paid = ?, date_paid = ?, reference_id = ?, status = ?, ending_balance = ?
      WHERE soa_row_id = ?
    `,
    [newPaid, paymentDate, referenceId, status, endingBalance, targetSoaRowId]
  );

  await db.query('UPDATE bailen_payments SET soa_row_id = ? WHERE payment_id = ?', [targetSoaRowId, paymentId]);
  return targetSoaRowId;
};

const releasePlan = [
  { key: '20', label: '20%', threshold: 20, share: 0.20 },
  { key: '40', label: '40%', threshold: 40, share: 0.20 },
  { key: '60', label: '60%', threshold: 60, share: 0.20 },
  { key: '75', label: '75%', threshold: 75, share: 0.15 },
  { key: 'retention', label: 'Retention', threshold: 100, share: 0.25 },
];

export const syncCommissionForListing = async (listingId) => {
  const [[listing]] = await db.query(
    `
      SELECT bl.*, cp.seller_user_id, a.seller_group_id, a.accredited_seller_assigned_rate_bailen,
             sg.seller_group_pool_rate_bailen
      FROM bailen_listings bl
      LEFT JOIN bailen_client_profiles cp ON cp.bailen_listing_id = bl.bailen_listing_id
      LEFT JOIN accredited_sellers a ON a.user_id = cp.seller_user_id
      LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
      WHERE bl.bailen_listing_id = ?
      LIMIT 1
    `,
    [listingId]
  );

  if (!listing || listing.status !== 'sold' || !listing.seller_user_id) return null;

  const rate = toNumber(listing.accredited_seller_assigned_rate_bailen || listing.seller_group_pool_rate_bailen || 0);
  const gross = toNumber(listing.tcp) * (rate / 100);

  const [existingRows] = await db.query('SELECT commission_id, released_amount FROM bailen_commissions WHERE bailen_listing_id = ? LIMIT 1', [listingId]);
  let commissionId = existingRows[0]?.commission_id;
  const releasedAmount = toNumber(existingRows[0]?.released_amount);

  if (!commissionId) {
    const [result] = await db.query(
      `
        INSERT INTO bailen_commissions (
          bailen_listing_id, seller_user_id, seller_group_id, tcp_snapshot,
          commission_rate_snapshot, gross_commission, released_amount, net_remaining, status
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending')
      `,
      [listingId, listing.seller_user_id, listing.seller_group_id, listing.tcp, rate, gross, gross]
    );
    commissionId = result.insertId;
  } else {
    await db.query(
      `
        UPDATE bailen_commissions
        SET seller_user_id = ?, seller_group_id = ?, tcp_snapshot = ?, commission_rate_snapshot = ?, gross_commission = ?, net_remaining = GREATEST(? - released_amount, 0)
        WHERE commission_id = ?
      `,
      [listing.seller_user_id, listing.seller_group_id, listing.tcp, rate, gross, gross, commissionId]
    );
  }

  for (const milestone of releasePlan) {
    await db.query(
      `
        INSERT INTO bailen_commission_releases (commission_id, milestone_key, milestone_label, milestone_threshold, gross_amount, status)
        VALUES (?, ?, ?, ?, ?, 'locked')
        ON DUPLICATE KEY UPDATE milestone_label = VALUES(milestone_label), milestone_threshold = VALUES(milestone_threshold), gross_amount = VALUES(gross_amount)
      `,
      [commissionId, milestone.key, milestone.label, milestone.threshold, gross * milestone.share]
    );
  }

  const collectionPercent = await getListingCollectionPercent(listingId);
  await db.query(
    `
      UPDATE bailen_commission_releases
      SET status = 'pending'
      WHERE commission_id = ? AND status = 'locked' AND milestone_threshold <= ?
    `,
    [commissionId, collectionPercent]
  );

  const [[released]] = await db.query('SELECT COALESCE(SUM(gross_amount),0) AS total FROM bailen_commission_releases WHERE commission_id = ? AND status = "released"', [commissionId]);
  const newReleased = toNumber(released?.total);
  await db.query(
    `
      UPDATE bailen_commissions
      SET released_amount = ?, net_remaining = GREATEST(gross_commission - ?, 0), status = CASE WHEN ? >= gross_commission THEN 'released' WHEN ? > 0 THEN 'partially_released' ELSE 'pending' END
      WHERE commission_id = ?
    `,
    [newReleased, newReleased, newReleased, newReleased, commissionId]
  );

  return commissionId;
};

export const generateCashReference = async (listingId, paymentDate) => {
  const [[listing]] = await db.query('SELECT unit_code FROM bailen_listings WHERE bailen_listing_id = ? LIMIT 1', [listingId]);
  const safeUnit = String(listing?.unit_code || `CU${listingId}`).replace(/[^A-Za-z0-9]/g, '');
  const ymd = String(paymentDate).replace(/-/g, '');
  const [[countRow]] = await db.query(
    'SELECT COUNT(*) AS count FROM bailen_payments WHERE reference_id LIKE ?',
    [`CASH-${ymd}-${safeUnit}-%`]
  );
  const next = String(toNumber(countRow?.count) + 1).padStart(4, '0');
  return `CASH-${ymd}-${safeUnit}-${next}`;
};
