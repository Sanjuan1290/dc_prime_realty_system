import { db } from '../../db/connect.js';

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Seller group already exists.';
  return error?.message || 'Something went wrong.';
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validatePoolRate = (value, label = 'Pool rate') => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 6 || numberValue > 15) {
    throw new Error(`${label} must be between 6 and 15.`);
  }
  return numberValue;
};

const validateSellerRate = (value, label = 'Seller rate') => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 15) {
    throw new Error(`${label} must be between 0 and 15.`);
  }
  return numberValue;
};

const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

const normalizeStatus = (status) => (status === 'inactive' ? 'inactive' : 'active');

const getActiveLotProjects = async (connection = db) => {
  const [projects] = await connection.query(`
    SELECT
      lot_project_id,
      lot_project_name,
      lot_project_slug,
      lot_project_location_code
    FROM lot_projects
    WHERE lot_project_status = 'active'
    ORDER BY lot_project_name ASC
  `);

  return projects;
};

const normalizeGroupProjectRates = (projectRates = [], projects = []) => {
  const rateMap = new Map(
    Array.isArray(projectRates)
      ? projectRates
          .map((item) => [Number(item.lot_project_id), Number(item.seller_group_pool_rate ?? item.rate ?? 8)])
          .filter(([projectId, rate]) => projectId && !Number.isNaN(rate))
      : []
  );

  return projects.map((project) => ({
    lot_project_id: Number(project.lot_project_id),
    seller_group_pool_rate: validatePoolRate(
      rateMap.has(Number(project.lot_project_id)) ? rateMap.get(Number(project.lot_project_id)) : 8,
      `${project.lot_project_name} pool rate`
    ),
  }));
};


const assertPoolRatesCanCoverMemberRates = async (connection, groupId, projectRates = []) => {
  if (!groupId || !projectRates.length) return;

  for (const projectRate of projectRates) {
    const projectId = Number(projectRate.lot_project_id);
    const poolRate = Number(projectRate.seller_group_pool_rate || 0);
    if (!projectId) continue;

    const [rows] = await connection.query(
      `
        SELECT
          asr.accredited_seller_project_rate AS highest_member_rate,
          lp.lot_project_name,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS seller_name
        FROM accredited_sellers acs
        INNER JOIN accredited_seller_lot_project_rates asr
          ON asr.accredited_seller_id = acs.accredited_seller_id
         AND asr.lot_project_id = ?
         AND asr.accredited_seller_lot_project_rate_status = 'active'
        INNER JOIN users u ON u.id = acs.user_id
        INNER JOIN lot_projects lp ON lp.lot_project_id = asr.lot_project_id
        WHERE acs.seller_group_id = ?
          AND acs.accredited_seller_status = 'active'
        ORDER BY asr.accredited_seller_project_rate DESC, seller_name ASC
        LIMIT 1
      `,
      [projectId, groupId]
    );

    const highest = rows[0];
    const highestRate = Number(highest?.highest_member_rate || 0);
    if (highestRate > poolRate) {
      throw createValidationError(`${highest.lot_project_name} pool rate cannot be ${poolRate}%. Highest assigned member rate is ${highestRate}% for ${highest.seller_name}. Lower member rates first or set the pool rate to at least ${highestRate}%.`);
    }
  }
};

