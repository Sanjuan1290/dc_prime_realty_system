import { db } from '../../db/connect.js'

const GROUP_STATUSES = ['active', 'inactive']
const PROJECTS = [
  {
    key: 'bailen',
    label: 'Bailen',
    poolColumn: 'seller_group_pool_rate_bailen',
    rateColumn: 'accredited_seller_assigned_rate_bailen',
  },
  {
    key: 'maragondon',
    label: 'Maragondon',
    poolColumn: 'seller_group_pool_rate_maragondon',
    rateColumn: 'accredited_seller_assigned_rate_maragondon',
  },
  {
    key: 'general_trias',
    label: 'General Trias',
    poolColumn: 'seller_group_pool_rate_general_trias',
    rateColumn: 'accredited_seller_assigned_rate_general_trias',
  },
]

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

const normalizeNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null
  return Number(value)
}

const validatePoolRate = (value, label) => {
  const numberValue = Number(value)
  if (Number.isNaN(numberValue) || numberValue < 6 || numberValue > 15) {
    return `${label} must be from 6% to 15%.`
  }
  return null
}

const validateGroupPayload = ({
  seller_group_name,
  seller_group_pool_rate_bailen,
  seller_group_pool_rate_maragondon,
  seller_group_pool_rate_general_trias,
  seller_group_status,
}) => {
  if (!seller_group_name?.trim()) return 'Seller group name is required.'
  if (!GROUP_STATUSES.includes(seller_group_status)) return 'Invalid seller group status.'

  return (
    validatePoolRate(seller_group_pool_rate_bailen, 'Bailen pool rate') ||
    validatePoolRate(seller_group_pool_rate_maragondon, 'Maragondon pool rate') ||
    validatePoolRate(seller_group_pool_rate_general_trias, 'General Trias pool rate')
  )
}

const selectGroupsSql = `
  SELECT
    sg.seller_group_id,
    sg.seller_group_name,
    sg.seller_group_head_user_id,
    ${fullNameSql('head')} AS group_head_name,
    sg.seller_group_description,
    sg.seller_group_pool_rate_bailen,
    sg.seller_group_pool_rate_maragondon,
    sg.seller_group_pool_rate_general_trias,
    COUNT(a.accredited_seller_id) AS member_count,
    COALESCE(SUM(a.accredited_seller_status = 'active'), 0) AS active_member_count,
    sg.seller_group_status,
    sg.seller_group_created_at,
    sg.seller_group_updated_at
  FROM seller_groups sg
  LEFT JOIN users head ON head.id = sg.seller_group_head_user_id
  LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
`

const buildGroupFilters = (query) => {
  const filters = []
  const params = []

  if (query.search?.trim()) {
    const keyword = `%${query.search.trim()}%`
    filters.push(`(sg.seller_group_name LIKE ? OR sg.seller_group_description LIKE ? OR ${fullNameSql('head')} LIKE ?)`)
    params.push(keyword, keyword, keyword)
  }

  if (query.status && query.status !== 'all') {
    if (!GROUP_STATUSES.includes(query.status)) {
      const error = new Error('Invalid seller group status filter.')
      error.statusCode = 400
      throw error
    }
    filters.push('sg.seller_group_status = ?')
    params.push(query.status)
  }

  return {
    whereSql: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    params,
  }
}

const getRateChain = (members, currentMember, rateColumn, overrideRate) => {
  const chain = []
  const visited = new Set()
  let current = {
    ...currentMember,
    [rateColumn]: overrideRate ?? Number(currentMember[rateColumn] || 0),
  }

  while (current) {
    if (visited.has(current.user_id)) break
    visited.add(current.user_id)
    chain.push(current)

    if (!current.accredited_seller_reports_under_user_id) break
    current = members.find((member) => member.user_id === current.accredited_seller_reports_under_user_id)
  }

  return chain
}

