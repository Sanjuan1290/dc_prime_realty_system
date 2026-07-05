import { db } from '../../db/connect.js';

const getErrorMessage = (error) => error?.message || 'Something went wrong.';
const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

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

    const hydratedRows = await hydrateSellerRates(rows);

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
