import { db } from '../../db/connect.js';

const memberRateFields = [
  'accredited_seller_assigned_rate_bailen',
  'accredited_seller_assigned_rate_maragondon',
  'accredited_seller_assigned_rate_general_trias',
];

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => error?.message || 'Something went wrong.';

const validateRate = (value, label) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 6 || numberValue > 15) {
    throw new Error(`${label} must be between 6 and 15.`);
  }
  return numberValue;
};

const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

export const createGroup = async (req, res) => {
  try {
    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_pool_rate_bailen = 8,
      seller_group_pool_rate_maragondon = 8,
      seller_group_pool_rate_general_trias = 8,
      seller_group_status = 'active',
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    const bailen = validateRate(seller_group_pool_rate_bailen, 'Bailen pool rate');
    const maragondon = validateRate(seller_group_pool_rate_maragondon, 'Maragondon pool rate');
    const gentri = validateRate(seller_group_pool_rate_general_trias, 'General Trias pool rate');

    const [result] = await db.query(
      `
        INSERT INTO seller_groups (
          seller_group_name,
          seller_group_head_user_id,
          seller_group_description,
          seller_group_pool_rate_bailen,
          seller_group_pool_rate_maragondon,
          seller_group_pool_rate_general_trias,
          seller_group_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        bailen,
        maragondon,
        gentri,
        seller_group_status,
      ]
    );

    return res.status(201).json({
      message: 'Seller group created successfully.',
      seller_group_id: result.insertId,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getGroups = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all');

    const where = [];
    const params = [];

    if (search) {
      where.push(`(
        sg.seller_group_name LIKE ? OR
        IFNULL(sg.seller_group_description, '') LIKE ? OR
        ${fullNameSql('head_user')} LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (status !== 'all') {
      where.push('sg.seller_group_status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [rows] = await db.query(
      `
        SELECT
          sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          COUNT(a.accredited_seller_id) AS member_count,
          SUM(a.accredited_seller_status = 'active') AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
        ${whereSql}
        GROUP BY sg.seller_group_id, head_user.id
        ORDER BY sg.seller_group_created_at DESC, sg.seller_group_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [metaRows] = await db.query(`
      SELECT
        SUM(seller_group_status = 'active') AS active,
        SUM(seller_group_status = 'inactive') AS inactive,
        COALESCE((SELECT COUNT(*) FROM accredited_sellers), 0) AS totalMembers,
        COALESCE(AVG(seller_group_pool_rate_bailen), 0) AS averageBailenPool
      FROM seller_groups
    `);

    return res.json({
      data: rows.map((row) => ({
        ...row,
        member_count: Number(row.member_count || 0),
        active_member_count: Number(row.active_member_count || 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        active: Number(metaRows[0]?.active || 0),
        inactive: Number(metaRows[0]?.inactive || 0),
        totalMembers: Number(metaRows[0]?.totalMembers || 0),
        averageBailenPool: Number(metaRows[0]?.averageBailenPool || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getGroupOptions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT seller_group_id, seller_group_name
      FROM seller_groups
      WHERE seller_group_status = 'active'
      ORDER BY seller_group_name ASC
    `);

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const editGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_pool_rate_bailen,
      seller_group_pool_rate_maragondon,
      seller_group_pool_rate_general_trias,
      seller_group_status,
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    const bailen = validateRate(seller_group_pool_rate_bailen, 'Bailen pool rate');
    const maragondon = validateRate(seller_group_pool_rate_maragondon, 'Maragondon pool rate');
    const gentri = validateRate(seller_group_pool_rate_general_trias, 'General Trias pool rate');

    await db.query(
      `
        UPDATE seller_groups
        SET
          seller_group_name = ?,
          seller_group_head_user_id = ?,
          seller_group_description = ?,
          seller_group_pool_rate_bailen = ?,
          seller_group_pool_rate_maragondon = ?,
          seller_group_pool_rate_general_trias = ?,
          seller_group_status = ?
        WHERE seller_group_id = ?
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        bailen,
        maragondon,
        gentri,
        seller_group_status || 'active',
        groupId,
      ]
    );

    return res.json({ message: 'Seller group updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const toggleGroupStatus = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const [rows] = await db.query(
      `SELECT seller_group_status FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );

    const group = rows[0];
    if (!group) return res.status(404).json({ message: 'Seller group not found.' });

    const nextStatus = req.body.status || (group.seller_group_status === 'active' ? 'inactive' : 'active');

    await db.query(
      `UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`,
      [nextStatus, groupId]
    );

    return res.json({ message: `Seller group is now ${nextStatus}.`, status: nextStatus });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const viewGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const [groupRows] = await db.query(
      `
        SELECT
          sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          COUNT(a.accredited_seller_id) AS member_count,
          SUM(a.accredited_seller_status = 'active') AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
        WHERE sg.seller_group_id = ?
        GROUP BY sg.seller_group_id, head_user.id
        LIMIT 1
      `,
      [groupId]
    );

    const group = groupRows[0];
    if (!group) return res.status(404).json({ message: 'Seller group not found.' });

    const [members] = await db.query(
      `
        SELECT
          a.accredited_seller_id,
          a.user_id,
          ${fullNameSql('u')} AS full_name,
          u.email,
          u.role,
          a.accredited_seller_reports_under_user_id AS reports_under_user_id,
          ${fullNameSql('parent')} AS reports_under_name,
          a.accredited_seller_assigned_rate_bailen,
          a.accredited_seller_assigned_rate_maragondon,
          a.accredited_seller_assigned_rate_general_trias,
          a.accredited_seller_status
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        WHERE a.seller_group_id = ?
        ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'), full_name ASC
      `,
      [groupId]
    );

    return res.json({
      data: {
        group: {
          ...group,
          member_count: Number(group.member_count || 0),
          active_member_count: Number(group.active_member_count || 0),
        },
        members,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const editUserRate = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const accreditedSellerId = Number(req.params.accreditedSellerId);

    if (!groupId || !accreditedSellerId) {
      return res.status(400).json({ message: 'Invalid group or seller id.' });
    }

    const updates = {};

    for (const field of memberRateFields) {
      if (req.body[field] !== undefined) updates[field] = Number(req.body[field]);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No rate fields provided.' });
    }

    const setSql = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    await db.query(
      `
        UPDATE accredited_sellers
        SET ${setSql}
        WHERE accredited_seller_id = ? AND seller_group_id = ?
      `,
      [...values, accreditedSellerId, groupId]
    );

    return res.json({ message: 'Seller rate updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