const validateRateChain = async ({ sellerGroupId, accreditedSellerId, rates }) => {
  const [[group]] = await db.query(
    `SELECT * FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
    [sellerGroupId]
  )

  if (!group) return { valid: false, message: 'Seller group not found.' }

  const [members] = await db.query(
    `
      SELECT
        a.accredited_seller_id,
        a.user_id,
        a.accredited_seller_reports_under_user_id,
        a.accredited_seller_assigned_rate_bailen,
        a.accredited_seller_assigned_rate_maragondon,
        a.accredited_seller_assigned_rate_general_trias,
        ${fullNameSql('u')} AS full_name
      FROM accredited_sellers a
      INNER JOIN users u ON u.id = a.user_id
      WHERE a.seller_group_id = ?
    `,
    [sellerGroupId]
  )

  const currentMember = members.find((member) => member.accredited_seller_id === accreditedSellerId)
  if (!currentMember) return { valid: false, message: 'Member not found in this seller group.' }

  for (const project of PROJECTS) {
    const rate = Number(rates[project.rateColumn] ?? currentMember[project.rateColumn] ?? 0)
    const pool = Number(group[project.poolColumn] || 0)

    if (Number.isNaN(rate) || rate < 0) {
      return { valid: false, message: `${project.label} rate must be a valid positive number.` }
    }

    if (rate > pool) {
      return {
        valid: false,
        message: `${currentMember.full_name}'s ${project.label} rate is ${rate}%, but ${project.label} pool is only ${pool}%.`,
      }
    }

    const chain = getRateChain(members, currentMember, project.rateColumn, rate)
    const total = chain.reduce((sum, member) => sum + Number(member[project.rateColumn] || 0), 0)

    if (total > pool) {
      const chainText = chain
        .map((member) => `${member.full_name} (${Number(member[project.rateColumn] || 0)}%)`)
        .join(' + ')

      return {
        valid: false,
        message: `${project.label} rate exceeds group pool. ${chainText} = ${total}%. ${project.label} pool rate is ${pool}%.`,
      }
    }
  }

  return { valid: true }
}

export const getSellerGroups = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { whereSql, params } = buildGroupFilters(req.query)

    const [[countRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM seller_groups sg
        LEFT JOIN users head ON head.id = sg.seller_group_head_user_id
        ${whereSql}
      `,
      params
    )

    const [rows] = await db.query(
      `
        ${selectGroupsSql}
        ${whereSql}
        GROUP BY sg.seller_group_id
        ORDER BY sg.seller_group_created_at DESC, sg.seller_group_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    const [[meta]] = await db.query(`
      SELECT
        COALESCE(SUM(seller_group_status = 'active'), 0) AS active,
        COALESCE(SUM(seller_group_status = 'inactive'), 0) AS inactive,
        (SELECT COUNT(*) FROM accredited_sellers) AS totalMembers,
        COALESCE(AVG(seller_group_pool_rate_bailen), 0) AS averageBailenPool
      FROM seller_groups
    `)

    return res.json({
      status: rows.length ? 'success' : 'warning',
      message: rows.length ? 'Seller groups loaded.' : 'No seller groups found.',
      data: rows,
      pagination: paginationPayload(page, limit, Number(countRow.total || 0)),
      meta: {
        active: Number(meta.active || 0),
        inactive: Number(meta.inactive || 0),
        totalMembers: Number(meta.totalMembers || 0),
        averageBailenPool: Number(meta.averageBailenPool || 0),
      },
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Failed to load seller groups.',
    })
  }
}