const assertSellerRatesWithinGroupPool = async (connection, groupId, sellerName, projectRates = []) => {
  if (!groupId || !projectRates.length) return;

  for (const item of projectRates) {
    const projectId = Number(item.lot_project_id);
    const sellerRate = Number(item.accredited_seller_project_rate ?? item.rate ?? 0);
    if (!projectId) continue;

    const [rows] = await connection.query(
      `
        SELECT
          lp.lot_project_name,
          COALESCE(sgr.seller_group_pool_rate, 0) AS seller_group_pool_rate
        FROM lot_projects lp
        LEFT JOIN seller_group_lot_project_rates sgr
          ON sgr.lot_project_id = lp.lot_project_id
         AND sgr.seller_group_id = ?
         AND sgr.seller_group_lot_project_rate_status = 'active'
        WHERE lp.lot_project_id = ?
        LIMIT 1
      `,
      [groupId, projectId]
    );

    const project = rows[0];
    const poolRate = Number(project?.seller_group_pool_rate || 0);
    if (poolRate && sellerRate > poolRate) {
      throw createValidationError(`${sellerName || 'Seller'} rate for ${project.lot_project_name} cannot be ${sellerRate}% because the group pool rate is only ${poolRate}%. Raise the group pool rate first or lower this member rate.`);
    }
  }
};

const upsertGroupProjectRates = async (connection, groupId, projectRates) => {
  if (!projectRates.length) return;

  await connection.query(
    `
      INSERT INTO seller_group_lot_project_rates (
        seller_group_id,
        lot_project_id,
        seller_group_pool_rate,
        seller_group_lot_project_rate_status
      ) VALUES ${projectRates.map(() => '(?, ?, ?, "active")').join(', ')}
      ON DUPLICATE KEY UPDATE
        seller_group_pool_rate = VALUES(seller_group_pool_rate),
        seller_group_lot_project_rate_status = 'active'
    `,
    projectRates.flatMap((rate) => [
      groupId,
      rate.lot_project_id,
      rate.seller_group_pool_rate,
    ])
  );
};

