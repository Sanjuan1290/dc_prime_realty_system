import crypto from 'node:crypto';

import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  getListingLookupWhere,
  getProjectBySlug,
  getUserFullName,
  parseClientDocumentImages,
  tableExists,
  columnExists,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { destroyCloudinaryAsset } from '../../../services/secureCloudinary.service.js';

const CODE_EXPIRY_MINUTES = Math.max(5, Math.min(Number(process.env.DESTRUCTIVE_ACTION_CODE_EXPIRY_MINUTES || 10), 30));
const CODE_MAX_ATTEMPTS = Math.max(3, Math.min(Number(process.env.DESTRUCTIVE_ACTION_MAX_ATTEMPTS || 5), 10));

const clean = (value) => String(value ?? '').trim();
const escapeHtml = (value = '') => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const requestIp = (req) => clean(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip).split(',')[0].trim();
const maskEmail = (email = '') => {
  const [local = '', domain = ''] = clean(email).split('@');
  if (!domain) return 'your account email';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
};

const verificationSecret = () => {
  const secret = clean(
    process.env.DESTRUCTIVE_ACTION_CODE_SECRET ||
    process.env.AUDIT_DELETE_CODE_SECRET ||
    process.env.JWT_SECRET
  );
  if (!secret) throw Object.assign(new Error('Set DESTRUCTIVE_ACTION_CODE_SECRET for permanent deletion verification.'), { statusCode: 500 });
  return secret;
};

const hashCode = (code) => crypto.createHmac('sha256', verificationSecret()).update(clean(code)).digest('hex');
const codeMatches = (code, expected) => {
  const actual = Buffer.from(hashCode(code), 'hex');
  const expectedBuffer = Buffer.from(clean(expected), 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};
const payloadHash = ({ accountId, accountReference, reason, userId }) => crypto
  .createHash('sha256')
  .update(JSON.stringify({ accountId: Number(accountId), accountReference: clean(accountReference), reason: clean(reason), userId: Number(userId) }))
  .digest('hex');

const sendDeletionCodeEmail = async ({ to, name, code, accountReference, unitId, buyerName }) => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !clean(process.env[key]));
  if (missing.length) throw Object.assign(new Error(`SMTP is not configured. Missing: ${missing.join(', ')}`), { statusCode: 500 });

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const companyName = clean(process.env.COMPANY_NAME) || 'D&C Prime Realty';
  const safeCompanyName = escapeHtml(companyName);
  const safeName = escapeHtml(name || 'Super Admin');
  const safeAccountReference = escapeHtml(accountReference);
  const safeUnitId = escapeHtml(unitId);
  await transporter.sendMail({
    from: clean(process.env.SMTP_FROM) || process.env.SMTP_USER,
    to,
    subject: `Permanent account deletion code - ${accountReference}`,
    text: [
      `Hello ${name || 'Super Admin'},`,
      '',
      `Your verification code is ${code}.`,
      `Account: ${accountReference}`,
      `Unit: ${unitId}`,
      `Buyer: ${buyerName || '-'}`,
      `The code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      '',
      'Do not share this code. Ignore this email if you did not request permanent deletion.',
      '',
      companyName,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">
        <h2>${safeCompanyName}</h2>
        <p>Hello ${safeName},</p>
        <p>Use this code to permanently delete the closed buyer account <strong>${safeAccountReference}</strong> for unit <strong>${safeUnitId}</strong>.</p>
        <div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:18px;background:#fee2e2;border:1px solid #fecaca;border-radius:12px;text-align:center">${code}</div>
        <p>This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p>
        <p style="color:#991b1b"><strong>This action permanently removes financial and document records and cannot be undone.</strong></p>
      </div>
    `,
  });
};