export const getSellerGroupDetails = async (req, res) => {
  try {
    const sellerGroupId = Number(req.params.id)

    const [[group]] = await db.query(
      `
        ${selectGroupsSql}
        WHERE sg.seller_group_id = ?
        GROUP BY sg.seller_group_id
        LIMIT 1
      `,
      [sellerGroupId]
    )

    if (!group) {
      return res.status(404).json({ status: 'error', message: 'Seller group not found.' })
    }

    const [members] = await db.query(
      `
        SELECT
          a.accredited_seller_id,
          a.user_id,
          ${fullNameSql('u')} AS full_name,
          u.email,
          u.role,
          a.accredited_seller_reports_under_user_id,
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
      [sellerGroupId]
    )

    return res.json({
      status: members.length ? 'success' : 'warning',
      message: members.length ? 'Seller group details loaded.' : 'Seller group has no members yet.',
      data: { group, members },
    })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to load seller group details.' })
  }
}

export const createSellerGroup = async (req, res) => {
  try {
    const payload = {
      seller_group_name: req.body.seller_group_name,
      seller_group_head_user_id: normalizeNullableNumber(req.body.seller_group_head_user_id),
      seller_group_description: req.body.seller_group_description || null,
      seller_group_pool_rate_bailen: Number(req.body.seller_group_pool_rate_bailen),
      seller_group_pool_rate_maragondon: Number(req.body.seller_group_pool_rate_maragondon),
      seller_group_pool_rate_general_trias: Number(req.body.seller_group_pool_rate_general_trias),
      seller_group_status: req.body.seller_group_status || 'active',
    }

    const validationMessage = validateGroupPayload(payload)
    if (validationMessage) return res.status(400).json({ status: 'error', message: validationMessage })

    const [result] = await db.query(
      `
        INSERT INTO seller_groups
          (seller_group_name, seller_group_head_user_id, seller_group_description, seller_group_pool_rate_bailen, seller_group_pool_rate_maragondon, seller_group_pool_rate_general_trias, seller_group_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.seller_group_name.trim(),
        payload.seller_group_head_user_id,
        payload.seller_group_description,
        payload.seller_group_pool_rate_bailen,
        payload.seller_group_pool_rate_maragondon,
        payload.seller_group_pool_rate_general_trias,
        payload.seller_group_status,
      ]
    )

    return res.status(201).json({
      status: 'success',
      message: 'Seller group created successfully.',
      data: { seller_group_id: result.insertId },
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Seller group name already exists.' })
    }

    return res.status(500).json({ status: 'error', message: error.message || 'Failed to create seller group.' })
  }
}

export const updateSellerGroup = async (req, res) => {
  try {
    const sellerGroupId = Number(req.params.id)
    const payload = {
      seller_group_name: req.body.seller_group_name,
      seller_group_head_user_id: normalizeNullableNumber(req.body.seller_group_head_user_id),
      seller_group_description: req.body.seller_group_description || null,
      seller_group_pool_rate_bailen: Number(req.body.seller_group_pool_rate_bailen),
      seller_group_pool_rate_maragondon: Number(req.body.seller_group_pool_rate_maragondon),
      seller_group_pool_rate_general_trias: Number(req.body.seller_group_pool_rate_general_trias),
      seller_group_status: req.body.seller_group_status || 'active',
    }

    const validationMessage = validateGroupPayload(payload)
    if (validationMessage) return res.status(400).json({ status: 'error', message: validationMessage })

    const [result] = await db.query(
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
        payload.seller_group_name.trim(),
        payload.seller_group_head_user_id,
        payload.seller_group_description,
        payload.seller_group_pool_rate_bailen,
        payload.seller_group_pool_rate_maragondon,
        payload.seller_group_pool_rate_general_trias,
        payload.seller_group_status,
        sellerGroupId,
      ]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Seller group not found.' })
    }

    return res.json({ status: 'success', message: 'Seller group updated successfully.' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Seller group name already exists.' })
    }

    return res.status(500).json({ status: 'error', message: error.message || 'Failed to update seller group.' })
  }
}

export const updateSellerGroupStatus = async (req, res) => {
  try {
    const sellerGroupId = Number(req.params.id)
    const { status } = req.body

    if (!GROUP_STATUSES.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid seller group status.' })
    }

    const [result] = await db.query(
      `UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`,
      [status, sellerGroupId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Seller group not found.' })
    }

    return res.json({
      status: 'success',
      message: `Seller group ${status === 'active' ? 'activated' : 'deactivated'} successfully.`,
    })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to update seller group status.' })
  }
}

export const updateMemberRates = async (req, res) => {
  try {
    const sellerGroupId = Number(req.params.groupId)
    const accreditedSellerId = Number(req.params.memberId)
    const rates = {
      accredited_seller_assigned_rate_bailen: Number(req.body.accredited_seller_assigned_rate_bailen ?? 0),
      accredited_seller_assigned_rate_maragondon: Number(req.body.accredited_seller_assigned_rate_maragondon ?? 0),
      accredited_seller_assigned_rate_general_trias: Number(req.body.accredited_seller_assigned_rate_general_trias ?? 0),
    }

    const validation = await validateRateChain({ sellerGroupId, accreditedSellerId, rates })
    if (!validation.valid) {
      return res.status(409).json({ status: 'warning', message: validation.message })
    }

    const [result] = await db.query(
      `
        UPDATE accredited_sellers
        SET
          accredited_seller_assigned_rate_bailen = ?,
          accredited_seller_assigned_rate_maragondon = ?,
          accredited_seller_assigned_rate_general_trias = ?
        WHERE accredited_seller_id = ? AND seller_group_id = ?
      `,
      [
        rates.accredited_seller_assigned_rate_bailen,
        rates.accredited_seller_assigned_rate_maragondon,
        rates.accredited_seller_assigned_rate_general_trias,
        accreditedSellerId,
        sellerGroupId,
      ]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Seller group member not found.' })
    }

    return res.json({ status: 'success', message: 'Member rates updated successfully.' })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to update member rates.' })
  }
}

export const getSellerGroupOptions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT seller_group_id, seller_group_name
        FROM seller_groups
        WHERE seller_group_status = 'active'
        ORDER BY seller_group_name ASC
      `
    )

    return res.json({ status: 'success', message: 'Seller group options loaded.', data: rows })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to load seller group options.' })
  }
}
