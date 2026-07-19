import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getUserFullName,
} from '../_shared/lotProject.shared.js';

const toNumber = (value) => Number(value || 0);
const dateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};
const dateTimeText = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
const isDateOnly = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const titleCase = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getLotProjectPaymentLogs = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const action = String(req.query.action || 'all').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const requiredTables = ['lot_project_payment_logs', 'lot_project_payments', 'lot_project_listings'];
    for (const tableName of requiredTables) {
      if (!(await tableExists(connection, tableName))) {
        return res.status(500).json({ success: false, message: `${tableName} table does not exist.` });
      }
    }

    const where = ['p.lot_project_id = ?'];
    const params = [project.lot_project_id];

    if (action !== 'all') {
      where.push('pl.action_type = ?');
      params.push(action);
    }

    if (dateFrom && isDateOnly(dateFrom)) {
      where.push('pl.action_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo && isDateOnly(dateTo)) {
      where.push('pl.action_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(`${dateTo} 00:00:00`);
    }

    if (search) {
      where.push(`(
        l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR p.lot_project_payment_reference_id LIKE ?
        OR pl.action_description LIKE ?
        OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    const [rows] = await connection.query(
      `
        SELECT
          pl.lot_project_payment_log_id,
          pl.action_type,
          pl.action_description,
          pl.action_at,
          p.lot_project_payment_id,
          p.lot_project_payment_type,
          p.lot_project_payment_method,
          p.lot_project_payment_amount,
          p.lot_project_payment_date,
          p.lot_project_payment_reference_id,
          p.lot_project_payment_status,
          l.lot_project_listing_unit_id,
          cp.buyer_full_name,
          lp.lot_project_name,
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email
        FROM lot_project_payment_logs pl
        INNER JOIN lot_project_payments p
          ON p.lot_project_payment_id = pl.lot_project_payment_id
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = p.lot_project_listing_id
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = p.lot_project_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = p.lot_project_client_profile_id
        LEFT JOIN users u
          ON u.id = pl.action_by_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY pl.action_at DESC, pl.lot_project_payment_log_id DESC
        LIMIT 300
      `,
      params
    );

    const logs = rows.map((row) => ({
      id: row.lot_project_payment_log_id,
      paymentId: row.lot_project_payment_id,
      action: row.action_type,
      actionLabel: titleCase(row.action_type),
      actionDescription: row.action_description || '-',
      actionAt: row.action_at,
      actionAtText: dateTimeText(row.action_at),
      project: row.lot_project_name || project.lot_project_name,
      unit: row.lot_project_listing_unit_id || '-',
      buyer: row.buyer_full_name || 'No buyer name',
      amount: toNumber(row.lot_project_payment_amount),
      paymentType: titleCase(row.lot_project_payment_type),
      paymentMethod: row.lot_project_payment_method || '-',
      paymentDate: dateOnly(row.lot_project_payment_date),
      referenceId: row.lot_project_payment_reference_id || '-',
      paymentStatus: row.lot_project_payment_status || '-',
      encodedBy: getUserFullName(row),
    }));

    const stats = logs.reduce(
      (summary, item) => {
        summary.total += 1;
        summary.amount += toNumber(item.amount);
        summary[item.action] = (summary[item.action] || 0) + 1;
        return summary;
      },
      { total: 0, amount: 0 }
    );

    return res.json({
      success: true,
      data: logs,
      stats,
      project: {
        ...project,
        id: project.lot_project_id,
        name: project.lot_project_name,
        slug: project.lot_project_slug,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