const hydrateGroupRates = async (groups) => {
  const groupIds = groups.map((group) => group.seller_group_id).filter(Boolean);
  if (!groupIds.length) return groups.map((group) => ({ ...group, project_rates: [] }));

  const placeholders = groupIds.map(() => '?').join(', ');
  const [rateRows] = await db.query(
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
      WHERE sgr.seller_group_id IN (${placeholders})
      ORDER BY lp.lot_project_name ASC
    `,
    groupIds
  );

  const rateMap = new Map();
  rateRows.forEach((rate) => {
    if (!rateMap.has(rate.seller_group_id)) rateMap.set(rate.seller_group_id, []);
    rateMap.get(rate.seller_group_id).push(rate);
  });

  return groups.map((group) => ({
    ...group,
    project_rates: rateMap.get(group.seller_group_id) || [],
  }));
};

const hydrateMemberRates = async (members) => {
  const sellerIds = members.map((member) => member.accredited_seller_id).filter(Boolean);
  if (!sellerIds.length) return members.map((member) => ({ ...member, project_rates: [] }));

  const placeholders = sellerIds.map(() => '?').join(', ');
  const [rateRows] = await db.query(
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

  const rateMap = new Map();
  rateRows.forEach((rate) => {
    if (!rateMap.has(rate.accredited_seller_id)) rateMap.set(rate.accredited_seller_id, []);
    rateMap.get(rate.accredited_seller_id).push(rate);
  });

  return members.map((member) => ({
    ...member,
    project_rates: rateMap.get(member.accredited_seller_id) || [],
  }));
};

export const createGroup = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status = 'active',
      project_rates = [],
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO seller_groups (
          seller_group_name,
          seller_group_head_user_id,
          seller_group_description,
          seller_group_status
        ) VALUES (?, ?, ?, ?)
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        normalizeStatus(seller_group_status),
      ]
    );

    const groupId = result.insertId;
    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects);
    await assertPoolRatesCanCoverMemberRates(connection, groupId, normalizedRates);
    await upsertGroupProjectRates(connection, groupId, normalizedRates);

    await connection.commit();

    return res.status(201).json({
      message: 'Seller group created successfully.',
      seller_group_id: groupId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
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

    const hydratedRows = await hydrateGroupRates(
      rows.map((row) => ({
        ...row,
        member_count: Number(row.member_count || 0),
        active_member_count: Number(row.active_member_count || 0),
      }))
    );

    const [metaRows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM seller_groups WHERE seller_group_status = 'active') AS active,
        (SELECT COUNT(*) FROM seller_groups WHERE seller_group_status = 'inactive') AS inactive,
        COALESCE((SELECT COUNT(*) FROM accredited_sellers), 0) AS totalMembers,
        COALESCE((SELECT AVG(seller_group_pool_rate) FROM seller_group_lot_project_rates WHERE seller_group_lot_project_rate_status = 'active'), 0) AS averagePool
    `);

    return res.json({
      data: hydratedRows,
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
        averagePool: Number(metaRows[0]?.averagePool || 0),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
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
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const editGroup = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status,
      project_rates = [],
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE seller_groups
        SET
          seller_group_name = ?,
          seller_group_head_user_id = ?,
          seller_group_description = ?,
          seller_group_status = ?
        WHERE seller_group_id = ?
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        normalizeStatus(seller_group_status),
        groupId,
      ]
    );

    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects);
    await assertPoolRatesCanCoverMemberRates(connection, groupId, normalizedRates);
    await upsertGroupProjectRates(connection, groupId, normalizedRates);

    await connection.commit();

    return res.json({ message: 'Seller group updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
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

    const nextStatus = normalizeStatus(req.body.status || (group.seller_group_status === 'active' ? 'inactive' : 'active'));

    await db.query(
      `UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`,
      [nextStatus, groupId]
    );

    return res.json({ message: `Seller group is now ${nextStatus}.`, status: nextStatus });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
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
          a.accredited_seller_status
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        WHERE a.seller_group_id = ?
        ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'), full_name ASC
      `,
      [groupId]
    );

    const [hydratedGroup] = await hydrateGroupRates([
      {
        ...group,
        member_count: Number(group.member_count || 0),
        active_member_count: Number(group.active_member_count || 0),
      },
    ]);

    const hydratedMembers = await hydrateMemberRates(members);

    return res.json({
      data: {
        group: hydratedGroup,
        members: hydratedMembers,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const editUserRate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.groupId);
    const accreditedSellerId = Number(req.params.accreditedSellerId);
    const projectRates = Array.isArray(req.body.project_rates) ? req.body.project_rates : [];

    if (!groupId || !accreditedSellerId) {
      return res.status(400).json({ message: 'Invalid group or seller id.' });
    }

    if (!projectRates.length) {
      return res.status(400).json({ message: 'No project rates provided.' });
    }

    await connection.beginTransaction();

    const [sellerRows] = await connection.query(
      `
        SELECT TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS seller_name
        FROM accredited_sellers acs
        INNER JOIN users u ON u.id = acs.user_id
        WHERE acs.accredited_seller_id = ?
          AND acs.seller_group_id = ?
        LIMIT 1
      `,
      [accreditedSellerId, groupId]
    );

    if (!sellerRows.length) {
      throw createValidationError('Seller does not belong to this group.');
    }

    await assertSellerRatesWithinGroupPool(connection, groupId, sellerRows[0]?.seller_name, projectRates);

    for (const item of projectRates) {
      const projectId = Number(item.lot_project_id);
      if (!projectId) continue;

      const rate = validateSellerRate(
        item.accredited_seller_project_rate ?? item.rate,
        item.lot_project_name ? `${item.lot_project_name} seller rate` : 'Seller rate'
      );

      await connection.query(
        `
          INSERT INTO accredited_seller_lot_project_rates (
            accredited_seller_id,
            lot_project_id,
            accredited_seller_project_rate,
            accredited_seller_lot_project_rate_status
          ) VALUES (?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            accredited_seller_project_rate = VALUES(accredited_seller_project_rate),
            accredited_seller_lot_project_rate_status = 'active'
        `,
        [accreditedSellerId, projectId, rate]
      );
    }

    await connection.commit();

    return res.json({ message: 'Seller project rates updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

