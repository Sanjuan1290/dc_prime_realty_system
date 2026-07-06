import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getAuthenticatedUser,
  getUserFullName,
} from '../_shared/lotProject.shared.js';

const toNumber = (value) => Number(value || 0);
const titleCase = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const roleLabel = (value = '') => {
  const labels = {
    broker_network_manager: 'Broker Network Manager',
    broker: 'Broker',
    manager: 'Manager',
    agent: 'Agent',
  };
  return labels[value] || titleCase(value);
};

const sellerTypeLabel = (value = '') => {
  const labels = {
    main_seller: 'Main Seller',
    hierarchy_seller: 'Hierarchy Seller',
    selling_agent: 'Selling Agent',
  };
  return labels[value] || titleCase(value);
};

const hierarchyLabel = (value = '') => {
  const labels = {
    broker_network_manager: 'BNM',
    broker: 'Broker',
    manager: 'Manager',
    agent: 'Agent',
  };
  return labels[value] || roleLabel(value);
};

const mapCommissionRow = (row = {}) => {
  const gross = toNumber(row.gross_commission_amount);
  const released = toNumber(row.released_commission_amount);
  const remaining = row.net_remaining_commission_amount == null
    ? Math.max(gross - released, 0)
    : toNumber(row.net_remaining_commission_amount);

  return {
    id: row.lot_project_commission_id,
    commissionId: row.lot_project_commission_id,
    client: row.buyer_full_name || 'No buyer name',
    unit: row.lot_project_listing_unit_id || '-',
    project: row.lot_project_name || '-',
    seller: row.seller_name || getUserFullName(row),
    sellerEmail: row.seller_email || '',
    sellerGroup: row.seller_group_name || '-',
    role: roleLabel(row.commission_role),
    rawRole: row.commission_role,
    sellerType: sellerTypeLabel(row.commission_seller_type),
    saleType: titleCase(row.commission_sale_type),
    hierarchyLevel: hierarchyLabel(row.commission_role),
    commissionBase: toNumber(row.commission_base_amount),
    rate: toNumber(row.commission_rate),
    grossCommission: gross,
    released,
    cashAdvanceDeduction: 0,
    netRemaining: Math.max(remaining, 0),
    tcp: toNumber(row.lot_project_listing_tcp),
    paid: toNumber(row.total_paid),
    paymentPercent: toNumber(row.payment_percent),
    status: row.commission_status || 'Pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getLotProjectCommissions = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all').trim();
    const saleType = String(req.query.saleType || 'all').trim().toLowerCase();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_commissions'))) {
      return res.status(500).json({ success: false, message: 'lot_project_commissions table does not exist.' });
    }

    const where = ['c.lot_project_id = ?'];
    const params = [project.lot_project_id];

    if (status !== 'all') {
      where.push('c.commission_status = ?');
      params.push(status);
    }

    if (saleType !== 'all') {
      where.push('c.commission_sale_type = ?');
      params.push(saleType === 'direct' ? 'direct' : 'distributed');
    }

    if (search) {
      where.push(`(
        l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ?
        OR u.email LIKE ?
        OR sg.seller_group_name LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    const [rows] = await connection.query(
      `
        SELECT
          c.*,
          lp.lot_project_name,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_tcp,
          cp.buyer_full_name,
          COALESCE(payment_summary.total_paid, 0) AS total_paid,
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email AS seller_email,
          NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), '') AS seller_name,
          sg.seller_group_name
        FROM lot_project_commissions c
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = c.lot_project_listing_id
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = c.lot_project_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
        LEFT JOIN accredited_sellers acs
          ON acs.accredited_seller_id = c.accredited_seller_id
        LEFT JOIN users u
          ON u.id = acs.user_id
        LEFT JOIN seller_groups sg
          ON sg.seller_group_id = acs.seller_group_id
        LEFT JOIN (
          SELECT
            lot_project_listing_id,
            SUM(lot_project_payment_amount) AS total_paid
          FROM lot_project_payments
          WHERE lot_project_payment_status = 'Verified'
          GROUP BY lot_project_listing_id
        ) payment_summary ON payment_summary.lot_project_listing_id = c.lot_project_listing_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.lot_project_listing_unit_id ASC, FIELD(c.commission_role, 'broker_network_manager', 'broker', 'manager', 'agent'), c.lot_project_commission_id ASC
      `,
      params
    );

    const records = rows.map(mapCommissionRow);
    const stats = records.reduce(
      (summary, item) => {
        summary.total += 1;
        summary.gross += toNumber(item.grossCommission);
        summary.released += toNumber(item.released);
        summary.remaining += toNumber(item.netRemaining);
        if (!summary.byStatus[item.status]) summary.byStatus[item.status] = 0;
        summary.byStatus[item.status] += 1;
        return summary;
      },
      { total: 0, gross: 0, released: 0, remaining: 0, byStatus: {} }
    );

    return res.json({
      success: true,
      data: records,
      stats,
      project: {
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

export const updateLotProjectCommission = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const commissionId = Number(req.params.commissionId || 0);
    const action = String(req.body.action || '').trim().toLowerCase();
    const amount = toNumber(req.body.amount);
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!commissionId) {
      return res.status(400).json({ success: false, message: 'Commission id is required.' });
    }

    const currentUser = await getAuthenticatedUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Please login before updating commission.' });
    }

    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, message: 'Admin access is required to update commission.' });
    }

    const [rows] = await connection.query(
      `
        SELECT *
        FROM lot_project_commissions
        WHERE lot_project_id = ?
          AND lot_project_commission_id = ?
        LIMIT 1
      `,
      [project.lot_project_id, commissionId]
    );

    const commission = rows[0];
    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission record not found.' });
    }

    const gross = toNumber(commission.gross_commission_amount);
    const currentReleased = toNumber(commission.released_commission_amount);
    let nextReleased = currentReleased;
    let nextStatus = commission.commission_status;
    let message = 'Commission updated successfully.';

    if (action === 'release') {
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: 'Release amount must be greater than zero.' });
      }

      const remaining = Math.max(gross - currentReleased, 0);
      if (amount > remaining) {
        return res.status(400).json({ success: false, message: 'Release amount cannot be greater than the net remaining commission.' });
      }

      nextReleased = Math.min(currentReleased + amount, gross);
      nextStatus = nextReleased >= gross ? 'Released' : 'Partially Released';
      message = 'Commission release saved successfully.';
    } else if (action === 'hold') {
      nextStatus = 'On Hold';
      message = 'Commission placed on hold.';
    } else if (action === 'unhold') {
      nextStatus = toNumber(commission.payment_percent) > 0 ? 'Eligible' : 'Pending';
      message = 'Commission hold removed.';
    } else if (action === 'cancel') {
      nextStatus = 'Cancelled';
      message = 'Commission cancelled.';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid commission action.' });
    }

    const nextRemaining = Math.max(gross - nextReleased, 0);

    await connection.query(
      `
        UPDATE lot_project_commissions
        SET
          released_commission_amount = ?,
          net_remaining_commission_amount = ?,
          commission_status = ?
        WHERE lot_project_commission_id = ?
          AND lot_project_id = ?
      `,
      [nextReleased, nextRemaining, nextStatus, commissionId, project.lot_project_id]
    );

    return res.json({
      success: true,
      message,
      data: {
        id: commissionId,
        commissionId,
        released: nextReleased,
        netRemaining: nextRemaining,
        status: nextStatus,
        released_commission_amount: nextReleased,
        net_remaining_commission_amount: nextRemaining,
        commission_status: nextStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
