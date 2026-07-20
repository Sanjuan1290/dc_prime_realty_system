import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  tableExists,
  columnExists,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import {
  buildSoaPdfBuffer,
  formatSoaReference,
  getManilaDateOnly,
  sanitizeAttachmentFileName,
} from '../../services/paymentSoaPdf.service.js';

const toDateOnly = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const toMoneyNumber = (value) => Number(Number(value || 0).toFixed(2));

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const amountOnly = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const longDate = (value) => {
  if (!value || value === '-') return '-';
  const clean = toDateOnly(value);
  const [year, month, day] = clean.split('-').map(Number);
  if (!year || !month || !day) return clean;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const escapeHtml = (value = '') =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fullName = (row = {}) => {
  const name = [row.buyer_first_name, row.buyer_middle_name, row.buyer_last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  return row.buyer_full_name || name || 'No buyer name';
};

const adminRoles = new Set(['super_admin', 'admin']);

const canManageNotifications = (user = {}) => adminRoles.has(user.role);

const notificationLogTableSql = `
  CREATE TABLE IF NOT EXISTS lot_project_notification_logs (
    notification_log_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lot_project_id INT UNSIGNED NULL,
    lot_project_listing_id INT UNSIGNED NULL,
    lot_project_client_profile_id INT UNSIGNED NULL,
    lot_project_account_id BIGINT UNSIGNED NULL,
    lot_project_payment_schedule_id INT UNSIGNED NULL,
    notification_type ENUM('due_soon','overdue') NOT NULL,
    recipient_email VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_by_user_id INT UNSIGNED NULL,
    sent_at DATETIME NULL,
    send_status ENUM('sent','failed','contacted') NOT NULL DEFAULT 'sent',
    error_message TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_log_id),
    KEY idx_notification_schedule (lot_project_payment_schedule_id),
    KEY idx_notification_project (lot_project_id),
    KEY idx_notification_listing (lot_project_listing_id),
    KEY idx_notification_client (lot_project_client_profile_id),
    KEY idx_notification_account (lot_project_account_id),
    KEY idx_notification_sender (sent_by_user_id),
    CONSTRAINT fk_notification_project
      FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_notification_listing
      FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_notification_client_profile
      FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_notification_schedule
      FOREIGN KEY (lot_project_payment_schedule_id) REFERENCES lot_project_payment_schedules (lot_project_payment_schedule_id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_notification_sender
      FOREIGN KEY (sent_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const ensureNotificationTable = async (connection) => {
  await connection.query(notificationLogTableSql);
};

const soaStatementTableSql = `
  CREATE TABLE IF NOT EXISTS lot_project_soa_statements (
    soa_statement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    soa_reference VARCHAR(32) NULL,
    lot_project_id INT UNSIGNED NOT NULL,
    lot_project_listing_id INT UNSIGNED NOT NULL,
    lot_project_client_profile_id INT UNSIGNED NOT NULL,
    lot_project_account_id BIGINT UNSIGNED NULL,
    lot_project_payment_schedule_id INT UNSIGNED NOT NULL,
    statement_date DATE NOT NULL,
    due_date DATE NULL,
    description VARCHAR(150) NOT NULL,
    total_contract_price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    legal_misc_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    penalty_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    payment_due DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    recipient_email VARCHAR(150) NOT NULL,
    pdf_filename VARCHAR(255) NULL,
    snapshot_json JSON NULL,
    created_by_user_id INT UNSIGNED NULL,
    last_sent_by_user_id INT UNSIGNED NULL,
    first_sent_at DATETIME NULL,
    last_sent_at DATETIME NULL,
    sent_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (soa_statement_id),
    UNIQUE KEY uq_soa_reference (soa_reference),
    UNIQUE KEY uq_soa_schedule (lot_project_payment_schedule_id),
    KEY idx_soa_project (lot_project_id),
    KEY idx_soa_listing (lot_project_listing_id),
    KEY idx_soa_client (lot_project_client_profile_id),
    KEY idx_soa_account (lot_project_account_id),
    KEY idx_soa_created_by (created_by_user_id),
    KEY idx_soa_last_sent_by (last_sent_by_user_id),
    CONSTRAINT fk_soa_project
      FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_soa_listing
      FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_soa_client
      FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_soa_schedule
      FOREIGN KEY (lot_project_payment_schedule_id) REFERENCES lot_project_payment_schedules (lot_project_payment_schedule_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_soa_created_by
      FOREIGN KEY (created_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_soa_last_sent_by
      FOREIGN KEY (last_sent_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const ensureSoaStatementTable = async (connection) => {
  await connection.query(soaStatementTableSql);
};

const ensureNotificationTables = async (connection) => {
  await ensureNotificationTable(connection);
  await ensureSoaStatementTable(connection);
};

const mapNotificationRow = (row = {}) => {
  const dueAmount = toMoneyNumber(row.due_amount);
  const discountAmount = toMoneyNumber(row.discount_amount ?? row.discountAmount ?? 0);
  const penaltyAmount = toMoneyNumber(row.penalty_amount);
  const amountPaid = toMoneyNumber(row.amount_paid);
  const totalDue = toMoneyNumber(Math.max(dueAmount - discountAmount, 0) + penaltyAmount);
  const balance = toMoneyNumber(Math.max(totalDue - amountPaid, 0));
  const notificationType = row.notification_type || (row.is_overdue ? 'overdue' : 'due_soon');

  return {
    id: row.lot_project_payment_schedule_id,
    scheduleId: row.lot_project_payment_schedule_id,
    notificationType,
    statusLabel: notificationType === 'overdue' ? 'Overdue' : 'Due Soon',
    projectId: row.lot_project_id,
    projectName: row.lot_project_name || 'Lot Project',
    projectSlug: row.lot_project_slug,
    listingId: row.lot_project_listing_id,
    unitId: row.lot_project_listing_unit_id,
    clientProfileId: row.lot_project_client_profile_id,
    accountId: row.lot_project_account_id ? Number(row.lot_project_account_id) : null,
    totalContractPrice: toMoneyNumber(row.lot_project_listing_tcp),
    legalMiscFee: toMoneyNumber(row.lot_project_listing_lmf_amount),
    companyName: row.company_name || 'D&C Prime Realty',
    companyEmail: row.company_email || process.env.SMTP_USER || 'dcprimegold@gmail.com',
    companyContactNumber: row.company_contact_number || row.reservation_contact_number || '(046) 866 0616',
    buyerName: fullName(row),
    buyerEmail: row.buyer_email || '',
    buyerContactNumber: row.buyer_contact_number || '',
    dueDate: toDateOnly(row.due_date),
    description: row.description || '-',
    dueAmount,
    discountAmount,
    penaltyAmount,
    amountPaid,
    paymentDue: balance,
    balance,
    totalDue,
    scheduleStatus: row.schedule_status || 'Unpaid',
    lastNotificationStatus: row.last_notification_status || null,
    lastNotificationAt: row.last_notification_at ? toDateOnly(row.last_notification_at) : null,
    lastNotificationType: row.last_notification_type || null,
    listingPath: row.lot_project_slug && row.lot_project_listing_unit_id
      ? `/lot-projects/${row.lot_project_slug}/listings/${row.lot_project_listing_unit_id}`
      : '',
  };
};

const getScheduleDiscountExpression = async (connection, alias = 's', clientAlias = 'cp') => {
  const downpaymentDiscountFallback = `CASE
    WHEN LOWER(${alias}.description) LIKE '%downpayment%' OR LOWER(${alias}.description) LIKE '%down payment%'
      THEN ROUND(${alias}.due_amount * (COALESCE(${clientAlias}.soa_dp_discount_percentage, 0) / 100), 2)
    ELSE 0
  END`;

  const hasDiscountAmount = await columnExists(connection, 'lot_project_payment_schedules', 'discount_amount');
  return hasDiscountAmount
    ? `GREATEST(COALESCE(${alias}.discount_amount, 0), ${downpaymentDiscountFallback})`
    : downpaymentDiscountFallback;
};

const getContractSnapshotExpressions = async (connection, listingAlias = 'l', clientAlias = 'cp') => {
  const hasSelectedTcp = await columnExists(connection, 'lot_project_client_profiles', 'soa_selected_tcp');
  const hasSelectedLmf = await columnExists(connection, 'lot_project_client_profiles', 'soa_selected_lmf_amount');

  return {
    tcp: hasSelectedTcp
      ? `COALESCE(${clientAlias}.soa_selected_tcp, ${listingAlias}.lot_project_listing_tcp)`
      : `${listingAlias}.lot_project_listing_tcp`,
    lmf: hasSelectedLmf
      ? `COALESCE(${clientAlias}.soa_selected_lmf_amount, ${listingAlias}.lot_project_listing_lmf_amount)`
      : `${listingAlias}.lot_project_listing_lmf_amount`,
  };
};

const getScheduleSortSql = (alias = 's') => `
  CASE
    WHEN LOWER(${alias}.description) LIKE '%reservation%' THEN 0
    WHEN LOWER(${alias}.description) LIKE '%downpayment%' OR LOWER(${alias}.description) LIKE '%down payment%' THEN 1
    WHEN LOWER(${alias}.description) LIKE '%monthly%' THEN 2
    WHEN LOWER(${alias}.description) LIKE '%legal%' OR LOWER(${alias}.description) LIKE '%misc%' OR LOWER(${alias}.description) LIKE '%lmf%' THEN 3
    ELSE 4
  END
`;

const getScheduleNotificationRow = async (connection, scheduleId) => {
  const discountExpr = await getScheduleDiscountExpression(connection, 's');
  const contractSnapshot = await getContractSnapshotExpressions(connection);

  const [rows] = await connection.query(
    `
      SELECT
        s.*,
        ${discountExpr} AS discount_amount,
        p.lot_project_name,
        p.lot_project_slug,
        l.lot_project_listing_unit_id,
        ${contractSnapshot.tcp} AS lot_project_listing_tcp,
        ${contractSnapshot.lmf} AS lot_project_listing_lmf_amount,
        st.company_name,
        st.company_email,
        st.company_contact_number,
        st.reservation_contact_number,
        cp.buyer_first_name,
        cp.buyer_middle_name,
        cp.buyer_last_name,
        cp.buyer_full_name,
        cp.buyer_email,
        cp.buyer_contact_number,
        CASE
          WHEN s.due_date < CURDATE() THEN 'overdue'
          WHEN s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'due_soon'
          ELSE 'not_due'
        END AS notification_type
      FROM lot_project_payment_schedules s
      INNER JOIN lot_projects p
        ON p.lot_project_id = s.lot_project_id
      INNER JOIN lot_project_listings l
        ON l.lot_project_listing_id = s.lot_project_listing_id
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
      LEFT JOIN lot_project_settings st
        ON st.lot_project_id = p.lot_project_id
      WHERE s.lot_project_payment_schedule_id = ?
      LIMIT 1
    `,
    [scheduleId]
  );

  return rows[0] || null;
};

const prepareSoaStatement = async (connection, notification, userId) => {
  const statementDate = getManilaDateOnly();
  const snapshot = {
    statementDate,
    scheduleId: notification.scheduleId,
    projectId: notification.projectId,
    projectName: notification.projectName,
    listingId: notification.listingId,
    unitId: notification.unitId,
    clientProfileId: notification.clientProfileId,
    accountId: notification.accountId,
    buyerName: notification.buyerName,
    buyerEmail: notification.buyerEmail,
    dueDate: notification.dueDate,
    description: notification.description,
    totalContractPrice: notification.totalContractPrice,
    legalMiscFee: notification.legalMiscFee,
    dueAmount: notification.dueAmount,
    discountAmount: notification.discountAmount,
    penaltyAmount: notification.penaltyAmount,
    amountPaid: notification.amountPaid,
    paymentDue: notification.paymentDue,
    notificationType: notification.notificationType,
  };

  await connection.beginTransaction();
  try {
    await connection.query(
      `
        INSERT INTO lot_project_soa_statements (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          statement_date,
          due_date,
          description,
          total_contract_price,
          legal_misc_fee,
          due_amount,
          discount_amount,
          penalty_amount,
          amount_paid,
          payment_due,
          recipient_email,
          snapshot_json,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          lot_project_account_id = COALESCE(VALUES(lot_project_account_id), lot_project_account_id),
          statement_date = VALUES(statement_date),
          due_date = VALUES(due_date),
          description = VALUES(description),
          total_contract_price = VALUES(total_contract_price),
          legal_misc_fee = VALUES(legal_misc_fee),
          due_amount = VALUES(due_amount),
          discount_amount = VALUES(discount_amount),
          penalty_amount = VALUES(penalty_amount),
          amount_paid = VALUES(amount_paid),
          payment_due = VALUES(payment_due),
          recipient_email = VALUES(recipient_email),
          snapshot_json = VALUES(snapshot_json),
          created_by_user_id = COALESCE(created_by_user_id, VALUES(created_by_user_id))
      `,
      [
        notification.projectId,
        notification.listingId,
        notification.clientProfileId,
        notification.accountId,
        notification.scheduleId,
        statementDate,
        notification.dueDate === '-' ? null : notification.dueDate,
        notification.description,
        notification.totalContractPrice,
        notification.legalMiscFee,
        notification.dueAmount,
        notification.discountAmount,
        notification.penaltyAmount,
        notification.amountPaid,
        notification.paymentDue,
        notification.buyerEmail,
        JSON.stringify(snapshot),
        userId,
      ]
    );

    const [rows] = await connection.query(
      `
        SELECT soa_statement_id, soa_reference
        FROM lot_project_soa_statements
        WHERE lot_project_payment_schedule_id = ?
        FOR UPDATE
      `,
      [notification.scheduleId]
    );

    const statement = rows[0];
    if (!statement) throw new Error('Unable to create Statement of Account record.');

    const soaReference = statement.soa_reference || formatSoaReference(statement.soa_statement_id, statementDate);
    const pdfFilename = sanitizeAttachmentFileName(
      `${soaReference}-${notification.projectName}-${notification.unitId}`
    );
    const finalSnapshot = JSON.stringify({ ...snapshot, soaReference, pdfFilename });

    await connection.query(
      `
        UPDATE lot_project_soa_statements
        SET soa_reference = ?, pdf_filename = ?, snapshot_json = ?
        WHERE soa_statement_id = ?
      `,
      [soaReference, pdfFilename, finalSnapshot, statement.soa_statement_id]
    );

    await connection.commit();
    return {
      statementId: Number(statement.soa_statement_id),
      soaReference,
      statementDate,
      pdfFilename,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

const markSoaStatementSent = async (connection, statementId, userId, recipientEmail, pdfFilename) => {
  await connection.query(
    `
      UPDATE lot_project_soa_statements
      SET
        recipient_email = ?,
        pdf_filename = ?,
        last_sent_by_user_id = ?,
        first_sent_at = COALESCE(first_sent_at, NOW()),
        last_sent_at = NOW(),
        sent_count = sent_count + 1
      WHERE soa_statement_id = ?
    `,
    [recipientEmail, pdfFilename, userId, statementId]
  );
};

const buildNotificationMessage = (notification, statement) => {
  const isOverdue = notification.notificationType === 'overdue';
  const dueDateLabel = longDate(notification.dueDate);
  const companyName = notification.companyName || 'D&C Prime Realty';
  const companyEmail = notification.companyEmail || 'dcprimerealty@gmail.com';
  const companyContactNumber = notification.companyContactNumber || '(046) 866-0616';
  const subject = isOverdue
    ? `Statement of Account - Overdue - ${notification.projectName} ${notification.unitId} - ${statement.soaReference}`
    : `Statement of Account - Payment Reminder - ${notification.projectName} ${notification.unitId} - ${statement.soaReference}`;
  const opening = isOverdue
    ? `Our records show that your ${notification.description} amounting to ${money(notification.paymentDue)} was due on ${dueDateLabel}.`
    : `This is a reminder that your ${notification.description} amounting to ${money(notification.paymentDue)} is due on ${dueDateLabel}.`;

  const textMessage = [
    `Dear ${notification.buyerName},`,
    '',
    opening,
    '',
    `Your Statement of Account (${statement.soaReference}) is attached as a PDF.`,
    'If you have already made the payment, please disregard this message.',
    '',
    `For questions, contact ${companyName} at ${companyContactNumber} or ${companyEmail}.`,
    '',
    'Thank you,',
    companyName,
  ].join('\n');

  const htmlMessage = `
    <div style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;padding:28px">
        <p style="margin:0 0 16px">Dear ${escapeHtml(notification.buyerName)},</p>
        <p style="margin:0 0 16px">${escapeHtml(opening)}</p>
        <p style="margin:0 0 16px">Your Statement of Account <strong>${escapeHtml(statement.soaReference)}</strong> is attached as a PDF.</p>
        <p style="margin:0 0 16px">If you have already made the payment, please disregard this message.</p>
        <p style="margin:0 0 20px">For questions, contact ${escapeHtml(companyName)} at ${escapeHtml(companyContactNumber)} or ${escapeHtml(companyEmail)}.</p>
        <p style="margin:0">Thank you,<br><strong>${escapeHtml(companyName)}</strong></p>
      </div>
    </div>
  `;

  return { subject, textMessage, htmlMessage };
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredEnv.filter((key) => !String(process.env[key] || '').trim());

  if (missing.length > 0) {
    throw new Error(`SMTP is not configured. Missing: ${missing.join(', ')}`);
  }

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    throw new Error('Email package is missing. Run npm install in the server folder first.');
  }

  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
};

export const getPaymentDueNotifications = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please login before viewing notifications.' });
    if (!canManageNotifications(user)) return res.status(403).json({ message: 'Admin access only.' });

    if (!(await tableExists(connection, 'lot_project_payment_schedules'))) {
      return res.status(500).json({ message: 'lot_project_payment_schedules table does not exist.' });
    }

    await ensureNotificationTable(connection);

    const category = String(req.query.category || 'all').toLowerCase();
    const search = String(req.query.search || '').trim();
    const projectSlug = String(req.query.projectSlug || '').trim();
    const discountExpr = await getScheduleDiscountExpression(connection, 's');
    const contractSnapshot = await getContractSnapshotExpressions(connection);
    const unpaidBalanceExpr = `GREATEST((s.due_amount + s.penalty_amount - ${discountExpr}) - s.amount_paid, 0)`;

    const where = [
      `s.schedule_status IN ('Unpaid', 'Partial', 'Overdue')`,
      `${unpaidBalanceExpr} > 0`,
      `s.due_date IS NOT NULL`,
      `(
        (s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
        OR s.due_date < CURDATE()
      )`,
    ];
    const params = [];

    if (category === 'due_soon') {
      where.push(`s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`);
    }

    if (category === 'overdue') {
      where.push(`s.due_date < CURDATE()`);
    }

    if (projectSlug) {
      where.push(`p.lot_project_slug = ?`);
      params.push(projectSlug);
    }

    if (search) {
      where.push(`(
        p.lot_project_name LIKE ?
        OR l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR cp.buyer_email LIKE ?
        OR s.description LIKE ?
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    const [rows] = await connection.query(
      `
        SELECT
          s.*,
          ${discountExpr} AS discount_amount,
          p.lot_project_name,
          p.lot_project_slug,
          l.lot_project_listing_unit_id,
          ${contractSnapshot.tcp} AS lot_project_listing_tcp,
          ${contractSnapshot.lmf} AS lot_project_listing_lmf_amount,
          st.company_name,
          st.company_email,
          st.company_contact_number,
          st.reservation_contact_number,
          cp.buyer_first_name,
          cp.buyer_middle_name,
          cp.buyer_last_name,
          cp.buyer_full_name,
          cp.buyer_email,
          cp.buyer_contact_number,
          CASE
            WHEN s.due_date < CURDATE() THEN 'overdue'
            ELSE 'due_soon'
          END AS notification_type,
          latest_log.send_status AS last_notification_status,
          latest_log.created_at AS last_notification_at,
          latest_log.notification_type AS last_notification_type
        FROM lot_project_payment_schedules s
        INNER JOIN lot_projects p
          ON p.lot_project_id = s.lot_project_id
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = s.lot_project_listing_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
        LEFT JOIN lot_project_settings st
          ON st.lot_project_id = p.lot_project_id
        LEFT JOIN (
          SELECT nl.*
          FROM lot_project_notification_logs nl
          INNER JOIN (
            SELECT lot_project_payment_schedule_id, MAX(notification_log_id) AS latest_id
            FROM lot_project_notification_logs
            GROUP BY lot_project_payment_schedule_id
          ) latest
            ON latest.latest_id = nl.notification_log_id
        ) latest_log
          ON latest_log.lot_project_payment_schedule_id = s.lot_project_payment_schedule_id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE WHEN s.due_date < CURDATE() THEN 0 ELSE 1 END,
          s.due_date ASC,
          ${getScheduleSortSql('s')},
          p.lot_project_name ASC,
          l.lot_project_listing_unit_id ASC
      `,
      params
    );

    const notifications = rows.map(mapNotificationRow);
    const summary = notifications.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.totalPaymentDue += item.paymentDue;
        acc.totalPenalty += item.penaltyAmount;
        if (item.notificationType === 'overdue') acc.overdue += 1;
        if (item.notificationType === 'due_soon') acc.dueSoon += 1;
        return acc;
      },
      { total: 0, dueSoon: 0, overdue: 0, totalPaymentDue: 0, totalPenalty: 0 }
    );

    summary.totalPaymentDue = toMoneyNumber(summary.totalPaymentDue);
    summary.totalPenalty = toMoneyNumber(summary.totalPenalty);

    return res.json({
      success: true,
      message: 'Payment notifications loaded.',
      data: {
        summary,
        notifications,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const sendPaymentDueNotification = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please login before sending a notification.' });
    if (!canManageNotifications(user)) return res.status(403).json({ message: 'Admin access only.' });

    await ensureNotificationTables(connection);

    const scheduleId = Number(req.params.scheduleId || 0);
    if (!scheduleId) return res.status(400).json({ message: 'Payment schedule id is required.' });

    const row = await getScheduleNotificationRow(connection, scheduleId);
    if (!row) return res.status(404).json({ message: 'Payment schedule not found.' });

    const notification = mapNotificationRow(row);
    if (!notification.buyerEmail) {
      return res.status(400).json({ message: 'Buyer email is missing. Add buyer email before sending notification.' });
    }

    if (!['Unpaid', 'Partial', 'Overdue'].includes(notification.scheduleStatus)) {
      return res.status(400).json({ message: 'Only unpaid, partial, or overdue schedules can receive payment notifications.' });
    }

    if (notification.paymentDue <= 0) {
      return res.status(400).json({ message: 'This payment schedule has no remaining amount due.' });
    }

    if (!['due_soon', 'overdue'].includes(notification.notificationType)) {
      return res.status(400).json({ message: 'This schedule is not due within 7 days or overdue.' });
    }

    const statement = await prepareSoaStatement(connection, notification, user.id);
    const { subject, textMessage, htmlMessage } = buildNotificationMessage(notification, statement);
    const pdfBuffer = buildSoaPdfBuffer({
      notification,
      soaReference: statement.soaReference,
      statementDate: statement.statementDate,
    });
    const logMessage = `${textMessage}\n\nAttachment: ${statement.pdfFilename}`;

    try {
      await sendEmail({
        to: notification.buyerEmail,
        subject,
        text: textMessage,
        html: htmlMessage,
        attachments: [
          {
            filename: statement.pdfFilename,
            content: pdfBuffer,
            contentType: 'application/pdf',
            contentDisposition: 'attachment',
          },
        ],
      });

      await markSoaStatementSent(
        connection,
        statement.statementId,
        user.id,
        notification.buyerEmail,
        statement.pdfFilename
      );

      await connection.query(
        `
          INSERT INTO lot_project_notification_logs (
            lot_project_id,
            lot_project_listing_id,
            lot_project_client_profile_id,
            lot_project_account_id,
            lot_project_payment_schedule_id,
            notification_type,
            recipient_email,
            subject,
            message,
            sent_by_user_id,
            sent_at,
            send_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'sent')
        `,
        [
          row.lot_project_id,
          row.lot_project_listing_id,
          row.lot_project_client_profile_id,
          row.lot_project_account_id || null,
          row.lot_project_payment_schedule_id,
          notification.notificationType,
          notification.buyerEmail,
          subject,
          logMessage,
          user.id,
        ]
      );

      return res.json({
        success: true,
        message: `${notification.statusLabel} email sent to ${notification.buyerEmail} with ${statement.pdfFilename} attached.`,
        data: {
          soaReference: statement.soaReference,
          attachmentFilename: statement.pdfFilename,
        },
      });
    } catch (emailError) {
      await connection.query(
        `
          INSERT INTO lot_project_notification_logs (
            lot_project_id,
            lot_project_listing_id,
            lot_project_client_profile_id,
            lot_project_account_id,
            lot_project_payment_schedule_id,
            notification_type,
            recipient_email,
            subject,
            message,
            sent_by_user_id,
            sent_at,
            send_status,
            error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'failed', ?)
        `,
        [
          row.lot_project_id,
          row.lot_project_listing_id,
          row.lot_project_client_profile_id,
          row.lot_project_account_id || null,
          row.lot_project_payment_schedule_id,
          notification.notificationType,
          notification.buyerEmail,
          subject,
          logMessage,
          user.id,
          emailError?.message || 'Failed to send email.',
        ]
      );

      return res.status(500).json({ message: emailError?.message || 'Failed to send notification email.' });
    }
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const markPaymentDueContacted = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ message: 'Please login before marking notification as contacted.' });
    if (!canManageNotifications(user)) return res.status(403).json({ message: 'Admin access only.' });

    await ensureNotificationTable(connection);

    const scheduleId = Number(req.params.scheduleId || 0);
    if (!scheduleId) return res.status(400).json({ message: 'Payment schedule id is required.' });

    const row = await getScheduleNotificationRow(connection, scheduleId);
    if (!row) return res.status(404).json({ message: 'Payment schedule not found.' });

    const notification = mapNotificationRow(row);
    const subject = `${notification.statusLabel} contacted - ${notification.projectName} ${notification.unitId}`;
    const message = String(req.body?.message || `Marked as contacted by ${user.email}.`).trim();

    await connection.query(
      `
        INSERT INTO lot_project_notification_logs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          notification_type,
          recipient_email,
          subject,
          message,
          sent_by_user_id,
          sent_at,
          send_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'contacted')
      `,
      [
        row.lot_project_id,
        row.lot_project_listing_id,
        row.lot_project_client_profile_id,
        row.lot_project_account_id || null,
        row.lot_project_payment_schedule_id,
        notification.notificationType,
        notification.buyerEmail || 'no-email-on-file',
        subject,
        message,
        user.id,
      ]
    );

    return res.json({
      success: true,
      message: `${notification.projectName} ${notification.unitId} marked as contacted.`,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getDocumentNotifications = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const requiredTables = [
      'lot_projects',
      'lot_project_listings',
      'lot_project_listing_documents',
      'lot_project_client_profiles',
      'lot_project_client_documents',
    ];

    for (const tableName of requiredTables) {
      if (!(await tableExists(connection, tableName))) {
        return res.json({
          success: true,
          data: {
            notifications: [],
            summary: { totalUnits: 0, pendingRequired: 0, missingRequired: 0, rejectedRequired: 0, awaitingApproval: 0 },
          },
        });
      }
    }

    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || 'all').trim().toLowerCase();
    const params = [];
    const filters = [];

    if (search) {
      const keyword = `%${search}%`;
      filters.push(`(
        lp.lot_project_name LIKE ?
        OR l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR cp.buyer_email LIKE ?
      )`);
      params.push(keyword, keyword, keyword, keyword);
    }

    const havingClauses = {
      missing: 'missing_required_documents > 0',
      rejected: 'rejected_required_documents > 0',
      awaiting: 'awaiting_approval_documents > 0',
      pending: 'pending_required_documents > 0',
    };
    const havingSql = havingClauses[category] ? `HAVING ${havingClauses[category]}` : '';

    const [rows] = await connection.query(
      `
        SELECT
          lp.lot_project_id,
          lp.lot_project_name,
          lp.lot_project_slug,
          l.lot_project_listing_id,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_status,
          l.lot_project_listing_sold_substatus,
          cp.lot_project_client_profile_id,
          cp.buyer_full_name,
          cp.buyer_email,
          cp.buyer_contact_number,
          COUNT(ld.lot_project_listing_document_id) AS total_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Submitted', 'Approved')), 0) AS submitted_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Approved'), 0) AS approved_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Submitted'), 0) AS awaiting_approval_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Missing', 'Rejected')
          ), 0) AS pending_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Missing'
          ), 0) AS missing_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Rejected'
          ), 0) AS rejected_required_documents
        FROM lot_project_listings l
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = l.lot_project_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id AND cp.lot_project_client_profile_status = 'active'
        INNER JOIN lot_project_listing_documents ld
          ON ld.lot_project_listing_id = l.lot_project_listing_id
         AND ld.lot_project_listing_document_status = 'active'
        LEFT JOIN lot_project_client_documents cd
          ON cd.lot_project_listing_id = l.lot_project_listing_id
         AND cd.lot_project_client_profile_id = cp.lot_project_client_profile_id
         AND cd.document_id = ld.document_id
        WHERE l.lot_project_listing_status IN ('sold', 'pending_for_cancellation')
          AND cp.lot_project_client_profile_status IN ('active', 'closed')
          ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
        GROUP BY
          lp.lot_project_id,
          lp.lot_project_name,
          lp.lot_project_slug,
          l.lot_project_listing_id,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_status,
          l.lot_project_listing_sold_substatus,
          cp.lot_project_client_profile_id,
          cp.buyer_full_name,
          cp.buyer_email,
          cp.buyer_contact_number
        ${havingSql}
        ORDER BY pending_required_documents DESC, awaiting_approval_documents DESC, lp.lot_project_name ASC, l.lot_project_listing_unit_id ASC
      `,
      params
    );

    const notifications = rows.map((row) => ({
      projectId: row.lot_project_id,
      projectName: row.lot_project_name,
      projectSlug: row.lot_project_slug,
      listingId: row.lot_project_listing_id,
      unitId: row.lot_project_listing_unit_id,
      listingStatus: row.lot_project_listing_status,
      soldSubstatus: row.lot_project_listing_sold_substatus,
      clientProfileId: row.lot_project_client_profile_id,
      buyerName: row.buyer_full_name || '-',
      buyerEmail: row.buyer_email || '',
      buyerContactNumber: row.buyer_contact_number || '',
      totalDocuments: Number(row.total_documents || 0),
      submittedDocuments: Number(row.submitted_documents || 0),
      approvedDocuments: Number(row.approved_documents || 0),
      awaitingApprovalDocuments: Number(row.awaiting_approval_documents || 0),
      pendingRequiredDocuments: Number(row.pending_required_documents || 0),
      missingRequiredDocuments: Number(row.missing_required_documents || 0),
      rejectedRequiredDocuments: Number(row.rejected_required_documents || 0),
      listingPath: `/lot-projects/${row.lot_project_slug}/listings/${row.lot_project_listing_id}`,
    }));

    const summary = notifications.reduce((totals, item) => {
      totals.pendingRequired += item.pendingRequiredDocuments;
      totals.missingRequired += item.missingRequiredDocuments;
      totals.rejectedRequired += item.rejectedRequiredDocuments;
      totals.awaitingApproval += item.awaitingApprovalDocuments;
      return totals;
    }, {
      totalUnits: notifications.length,
      pendingRequired: 0,
      missingRequired: 0,
      rejectedRequired: 0,
      awaitingApproval: 0,
    });

    return res.json({ success: true, data: { notifications, summary } });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

