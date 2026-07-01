import { db } from '../../db/connect.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const USER_ROLES = [
  'super_admin',
  'admin',
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]

const SELLER_ROLES = ['broker_network_manager', 'broker', 'manager', 'agent']
const USER_STATUSES = ['active', 'inactive']

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

const validateUserPayload = ({ first_name, last_name, email, role, status }) => {
  if (!first_name?.trim()) return 'First name is required.'
  if (!last_name?.trim()) return 'Last name is required.'
  if (!email?.trim()) return 'Email is required.'
  if (!USER_ROLES.includes(role)) return 'Invalid user role.'
  if (!USER_STATUSES.includes(status)) return 'Invalid user status.'
  return null
}

const validateSellerHierarchy = async ({ role, reports_under_user_id }) => {
  if (!SELLER_ROLES.includes(role)) return null
  if (!reports_under_user_id) return null

  const [[parent]] = await db.query(
    `SELECT id, role, status FROM users WHERE id = ? LIMIT 1`,
    [reports_under_user_id]
  )

  if (!parent) return 'Selected parent seller does not exist.'
  if (parent.status !== 'active') return 'Selected parent seller is inactive.'

  const allowedParentRoles = {
    broker_network_manager: [],
    broker: ['broker_network_manager'],
    manager: ['broker', 'broker_network_manager'],
    agent: ['manager', 'broker', 'broker_network_manager'],
  }

  if (!allowedParentRoles[role].includes(parent.role)) {
    return `${role.replaceAll('_', ' ')} cannot report under ${parent.role.replaceAll('_', ' ')}.`
  }

  return null
}

export const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const [rows] = await db.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        middle_name,
        contact_no,
        email,
        password_hash,
        role,
        status,
        must_change_password,
        last_login,
        created_at,
        updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [String(email).trim()]
  )

  const user = rows[0]

  if (!user) return res.status(401).json({ message: 'Email does not exist!' })
  if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active' })

  const isPasswordCorrect = await bcrypt.compare(password, user.password_hash)

  if (!isPasswordCorrect) return res.status(401).json({ message: 'Wrong password' })

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  })

  await db.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id])

  return res.status(200).json({
    message: user.must_change_password
      ? 'Login successful. Password change is required.'
      : 'Login successful',
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      contact_no: user.contact_no,
      email: user.email,
      role: user.role,
      status: user.status,
      must_change_password: Boolean(user.must_change_password),
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  })
}

