import { db } from '../../db/connect.js'

const SELLER_ROLES = ['broker_network_manager', 'broker', 'manager', 'agent']
const SELLER_STATUSES = ['active', 'inactive']

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1)
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '10', 10), 1), 100)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

const paginationPayload = (page, limit, total) => {
  const totalPages = Math.max(Math.ceil(total / limit), 1)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

const fullNameSql = (alias = 'u') =>
  `TRIM(CONCAT_WS(' ', ${alias}.first_name, NULLIF(${alias}.middle_name, ''), ${alias}.last_name))`

const buildAccreditedFilters = (query) => {
  const filters = []
  const params = []

  if (query.search?.trim()) {
    const keyword = `%${query.search.trim()}%`
    filters.push(`(${fullNameSql('u')} LIKE ? OR u.email LIKE ? OR u.contact_no LIKE ? OR u.role LIKE ? OR ${fullNameSql('parent')} LIKE ? OR sg.seller_group_name LIKE ?)`)
    params.push(keyword, keyword, keyword, keyword, keyword, keyword)
  }

  if (query.role && query.role !== 'all') {
    if (!SELLER_ROLES.includes(query.role)) {
      const error = new Error('Invalid role filter.')
      error.statusCode = 400
      throw error
    }
    filters.push('u.role = ?')
    params.push(query.role)
  }

  if (query.status && query.status !== 'all') {
    if (!SELLER_STATUSES.includes(query.status)) {
      const error = new Error('Invalid status filter.')
      error.statusCode = 400
      throw error
    }
    filters.push('a.accredited_seller_status = ?')
    params.push(query.status)
  }

  return {
    whereSql: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    params,
  }
}

const selectAccreditedSql = `
  SELECT
    a.accredited_seller_id,
    a.user_id,
    ${fullNameSql('u')} AS full_name,
    u.email,
    u.contact_no,
    u.role,
    a.seller_group_id,
    sg.seller_group_name,
    sg.seller_group_pool_rate_bailen,
    sg.seller_group_pool_rate_maragondon,
    sg.seller_group_pool_rate_general_trias,
    a.accredited_seller_reports_under_user_id AS reports_under_user_id,
    ${fullNameSql('parent')} AS reports_under_name,
    parent.role AS reports_under_role,
    a.accredited_seller_assigned_rate_bailen,
    a.accredited_seller_assigned_rate_maragondon,
    a.accredited_seller_assigned_rate_general_trias,
    a.accredited_seller_accreditation_date,
    a.accredited_seller_status,
    a.accredited_seller_created_at,
    a.accredited_seller_updated_at
  FROM accredited_sellers a
  INNER JOIN users u ON u.id = a.user_id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
  LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
`

export const getAccreditedSellers = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { whereSql, params } = buildAccreditedFilters(req.query)

    const [[countRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        ${whereSql}
      `,
      params
    )

    const [rows] = await db.query(
      `
        ${selectAccreditedSql}
        ${whereSql}
        ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'), full_name ASC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    const [[summary]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(accredited_seller_status = 'active'), 0) AS active,
        COALESCE(SUM(accredited_seller_status = 'inactive'), 0) AS inactive,
        COALESCE(SUM(u.role = 'broker_network_manager'), 0) AS broker_network_manager,
        COALESCE(SUM(u.role = 'broker'), 0) AS broker,
        COALESCE(SUM(u.role = 'manager'), 0) AS manager,
        COALESCE(SUM(u.role = 'agent'), 0) AS agent
      FROM accredited_sellers a
      INNER JOIN users u ON u.id = a.user_id
    `)

    return res.json({
      status: rows.length ? 'success' : 'warning',
      message: rows.length ? 'Accredited sellers loaded.' : 'No accredited sellers found.',
      data: rows,
      pagination: paginationPayload(page, limit, Number(countRow.total || 0)),
      summary: {
        total: Number(summary.total || 0),
        active: Number(summary.active || 0),
        inactive: Number(summary.inactive || 0),
        roleBreakdown: {
          broker_network_manager: Number(summary.broker_network_manager || 0),
          broker: Number(summary.broker || 0),
          manager: Number(summary.manager || 0),
          agent: Number(summary.agent || 0),
        },
      },
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Failed to load accredited sellers.',
    })
  }
}

export const getParentSellerOptions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT
          a.user_id,
          ${fullNameSql('u')} AS full_name,
          u.role,
          a.seller_group_id
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        WHERE u.status = 'active'
          AND a.accredited_seller_status = 'active'
          AND u.role IN ('broker_network_manager', 'broker', 'manager')
        ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager'), full_name ASC
      `
    )

    return res.json({ status: 'success', message: 'Parent seller options loaded.', data: rows })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to load parent seller options.' })
  }
}