const getAccountForProject = async (connection, req, { forUpdate = false } = {}) => {
  const project = await getProjectBySlug(clean(req.params.projectSlug));
  if (!project) return { errorStatus: 404, errorMessage: 'Lot project not found.' };

  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return { errorStatus: 400, errorMessage: 'Account id is required.' };

  const [rows] = await connection.query(
    `
      SELECT
        account.*,
        listing.current_account_id,
        listing.lot_project_listing_status,
        listing.lot_project_listing_unit_id,
        profile.buyer_full_name,
        profile.buyer_email
      FROM lot_project_accounts account
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = account.lot_project_listing_id
      LEFT JOIN lot_project_client_profiles profile
        ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
      WHERE account.lot_project_account_id = ?
        AND account.lot_project_id = ?
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [accountId, project.lot_project_id]
  );

  if (!rows[0]) return { errorStatus: 404, errorMessage: 'Buyer account not found.' };
  return { project, account: rows[0] };
};

const countRows = async (connection, tableName, whereSql, params) => {
  if (!(await tableExists(connection, tableName))) return 0;
  const [[row]] = await connection.query(`SELECT COUNT(*) AS total FROM ${tableName} WHERE ${whereSql}`, params);
  return Number(row?.total || 0);
};

const getPurgePreview = async (connection, account) => {
  const profileId = Number(account.lot_project_client_profile_id);
  const accountId = Number(account.lot_project_account_id);
  const counts = {
    payments: await countRows(connection, 'lot_project_payments', 'lot_project_client_profile_id = ?', [profileId]),
    schedules: await countRows(connection, 'lot_project_payment_schedules', 'lot_project_client_profile_id = ?', [profileId]),
    paymentLogs: 0,
    documents: await countRows(connection, 'lot_project_client_documents', 'lot_project_client_profile_id = ?', [profileId]),
    documentFiles: await countRows(connection, 'lot_project_client_document_files', 'lot_project_account_id = ?', [accountId]),
    commissions: await countRows(connection, 'lot_project_commissions', 'lot_project_client_profile_id = ?', [profileId]),
    receipts: await countRows(connection, 'lot_project_commission_receipts', 'lot_project_client_profile_id = ?', [profileId]),
    reservationHistory: await countRows(
      connection,
      'lot_project_reservation_history',
      await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id')
        ? 'lot_project_account_id = ?'
        : 'lot_project_client_profile_id = ?',
      [await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id') ? accountId : profileId]
    ),
    soaStatements: await countRows(connection, 'lot_project_soa_statements', 'lot_project_client_profile_id = ?', [profileId]),
    cancellationArchives: (await tableExists(connection, 'lot_project_cancelled_sale_archives'))
      && (await columnExists(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id'))
      ? await countRows(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id = ?', [accountId])
      : 0,
  };

  if (await tableExists(connection, 'lot_project_payment_logs')) {
    const [[row]] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM lot_project_payment_logs logs
        INNER JOIN lot_project_payments payment
          ON payment.lot_project_payment_id = logs.lot_project_payment_id
        WHERE payment.lot_project_client_profile_id = ?
      `,
      [profileId]
    );
    counts.paymentLogs = Number(row?.total || 0);
  }

  const [[financial]] = await connection.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN payment.lot_project_payment_status = 'Verified' THEN payment.lot_project_payment_amount ELSE 0 END), 0) AS verified_payments,
        COALESCE((SELECT SUM(release_row.net_release_amount)
          FROM lot_project_commission_releases release_row
          INNER JOIN lot_project_commissions commission
            ON commission.lot_project_commission_id = release_row.lot_project_commission_id
          WHERE commission.lot_project_client_profile_id = ?
            AND release_row.release_status = 'Released'), 0) AS released_commission,
        COALESCE((SELECT COUNT(*)
          FROM lot_project_commission_releases release_row
          INNER JOIN lot_project_commissions commission
            ON commission.lot_project_commission_id = release_row.lot_project_commission_id
          WHERE commission.lot_project_client_profile_id = ?
            AND release_row.release_status IN ('Earned on Cancellation', 'Eligible')), 0) AS unpaid_earned_stages
      FROM lot_project_payments payment
      WHERE payment.lot_project_client_profile_id = ?
    `,
    [profileId, profileId, profileId]
  );

  return {
    counts,
    verifiedPayments: Number(financial?.verified_payments || 0),
    releasedCommission: Number(financial?.released_commission || 0),
    unpaidEarnedStages: Number(financial?.unpaid_earned_stages || 0),
  };
};

export const getLotProjectListingAccountHistory = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug));
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    const lookup = getListingLookupWhere(clean(req.params.listingId), 'listing');
    const [listingRows] = await connection.query(
      `SELECT lot_project_listing_id, current_account_id, lot_project_listing_unit_id FROM lot_project_listings listing WHERE listing.lot_project_id = ? AND ${lookup.sql} LIMIT 1`,
      [project.lot_project_id, ...lookup.params]
    );
    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    if (!(await tableExists(connection, 'lot_project_accounts'))) {
      return res.json({ success: true, data: [], currentAccountId: null, migrationRequired: true });
    }

    const [rows] = await connection.query(
      `
        SELECT
          account.*,
          profile.buyer_full_name,
          profile.buyer_email,
          profile.buyer_contact_number,
          (SELECT COUNT(*) FROM lot_project_payments payment WHERE payment.lot_project_account_id = account.lot_project_account_id) AS payment_count,
          (SELECT COALESCE(SUM(payment.lot_project_payment_amount), 0) FROM lot_project_payments payment WHERE payment.lot_project_account_id = account.lot_project_account_id AND payment.lot_project_payment_status = 'Verified') AS verified_payment_total,
          (SELECT COUNT(*) FROM lot_project_client_documents document_row WHERE document_row.lot_project_account_id = account.lot_project_account_id) AS document_count,
          (SELECT COUNT(*) FROM lot_project_commissions commission WHERE commission.lot_project_account_id = account.lot_project_account_id) AS commission_count
        FROM lot_project_accounts account
        LEFT JOIN lot_project_client_profiles profile
          ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
        WHERE account.lot_project_listing_id = ?
        ORDER BY account.created_at DESC, account.lot_project_account_id DESC
      `,
      [listing.lot_project_listing_id]
    );

    return res.json({
      success: true,
      currentAccountId: listing.current_account_id ? Number(listing.current_account_id) : null,
      unitId: listing.lot_project_listing_unit_id,
      data: rows.map((row) => ({
        id: Number(row.lot_project_account_id),
        accountReference: row.account_reference,
        status: row.account_status,
        buyerName: row.buyer_full_name || row.buyer_name_snapshot || '-',
        buyerEmail: row.buyer_email || '',
        buyerContactNumber: row.buyer_contact_number || '',
        unitId: row.unit_id_snapshot,
        reservationDate: row.reservation_date,
        cancellationDate: row.cancellation_date,
        closedAt: row.closed_at,
        cashCollected: Number(row.cash_collected_at_cancellation || 0),
        refundAmount: Number(row.refund_amount || 0),
        discontinuedAmount: Number(row.discontinued_amount || 0),
        commissionableRetainedAmount: Number(row.commissionable_retained_amount || 0),
        commissionableRetainedPercent: Number(row.commissionable_retained_percent || 0),
        paymentCount: Number(row.payment_count || 0),
        verifiedPaymentTotal: Number(row.verified_payment_total || 0),
        documentCount: Number(row.document_count || 0),
        commissionCount: Number(row.commission_count || 0),
        isCurrent: Number(listing.current_account_id || 0) === Number(row.lot_project_account_id),
      })),
    });
  } catch (error) {
    console.error('[AccountHistory] Failed to load listing accounts', {
      code: error?.code,
      message: error?.message,
      sqlMessage: error?.sqlMessage,
      projectSlug: req.params.projectSlug,
      listingId: req.params.listingId,
    });
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getLotProjectAccountPurgePreview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const context = await getAccountForProject(connection, req);
    if (context.errorStatus) return res.status(context.errorStatus).json({ message: context.errorMessage });
    const preview = await getPurgePreview(connection, context.account);
    return res.json({ success: true, data: { ...context.account, ...preview } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const requestLotProjectAccountPurgeCode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const actor = await getAuthenticatedUser(req);
    if (!actor?.id || !actor.email) return res.status(400).json({ message: 'The Super Admin account must have an email address.' });

    const reason = clean(req.body.deletionReason || req.body.reason);
    const confirmationText = clean(req.body.confirmationText);
    if (reason.length < 10) return res.status(400).json({ message: 'Enter a deletion reason with at least 10 characters.' });

    await connection.beginTransaction();
    const context = await getAccountForProject(connection, req, { forUpdate: true });
    if (context.errorStatus) {
      await connection.rollback();
      return res.status(context.errorStatus).json({ message: context.errorMessage });
    }

    const account = context.account;
    if (Number(account.current_account_id || 0) === Number(account.lot_project_account_id)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Close the account and return the unit to Available before permanent deletion.' });
    }
    if (account.account_status !== 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'Only a finalized cancelled account can be permanently deleted.' });
    }
    if (confirmationText !== `DELETE ${account.account_reference}`) {
      await connection.rollback();
      return res.status(400).json({ message: `Type DELETE ${account.account_reference} to continue.` });
    }

    const preview = await getPurgePreview(connection, account);
    if (preview.unpaidEarnedStages > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'This account has earned commission stages that are not released or formally resolved.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const hash = payloadHash({ accountId: account.lot_project_account_id, accountReference: account.account_reference, reason, userId: actor.id });

    await connection.query(
      `UPDATE destructive_action_verifications SET status = 'expired' WHERE user_id = ? AND action_type = 'lot_project_account_purge' AND status = 'pending'`,
      [actor.id]
    );
    const [insertResult] = await connection.query(
      `
        INSERT INTO destructive_action_verifications (
          user_id, action_type, entity_type, entity_id, code_hash, payload_hash, reason,
          attempt_count, max_attempts, expires_at, status, request_ip
        ) VALUES (?, 'lot_project_account_purge', 'lot_project_account', ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'pending', ?)
      `,
      [actor.id, String(account.lot_project_account_id), hashCode(code), hash, reason, CODE_MAX_ATTEMPTS, CODE_EXPIRY_MINUTES, requestIp(req)]
    );

    await sendDeletionCodeEmail({
      to: actor.email,
      name: getUserFullName(actor),
      code,
      accountReference: account.account_reference,
      unitId: account.lot_project_listing_unit_id,
      buyerName: account.buyer_full_name || account.buyer_name_snapshot,
    });

    await connection.commit();
    return res.json({
      success: true,
      message: `A verification code was sent to ${maskEmail(actor.email)}.`,
      data: {
        verificationId: Number(insertResult.insertId),
        maskedEmail: maskEmail(actor.email),
        expiresInMinutes: CODE_EXPIRY_MINUTES,
        accountReference: account.account_reference,
        preview,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const collectCloudinaryAssets = async (connection, account) => {
  const assets = new Map();
  if (await tableExists(connection, 'lot_project_client_document_files')) {
    const [rows] = await connection.query(
      `SELECT cloudinary_public_id, cloudinary_resource_type, cloudinary_delivery_type FROM lot_project_client_document_files WHERE lot_project_account_id = ?`,
      [account.lot_project_account_id]
    );
    rows.forEach((row) => {
      if (!row.cloudinary_public_id) return;
      assets.set(`${row.cloudinary_resource_type}:${row.cloudinary_delivery_type}:${row.cloudinary_public_id}`, {
        publicId: row.cloudinary_public_id,
        resourceType: row.cloudinary_resource_type || 'image',
        deliveryType: row.cloudinary_delivery_type || 'authenticated',
      });
    });
  }

  if (await tableExists(connection, 'lot_project_client_documents') && account.lot_project_client_profile_id) {
    const [rows] = await connection.query(
      `SELECT lot_project_client_document_file_name, lot_project_client_document_file_url FROM lot_project_client_documents WHERE lot_project_client_profile_id = ?`,
      [account.lot_project_client_profile_id]
    );
    rows.forEach((row) => {
      parseClientDocumentImages(row.lot_project_client_document_file_url, row.lot_project_client_document_file_name).forEach((entry) => {
        const publicId = clean(entry.cloudinaryPublicId || entry.cloudinary_public_id || entry.public_id);
        if (!publicId) return;
        const resourceType = clean(entry.cloudinaryResourceType || entry.cloudinary_resource_type || entry.resource_type) || 'image';
        const deliveryType = clean(entry.cloudinaryDeliveryType || entry.cloudinary_delivery_type || entry.type) || 'upload';
        assets.set(`${resourceType}:${deliveryType}:${publicId}`, { publicId, resourceType, deliveryType });
      });
    });
  }

  // Old versions stored the last cancelled buyer's document rows only inside
  // the compatibility archive. Include those assets during a verified purge.
  if (
    await tableExists(connection, 'lot_project_cancelled_sale_archives')
    && await columnExists(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id')
  ) {
    const [archiveRows] = await connection.query(
      `SELECT client_document_snapshot FROM lot_project_cancelled_sale_archives WHERE lot_project_account_id = ?`,
      [account.lot_project_account_id]
    );
    archiveRows.forEach((archiveRow) => {
      let documents = [];
      try {
        documents = Array.isArray(archiveRow.client_document_snapshot)
          ? archiveRow.client_document_snapshot
          : JSON.parse(archiveRow.client_document_snapshot || '[]');
      } catch {
        documents = [];
      }
      documents.forEach((documentRow) => {
        parseClientDocumentImages(
          documentRow.lot_project_client_document_file_url,
          documentRow.lot_project_client_document_file_name
        ).forEach((entry) => {
          const publicId = clean(entry.cloudinaryPublicId || entry.cloudinary_public_id || entry.public_id);
          if (!publicId) return;
          const resourceType = clean(entry.cloudinaryResourceType || entry.cloudinary_resource_type || entry.resource_type) || 'image';
          const deliveryType = clean(entry.cloudinaryDeliveryType || entry.cloudinary_delivery_type || entry.type) || 'upload';
          assets.set(`${resourceType}:${deliveryType}:${publicId}`, { publicId, resourceType, deliveryType });
        });
      });
    });
  }
  return [...assets.values()];
};

const deleteAccountDatabaseRows = async (connection, account) => {
  const profileId = Number(account.lot_project_client_profile_id);
  const accountId = Number(account.lot_project_account_id);
  const counts = {};
  const execute = async (name, sql, params) => {
    if (!(await tableExists(connection, name))) return;
    const [result] = await connection.query(sql, params);
    counts[name] = Number(result.affectedRows || 0);
  };

  if (await tableExists(connection, 'lot_project_commission_receipt_items')) {
    await execute('lot_project_commission_receipt_items', `DELETE item FROM lot_project_commission_receipt_items item INNER JOIN lot_project_commission_receipts receipt ON receipt.lot_project_commission_receipt_id = item.lot_project_commission_receipt_id WHERE receipt.lot_project_client_profile_id = ?`, [profileId]);
  }
  await execute('lot_project_commission_receipts', 'DELETE FROM lot_project_commission_receipts WHERE lot_project_client_profile_id = ?', [profileId]);
  if (await tableExists(connection, 'lot_project_commission_releases')) {
    await execute('lot_project_commission_releases', `DELETE release_row FROM lot_project_commission_releases release_row INNER JOIN lot_project_commissions commission ON commission.lot_project_commission_id = release_row.lot_project_commission_id WHERE commission.lot_project_client_profile_id = ?`, [profileId]);
  }
  await execute('lot_project_commissions', 'DELETE FROM lot_project_commissions WHERE lot_project_client_profile_id = ?', [profileId]);

  if (await tableExists(connection, 'lot_project_payment_allocations')) {
    await execute('lot_project_payment_allocations', `DELETE allocation FROM lot_project_payment_allocations allocation LEFT JOIN lot_project_payments payment ON payment.lot_project_payment_id = allocation.lot_project_payment_id LEFT JOIN lot_project_payment_schedules schedule_row ON schedule_row.lot_project_payment_schedule_id = allocation.lot_project_payment_schedule_id WHERE payment.lot_project_client_profile_id = ? OR schedule_row.lot_project_client_profile_id = ?`, [profileId, profileId]);
  }
  if (await tableExists(connection, 'lot_project_payment_logs')) {
    await execute('lot_project_payment_logs', `DELETE logs FROM lot_project_payment_logs logs INNER JOIN lot_project_payments payment ON payment.lot_project_payment_id = logs.lot_project_payment_id WHERE payment.lot_project_client_profile_id = ?`, [profileId]);
  }
  await execute('lot_project_penalty_reliefs', 'DELETE FROM lot_project_penalty_reliefs WHERE lot_project_client_profile_id = ?', [profileId]);
  await execute('lot_project_notification_logs', 'DELETE FROM lot_project_notification_logs WHERE lot_project_client_profile_id = ?', [profileId]);
  await execute('lot_project_payments', 'DELETE FROM lot_project_payments WHERE lot_project_client_profile_id = ?', [profileId]);
  await execute('lot_project_payment_schedules', 'DELETE FROM lot_project_payment_schedules WHERE lot_project_client_profile_id = ?', [profileId]);
  await execute('lot_project_soa_statements', 'DELETE FROM lot_project_soa_statements WHERE lot_project_client_profile_id = ?', [profileId]);
  await execute('lot_project_client_document_files', 'DELETE FROM lot_project_client_document_files WHERE lot_project_account_id = ?', [accountId]);
  await execute('lot_project_client_documents', 'DELETE FROM lot_project_client_documents WHERE lot_project_client_profile_id = ?', [profileId]);

  for (const tableName of ['lot_project_buyer_form_submissions', 'lot_project_buyer_form_links']) {
    if ((await tableExists(connection, tableName)) && (await columnExists(connection, tableName, 'lot_project_account_id'))) {
      await execute(tableName, `DELETE FROM ${tableName} WHERE lot_project_account_id = ?`, [accountId]);
    }
  }

  // Compatibility archives are still created for old reports. Remove them only
  // inside this verified purge, child rows first.
  if (await tableExists(connection, 'lot_project_archived_commission_releases')) {
    if (await columnExists(connection, 'lot_project_archived_commission_releases', 'lot_project_account_id')) {
      await execute('lot_project_archived_commission_releases', 'DELETE FROM lot_project_archived_commission_releases WHERE lot_project_account_id = ?', [accountId]);
    } else if (profileId) {
      await execute('lot_project_archived_commission_releases', 'DELETE FROM lot_project_archived_commission_releases WHERE lot_project_client_profile_id = ?', [profileId]);
    }
  }
  if ((await tableExists(connection, 'lot_project_cancelled_sale_archives')) && (await columnExists(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id'))) {
    await execute('lot_project_cancelled_sale_archives', 'DELETE FROM lot_project_cancelled_sale_archives WHERE lot_project_account_id = ?', [accountId]);
  }

  if (
    await tableExists(connection, 'lot_project_reservation_history')
    && await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id')
  ) {
    await execute('lot_project_reservation_history', 'DELETE FROM lot_project_reservation_history WHERE lot_project_account_id = ?', [accountId]);
  } else if (profileId) {
    await execute('lot_project_reservation_history', 'DELETE FROM lot_project_reservation_history WHERE lot_project_client_profile_id = ?', [profileId]);
  }
  if (profileId) {
    await execute('lot_project_client_profiles', 'DELETE FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ?', [profileId]);
  }
  await execute('lot_project_accounts', 'DELETE FROM lot_project_accounts WHERE lot_project_account_id = ?', [accountId]);
  return counts;
};

export const purgeLotProjectAccount = async (req, res) => {
  const connection = await db.getConnection();
  let purgeEventId = 0;
  let purgeAccountId = 0;
  try {
    const actor = await getAuthenticatedUser(req);
    const verificationId = Number(req.body.verificationId || 0);
    const code = clean(req.body.code);
    if (!verificationId || !/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the six-digit verification code.' });

    await connection.beginTransaction();
    const context = await getAccountForProject(connection, req, { forUpdate: true });
    if (context.errorStatus) {
      await connection.rollback();
      return res.status(context.errorStatus).json({ message: context.errorMessage });
    }
    const account = context.account;
    purgeAccountId = Number(account.lot_project_account_id || 0);
    if (Number(account.current_account_id || 0) === Number(account.lot_project_account_id) || account.account_status !== 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'The account is no longer eligible for permanent deletion.' });
    }

    const [verificationRows] = await connection.query(
      `SELECT *, expires_at < NOW() AS is_expired FROM destructive_action_verifications WHERE destructive_action_verification_id = ? AND user_id = ? AND action_type = 'lot_project_account_purge' AND entity_id = ? LIMIT 1 FOR UPDATE`,
      [verificationId, actor.id, String(account.lot_project_account_id)]
    );
    const verification = verificationRows[0];
    if (!verification || verification.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Verification request is no longer active.' });
    }
    if (Number(verification.is_expired || 0) === 1) {
      await connection.query(`UPDATE destructive_action_verifications SET status = 'expired' WHERE destructive_action_verification_id = ?`, [verificationId]);
      await connection.commit();
      return res.status(400).json({ message: 'This verification code has expired. Request a new code.' });
    }

    const attemptCount = Number(verification.attempt_count || 0) + 1;
    if (!codeMatches(code, verification.code_hash)) {
      const status = attemptCount >= Number(verification.max_attempts || CODE_MAX_ATTEMPTS) ? 'locked' : 'pending';
      await connection.query(`UPDATE destructive_action_verifications SET attempt_count = ?, status = ? WHERE destructive_action_verification_id = ?`, [attemptCount, status, verificationId]);
      await connection.commit();
      return res.status(status === 'locked' ? 429 : 401).json({ message: status === 'locked' ? 'Too many incorrect codes. Request a new code.' : 'Verification code is incorrect.' });
    }

    const expectedPayloadHash = payloadHash({ accountId: account.lot_project_account_id, accountReference: account.account_reference, reason: verification.reason, userId: actor.id });
    if (expectedPayloadHash !== verification.payload_hash) {
      await connection.rollback();
      return res.status(409).json({ message: 'Deletion request details changed. Request a new code.' });
    }

    const preview = await getPurgePreview(connection, account);
    if (preview.unpaidEarnedStages > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Earned commission stages must be resolved before deletion.' });
    }

    const deletionReference = `DEL-${new Date().getFullYear()}-${String(account.lot_project_account_id).padStart(6, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const [eventResult] = await connection.query(
      `
        INSERT INTO lot_project_account_purge_events (
          deletion_reference, account_id_snapshot, account_reference_snapshot, lot_project_id_snapshot,
          lot_project_listing_id_snapshot, unit_id_snapshot, buyer_name_snapshot, deletion_reason,
          requested_by_user_id, destructive_action_verification_id, purge_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')
      `,
      [deletionReference, account.lot_project_account_id, account.account_reference, account.lot_project_id, account.lot_project_listing_id, account.lot_project_listing_unit_id, account.buyer_full_name || account.buyer_name_snapshot, verification.reason, actor.id, verificationId]
    );
    purgeEventId = Number(eventResult.insertId);
    await connection.query(`UPDATE lot_project_accounts SET account_status = 'deletion_pending' WHERE lot_project_account_id = ?`, [account.lot_project_account_id]);
    await connection.commit();

    const assets = await collectCloudinaryAssets(connection, account);
    for (const asset of assets) {
      const result = await destroyCloudinaryAsset(asset);
      if (!['ok', 'not found'].includes(clean(result?.result).toLowerCase())) {
        throw Object.assign(new Error(`Cloudinary could not delete ${asset.publicId}.`), { statusCode: 502 });
      }
    }

    await connection.beginTransaction();
    const [accountRows] = await connection.query(`SELECT * FROM lot_project_accounts WHERE lot_project_account_id = ? LIMIT 1 FOR UPDATE`, [account.lot_project_account_id]);
    if (!accountRows[0]) throw Object.assign(new Error('The account was already deleted.'), { statusCode: 409 });

    const counts = await deleteAccountDatabaseRows(connection, account);
    const manifestHash = crypto.createHash('sha256').update(JSON.stringify({ deletionReference, accountId: account.lot_project_account_id, counts, cloudinaryAssets: assets.map((item) => item.publicId).sort() })).digest('hex');

    await connection.query(
      `UPDATE destructive_action_verifications SET status = 'used', attempt_count = ?, verified_at = NOW(), used_at = NOW() WHERE destructive_action_verification_id = ?`,
      [attemptCount, verificationId]
    );
    await connection.query(
      `UPDATE lot_project_account_purge_events SET deleted_row_counts_json = ?, cloudinary_asset_count = ?, deletion_manifest_hash = ?, purge_status = 'completed', completed_at = NOW() WHERE lot_project_account_purge_event_id = ?`,
      [JSON.stringify(counts), assets.length, manifestHash, purgeEventId]
    );

    await writeAuditLog(connection, req, {
      action: 'delete',
      module: 'Lot Project Accounts',
      entityType: 'lot_project_account_purge',
      entityId: deletionReference,
      entityLabel: `${account.account_reference} — ${account.lot_project_listing_unit_id}`,
      title: 'Permanently deleted closed buyer account records',
      description: `Permanently deleted ${account.account_reference} after administrator password and email-code verification.`,
      metadata: { deletionReference, accountReference: account.account_reference, listingId: account.lot_project_listing_id, unitId: account.lot_project_listing_unit_id, deletedRowCounts: counts, cloudinaryAssetCount: assets.length, manifestHash },
    });

    await connection.commit();
    return res.json({ success: true, message: `${account.account_reference} was permanently deleted.`, data: { deletionReference, counts, cloudinaryAssetCount: assets.length } });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    if (purgeEventId) {
      try {
        await connection.query(`UPDATE lot_project_account_purge_events SET purge_status = 'failed', error_message = ? WHERE lot_project_account_purge_event_id = ?`, [getErrorMessage(error), purgeEventId]);
        if (purgeAccountId) {
          await connection.query(`UPDATE lot_project_accounts SET account_status = 'cancelled', updated_at = NOW() WHERE lot_project_account_id = ? AND account_status = 'deletion_pending'`, [purgeAccountId]);
        }
      } catch {}
    }
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