export const getUsers = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const filters = []
    const params = []

    if (req.query.search?.trim()) {
      const keyword = `%${req.query.search.trim()}%`
      filters.push(`(${fullNameSql('u')} LIKE ? OR u.email LIKE ? OR u.contact_no LIKE ? OR sg.seller_group_name LIKE ?)`)
      params.push(keyword, keyword, keyword, keyword)
    }

    if (req.query.role && req.query.role !== 'all') {
      if (!USER_ROLES.includes(req.query.role)) {
        return res.status(400).json({ status: 'error', message: 'Invalid role filter.' })
      }
      filters.push('u.role = ?')
      params.push(req.query.role)
    }

    if (req.query.status && req.query.status !== 'all') {
      if (!USER_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ status: 'error', message: 'Invalid status filter.' })
      }
      filters.push('u.status = ?')
      params.push(req.query.status)
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

    const [[countRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN accredited_sellers a ON a.user_id = u.id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        ${whereSql}
      `,
      params
    )

    const [rows] = await db.query(
      `
        SELECT
          u.id,
          u.first_name,
          u.middle_name,
          u.last_name,
          ${fullNameSql('u')} AS full_name,
          u.contact_no,
          u.email,
          u.role,
          u.status,
          u.must_change_password,
          u.last_login,
          u.created_at,
          u.updated_at,
          a.seller_group_id,
          sg.seller_group_name,
          a.accredited_seller_reports_under_user_id AS reports_under_user_id,
          ${fullNameSql('parent')} AS reports_under_name,
          parent.role AS reports_under_role,
          a.accredited_seller_accreditation_date AS accreditation_date,
          a.accredited_seller_status
        FROM users u
        LEFT JOIN accredited_sellers a ON a.user_id = u.id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        ${whereSql}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    const [[summary]] = await db.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(status = 'active') AS active,
          SUM(status = 'inactive') AS inactive,
          SUM(must_change_password = 1) AS mustChangePassword
        FROM users
      `
    )

    return res.json({
      status: rows.length ? 'success' : 'warning',
      message: rows.length ? 'Users loaded.' : 'No users found.',
      data: rows,
      pagination: paginationPayload(page, limit, Number(countRow.total || 0)),
      summary: {
        total: Number(summary.total || 0),
        active: Number(summary.active || 0),
        inactive: Number(summary.inactive || 0),
        mustChangePassword: Number(summary.mustChangePassword || 0),
      },
    })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to load users.' })
  }
}

export const createUser = async (req, res) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const {
      first_name,
      middle_name = null,
      last_name,
      contact_no = '',
      email,
      password = 'password',
      role,
      status = 'active',
      seller_group_id = null,
      reports_under_user_id = null,
      accreditation_date = null,
    } = req.body

    const validationMessage = validateUserPayload({ first_name, last_name, email, role, status })
    if (validationMessage) {
      await connection.rollback()
      return res.status(400).json({ status: 'error', message: validationMessage })
    }

    const parentValidation = await validateSellerHierarchy({ role, reports_under_user_id })
    if (parentValidation) {
      await connection.rollback()
      return res.status(400).json({ status: 'error', message: parentValidation })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const [result] = await connection.query(
      `
        INSERT INTO users
          (first_name, middle_name, last_name, contact_no, email, password_hash, role, status, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        first_name.trim(),
        middle_name || null,
        last_name.trim(),
        contact_no || '',
        email.trim(),
        passwordHash,
        role,
        status,
      ]
    )

    const userId = result.insertId

    if (SELLER_ROLES.includes(role)) {
      await connection.query(
        `
          INSERT INTO accredited_sellers
            (user_id, seller_group_id, accredited_seller_reports_under_user_id, accredited_seller_accreditation_date, accredited_seller_status)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          normalizeNullableNumber(seller_group_id),
          normalizeNullableNumber(reports_under_user_id),
          accreditation_date || null,
          status,
        ]
      )
    }

    await connection.commit()

    return res.status(201).json({
      status: 'success',
      message: SELLER_ROLES.includes(role)
        ? 'User and accredited seller profile created successfully.'
        : 'User created successfully.',
      data: { id: userId },
    })
  } catch (error) {
    await connection.rollback()

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Email already exists.' })
    }

    return res.status(500).json({ status: 'error', message: error.message || 'Failed to create user.' })
  } finally {
    connection.release()
  }
}

export const editUser = async (req, res) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const userId = Number(req.params.id)
    const {
      first_name,
      middle_name = null,
      last_name,
      contact_no = '',
      email,
      role,
      status = 'active',
      seller_group_id = null,
      reports_under_user_id = null,
      accreditation_date = null,
    } = req.body

    const validationMessage = validateUserPayload({ first_name, last_name, email, role, status })
    if (validationMessage) {
      await connection.rollback()
      return res.status(400).json({ status: 'error', message: validationMessage })
    }

    if (Number(reports_under_user_id) === userId) {
      await connection.rollback()
      return res.status(400).json({ status: 'error', message: 'A seller cannot report under themselves.' })
    }

    const parentValidation = await validateSellerHierarchy({ role, reports_under_user_id })
    if (parentValidation) {
      await connection.rollback()
      return res.status(400).json({ status: 'error', message: parentValidation })
    }

    const [result] = await connection.query(
      `
        UPDATE users
        SET first_name = ?, middle_name = ?, last_name = ?, contact_no = ?, email = ?, role = ?, status = ?
        WHERE id = ?
      `,
      [
        first_name.trim(),
        middle_name || null,
        last_name.trim(),
        contact_no || '',
        email.trim(),
        role,
        status,
        userId,
      ]
    )

    if (!result.affectedRows) {
      await connection.rollback()
      return res.status(404).json({ status: 'error', message: 'User not found.' })
    }

    if (SELLER_ROLES.includes(role)) {
      await connection.query(
        `
          INSERT INTO accredited_sellers
            (user_id, seller_group_id, accredited_seller_reports_under_user_id, accredited_seller_accreditation_date, accredited_seller_status)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            seller_group_id = VALUES(seller_group_id),
            accredited_seller_reports_under_user_id = VALUES(accredited_seller_reports_under_user_id),
            accredited_seller_accreditation_date = VALUES(accredited_seller_accreditation_date),
            accredited_seller_status = VALUES(accredited_seller_status)
        `,
        [
          userId,
          normalizeNullableNumber(seller_group_id),
          normalizeNullableNumber(reports_under_user_id),
          accreditation_date || null,
          status,
        ]
      )
    } else {
      await connection.query(
        `UPDATE accredited_sellers SET accredited_seller_status = 'inactive' WHERE user_id = ?`,
        [userId]
      )
    }

    await connection.commit()

    return res.json({ status: 'success', message: 'User updated successfully.' })
  } catch (error) {
    await connection.rollback()

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Email already exists.' })
    }

    return res.status(500).json({ status: 'error', message: error.message || 'Failed to update user.' })
  } finally {
    connection.release()
  }
}

export const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id)
    const { status } = req.body

    if (!USER_STATUSES.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user status.' })
    }

    const [result] = await db.query(
      `UPDATE users SET status = ? WHERE id = ?`,
      [status, userId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'User not found.' })
    }

    await db.query(
      `UPDATE accredited_sellers SET accredited_seller_status = ? WHERE user_id = ?`,
      [status, userId]
    )

    return res.json({
      status: 'success',
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully.`,
    })
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to update user status.' })
  }
}

export const getMe = async (req, res) => {
  try {
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const [rows] = await db.query(
      `
        SELECT
          id,
          first_name,
          last_name,
          middle_name,
          contact_no,
          email,
          role,
          status,
          must_change_password,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [decoded.id]
    )

    const user = rows[0]

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({ user, message: 'Successfully getMe :3' })
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
