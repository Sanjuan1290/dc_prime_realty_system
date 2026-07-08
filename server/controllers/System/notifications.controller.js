import {
  db,
  getAuthenticatedUser,
  getErrorMessage,
  tableExists,
  columnExists,
} from '../Lot_Projects/_shared/lotProject.shared.js';

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

  const [rows] = await connection.query(
    `
      SELECT
        s.*,
        ${discountExpr} AS discount_amount,
        p.lot_project_name,
        p.lot_project_slug,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_tcp,
        l.lot_project_listing_lmf_amount,
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

const buildNotificationMessage = (row = {}) => {
  const notification = mapNotificationRow(row);
  const isOverdue = notification.notificationType === 'overdue';
  const statementAsOf = longDate(notification.dueDate);
  const dueLabel = `${notification.description} Due on ${statementAsOf}`;
  const amountDueImmediately = isOverdue ? notification.paymentDue : 0;
  const companyName = escapeHtml(notification.companyName || 'D&C Prime Realty');
  const companyEmail = escapeHtml(notification.companyEmail || 'dcprimegold@gmail.com');
  const companyContactNumber = escapeHtml(notification.companyContactNumber || '(046) 866 0616');
  const logoUrl = String(process.env.EMAIL_LOGO_URL || '').trim();
  const subject = isOverdue
    ? `Statement of Account - Overdue - ${notification.projectName} ${notification.unitId}`
    : `Statement of Account - Payment Reminder - ${notification.projectName} ${notification.unitId}`;

  const textMessage = [
    'STATEMENT OF ACCOUNT',
    '',
    'Unit D, Mia\'s Building, Purok 1,',
    'Mataas na Lupa, Indang, Cavite,',
    '4122 Philippines',
    '',
    `Statement Date: As of ${statementAsOf}`,
    `SOA Number: SOA-${notification.scheduleId}`,
    `Project: ${notification.projectName}`,
    `Unit No.: ${notification.unitId}`,
    '',
    'AMOUNT DETAILS',
    `Total Contract Price: ${amountOnly(notification.totalContractPrice)}`,
    `Legal/Miscellaneous: ${amountOnly(notification.legalMiscFee)}`,
    `Total Amount: PHP ${amountOnly(notification.totalContractPrice)}`,
    '',
    `This is to bill the total amount of ${amountOnly(notification.paymentDue)}`,
    `Amortization: ${isOverdue ? amountOnly(notification.paymentDue) : amountOnly(0)}`,
    `Penalty: ${amountOnly(notification.penaltyAmount)}`,
    'Miscellaneous Fees & Adjustments: 0.00',
    `Amount Due Immediately: ${amountOnly(amountDueImmediately)}`,
    '',
    `${notification.description} Due on ${statementAsOf}: ${amountOnly(notification.paymentDue)}`,
    '',
    `NOTE: All transactions after ${statementAsOf} are not reflected in this Statement of Account (SOA).`,
    '',
    'Please pay on or before the due date to avoid penalties.',
    'Payments made after the statement date are not yet reflected.',
    'If payments have been made, kindly disregard this statement.',
    `For inquiries, please call ${notification.companyContactNumber || '(046) 866 0616'} or email ${notification.companyEmail || 'dcprimegold@gmail.com'}.`,
    '',
    'PAYMENT REMINDERS',
    "Always provide buyer's full name and CIN when making payments.",
    'All check payments should be made payable to the order of D&C PRIME REALTY.',
  ].join('\n');

  const htmlMessage = `
    <div style="margin:0;background:#ffffff;color:#000000;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35">
      <div style="max-width:760px;margin:0 auto;padding:18px 16px 24px;background:#ffffff">
        <div style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start">
          <div style="width:46%;min-width:260px">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${companyName}" style="display:block;width:62px;height:auto;margin-bottom:28px" />` : `<div style="font-size:11px;font-weight:bold;color:#f59e0b;margin-bottom:28px">${companyName}</div>`}
            <div style="white-space:pre-line">Unit D, Mia's Building, Purok 1,\nMataas na Lupa, Indang, Cavite,\n4122 Philippines</div>
          </div>

          <div style="width:39%;min-width:260px">
            <h2 style="margin:16px 0 10px;text-align:center;font-size:16px;line-height:1.1;font-weight:700">STATEMENT OF ACCOUNT</h2>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
              <tr><td style="border:1px solid #000;padding:2px 5px;width:40%">Statement Date</td><td style="border:1px solid #000;padding:2px 5px;text-align:center">As of ${escapeHtml(statementAsOf)}</td></tr>
              <tr><td style="border:1px solid #000;padding:2px 5px">SOA Number</td><td style="border:1px solid #000;padding:2px 5px;text-align:center">SOA-${notification.scheduleId}</td></tr>
              <tr><td style="border:1px solid #000;padding:2px 5px">Project</td><td style="border:1px solid #000;padding:2px 5px;text-align:center">${escapeHtml(notification.projectName)}</td></tr>
              <tr><td style="border:1px solid #000;padding:2px 5px">Unit No.</td><td style="border:1px solid #000;padding:2px 5px;text-align:center">${escapeHtml(notification.unitId)}</td></tr>
            </table>

            <h3 style="margin:14px 0 8px;text-align:center;font-size:15px;font-weight:700">AMOUNT DETAILS</h3>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
              <tr><td style="border:1px solid #000;padding:2px 5px">Total Contract Price</td><td style="border:1px solid #000;padding:2px 5px;text-align:right">${amountOnly(notification.totalContractPrice)}</td></tr>
              <tr><td style="border:1px solid #000;padding:2px 5px">Legal/Miscellaneous</td><td style="border:1px solid #000;padding:2px 5px;text-align:right">${amountOnly(notification.legalMiscFee)}</td></tr>
              <tr><td style="border:1px solid #000;padding:2px 5px;font-weight:700">Total Amount</td><td style="border:1px solid #000;padding:2px 5px;text-align:right;font-weight:700">PHP ${amountOnly(notification.totalContractPrice)}</td></tr>
            </table>
          </div>
        </div>

        <div style="border-top:1px dashed #000;margin:22px 0 20px"></div>

        <table cellpadding="0" cellspacing="0" style="width:82%;margin-left:68px;border-collapse:collapse;font-size:12px">
          <tr>
            <td style="border:2px solid #000;padding:2px 5px;font-weight:700">This is to bill the total amount of</td>
            <td style="border:2px solid #000;padding:2px 5px;text-align:right;font-weight:700;width:160px">${amountOnly(notification.paymentDue)}</td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" style="width:76%;margin-left:72px;margin-top:3px;border-collapse:collapse;font-size:12px">
          <tr><td style="padding:1px 0">${isOverdue ? 'Overdue Amount' : 'Amortization'}</td><td style="padding:1px 0;text-align:right">${isOverdue ? amountOnly(notification.paymentDue) : amountOnly(0)}</td></tr>
          <tr><td style="padding:1px 0">Penalty</td><td style="padding:1px 0;text-align:right">${amountOnly(notification.penaltyAmount)}</td></tr>
          <tr><td style="padding:1px 0">Miscellaneous Fees &amp; Adjustments</td><td style="padding:1px 0;text-align:right">0.00</td></tr>
          <tr><td style="padding:1px 0;font-weight:700">Amount Due Immediately</td><td style="padding:1px 0;text-align:right;font-weight:700">${amountOnly(amountDueImmediately)}</td></tr>
        </table>

        <table cellpadding="0" cellspacing="0" style="width:76%;margin-left:72px;margin-top:16px;border-collapse:collapse;font-size:14px;font-weight:700">
          <tr><td>${escapeHtml(dueLabel)}</td><td style="text-align:right;width:180px">${amountOnly(notification.paymentDue)}</td></tr>
        </table>

        <p style="margin:28px 0 12px 72px;font-size:11px;font-weight:700">NOTE: All transactions after ${escapeHtml(statementAsOf)} are not reflected in this Statement of Account (SOA).</p>

        <div style="border-top:1px dashed #000;margin:0 0 8px"></div>

        <div style="margin-left:72px;font-size:12px">
          <div>&bull;Please pay on or before the due date to avoid penalties.</div>
          <div>&bull;Payments made after the statement date are not yet reflected.</div>
          <div>&bull;If payments have been made, kindly disregard this statement.</div>
          <div>&bull;For inquiries, please call ${companyContactNumber} or email to ${companyEmail}</div>
        </div>

        <div style="margin-top:12px;text-align:center;font-size:12px;font-weight:700">PAYMENT REMINDERS</div>
        <div style="margin:10px 0 20px 72px;font-size:12px">
          <div>&bull;ALWAYS PROVIDE BUYER'S FULL NAME AND CIN WHEN MAKING PAYMENTS.</div>
          <div>&bull;All check payments should be made payable to the order of D&amp;C PRIME REALTY.</div>
        </div>

        <div style="border-top:1px dashed #000;margin:0 0 28px"></div>
        <div style="border-top:3px solid #000"></div>
      </div>
    </div>
  `;

  return { subject, textMessage, htmlMessage };
};

const sendEmail = async ({ to, subject, text, html }) => {
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
          l.lot_project_listing_tcp,
          l.lot_project_listing_lmf_amount,
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

    await ensureNotificationTable(connection);

    const scheduleId = Number(req.params.scheduleId || 0);
    if (!scheduleId) return res.status(400).json({ message: 'Payment schedule id is required.' });

    const row = await getScheduleNotificationRow(connection, scheduleId);
    if (!row) return res.status(404).json({ message: 'Payment schedule not found.' });

    const notification = mapNotificationRow(row);
    if (!notification.buyerEmail) {
      return res.status(400).json({ message: 'Buyer email is missing. Add buyer email before sending notification.' });
    }

    if (!['due_soon', 'overdue'].includes(notification.notificationType)) {
      return res.status(400).json({ message: 'This schedule is not due within 7 days or overdue.' });
    }

    const { subject, textMessage, htmlMessage } = buildNotificationMessage(row);

    try {
      await sendEmail({
        to: notification.buyerEmail,
        subject,
        text: textMessage,
        html: htmlMessage,
      });

      await connection.query(
        `
          INSERT INTO lot_project_notification_logs (
            lot_project_id,
            lot_project_listing_id,
            lot_project_client_profile_id,
            lot_project_payment_schedule_id,
            notification_type,
            recipient_email,
            subject,
            message,
            sent_by_user_id,
            sent_at,
            send_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'sent')
        `,
        [
          row.lot_project_id,
          row.lot_project_listing_id,
          row.lot_project_client_profile_id,
          row.lot_project_payment_schedule_id,
          notification.notificationType,
          notification.buyerEmail,
          subject,
          textMessage,
          user.id,
        ]
      );

      return res.json({
        success: true,
        message: `${notification.statusLabel} email sent to ${notification.buyerEmail}.`,
      });
    } catch (emailError) {
      await connection.query(
        `
          INSERT INTO lot_project_notification_logs (
            lot_project_id,
            lot_project_listing_id,
            lot_project_client_profile_id,
            lot_project_payment_schedule_id,
            notification_type,
            recipient_email,
            subject,
            message,
            sent_by_user_id,
            sent_at,
            send_status,
            error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'failed', ?)
        `,
        [
          row.lot_project_id,
          row.lot_project_listing_id,
          row.lot_project_client_profile_id,
          row.lot_project_payment_schedule_id,
          notification.notificationType,
          notification.buyerEmail,
          subject,
          textMessage,
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
          lot_project_payment_schedule_id,
          notification_type,
          recipient_email,
          subject,
          message,
          sent_by_user_id,
          sent_at,
          send_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'contacted')
      `,
      [
        row.lot_project_id,
        row.lot_project_listing_id,
        row.lot_project_client_profile_id,
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






