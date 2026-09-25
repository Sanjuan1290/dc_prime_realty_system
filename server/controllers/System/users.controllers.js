import { db } from '../../db/connect.js';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { clearAuthCookie, getAuthCookieOptions } from '../../utils/authCookie.js';
import { isResendConfigured, sendEmail } from '../../services/email.service.js';
import { writeAuditLog } from './auditLogs.controller.js';
import {
  canActorChangeUserRole,
  canActorCreateUserRole,
  canActorManageUserRole,
  CONFIGURABLE_SYSTEM_ROLES,
  ROLE_CODES,
  SYSTEM_USER_ROLES,
} from '../../config/permissions.js';
import {
  assignTopLevelSellerAsGroupHead,
  assertGroupCurrentPathsWithinPools,
  assertSellerGroupRoleHierarchy,
} from './sellerGroup.controller.js';
import {
  getRequiredParentRole,
  isGroupHeadRole,
  isSellerRole,
  SELLER_ROLE_LABELS,
} from './sellerHierarchyRules.js';
import {
  getAccessibleProjectIds,
  hydrateAdminProjectAccess,
  replaceAdminProjectAccess,
} from '../../services/projectAccess.service.js';
import {
  copyRoleDefaultsToUser,
  getRoleDefaultPermissionKeys,
  hydrateUserPermissions,
  replaceUserPermissions,
} from '../../services/accessControl.service.js';
import {
  PASSWORD_RESET_CODE_EXPIRY_MINUTES,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_RESEND_SECONDS,
  assertPasswordResetEmailConfigured,
  createPasswordResetToken,
  ensurePasswordResetSchema,
  generatePasswordResetCode,
  getLoginSessionConfig,
  getRequestIpAddress,
  hashPasswordResetCode,
  isValidResetEmail,
  normalizeResetEmail,
  passwordResetCodeMatches,
  sendPasswordResetCodeEmail,
  validatePasswordResetValue,
  verifyPasswordResetToken,
} from './authentication.service.js';

const userRoles = new Set([...SYSTEM_USER_ROLES, 'division_manager', 'sales_director', 'unit_manager', 'sales_agent', 'external_group']);
const systemUserRoles = new Set(SYSTEM_USER_ROLES);
const configurableSystemRoles = new Set(CONFIGURABLE_SYSTEM_ROLES);

const sellerRoles = new Set([
  'division_manager',
  'sales_director',
  'unit_manager',
  'sales_agent',
]);

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') {
    if (String(error?.message || '').includes('uq_users_active_login_email')) return 'That email is already used by another active account.';
    if (String(error?.message || '').includes('uq_users_account_code')) return 'Generated account code already exists. Please try again.';
    return 'A unique account value already exists.';
  }
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};

const buildFullNameSql = (alias = 'u') => {
  return `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;
};

const normalizeStatus = (status) => (status === 'inactive' ? 'inactive' : 'active');

const buildPersonName = (user = {}) => {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'User';
};

const ADMIN_LOGIN_ROLES = new Set(SYSTEM_USER_ROLES);

const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%*?';
  const all = `${upper}${lower}${numbers}${symbols}`;
  const pick = (characters) => characters[crypto.randomInt(0, characters.length)];
  const required = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (required.length < 14) required.push(pick(all));
  for (let index = required.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(0, index + 1);
    [required[index], required[swap]] = [required[swap], required[index]];
  }
  return required.join('');
};

const escapeEmailHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const sendTemporaryLoginCredentials = async ({ user, temporaryPassword }) => {
  if (!isResendConfigured()) {
    const error = new Error('Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
    error.code = 'RESEND_NOT_CONFIGURED';
    throw error;
  }
  const appUrl = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  const loginUrl = appUrl ? `${appUrl}/portal` : '/portal';
  const name = buildPersonName(user);
  const roleLabel = String(user.role || '').split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' ');
  const subject = 'Your D&C Prime Realty login credentials';
  const text = [
    `Hello ${name},`,
    '',
    `Your ${roleLabel} account for the D&C Prime Realty Internal System is ready.`,
    '',
    `Login email: ${user.email}`,
    ...(user.account_code ? [`Account code: ${user.account_code}`] : []),
    `Temporary password: ${temporaryPassword}`,
    `Login: ${loginUrl}`,
    '',
    'You will be required to create a new password immediately after signing in.',
    'Do not forward or share this temporary password.',
    '',
    'D&C Prime Realty',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;line-height:1.6">
      <h2 style="margin-bottom:8px">Welcome to D&amp;C Prime Realty</h2>
      <p>Hello ${escapeEmailHtml(name)},</p>
      <p>Your <strong>${escapeEmailHtml(roleLabel)}</strong> account for the D&amp;C Prime Realty Internal System is ready.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff">
        <div style="font-size:13px;color:#475569">Login email</div>
        <div style="font-size:16px;font-weight:700">${escapeEmailHtml(user.email)}</div>
        ${user.account_code ? `<div style="margin-top:10px;font-size:13px;color:#475569">Account code</div><div style="font-size:16px;font-weight:700">${escapeEmailHtml(user.account_code)}</div>` : ''}
        <div style="margin-top:14px;font-size:13px;color:#475569">Temporary password</div>
        <div style="font-family:monospace;font-size:20px;font-weight:800;letter-spacing:1px">${escapeEmailHtml(temporaryPassword)}</div>
      </div>
      <p><a href="${escapeEmailHtml(loginUrl)}">Open the D&amp;C Prime Realty login page</a></p>
      <p>You will be required to create a new password immediately after signing in.</p>
      <p style="font-size:13px;color:#475569">Do not forward or share this temporary password.</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, text, html });
};

const denyUserManagement = (res, message) => res.status(403).json({
  success: false,
  message,
});

const actorCanManageTargetRole = (req, targetRole) =>
  canActorManageUserRole(req.authUser, targetRole);

// Action-specific routes already enforce their own granular permission. This helper
// only preserves the owner-level rule that a Super Admin account can be acted on
// by another Super Admin.
const actorCanPerformUserAction = (req, targetRole) =>
  targetRole !== 'super_admin' || req.authUser?.role === 'super_admin';

const actorCanCreateTargetRole = (req, targetRole) =>
  canActorCreateUserRole(req.authUser, targetRole);

const actorCanChangeTargetRole = (req, currentRole, requestedRole) =>
  canActorChangeUserRole(req.authUser, currentRole, requestedRole);

const validateRequestedRole = (role) => userRoles.has(String(role || ''));

const normalizeProjectIds = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map((item) => Number(item))
  .filter((item) => Number.isInteger(item) && item > 0))];

const normalizeBoolean = (value) => value === true || Number(value) === 1 || String(value || '').toLowerCase() === 'true';

const sanitizeAccountSurname = (value = '') => {
  const clean = String(value || '').normalize('NFKD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean || 'USER';
};

const buildAccountCode = ({ lastName, role, sequence, collisionSuffix = '' }) => {
  const roleCode = ROLE_CODES[role] || String(role || 'USR').slice(0, 3).toUpperCase();
  const base = `${sanitizeAccountSurname(lastName)}-${roleCode}-${String(Number(sequence || 1)).padStart(3, '0')}`;
  return collisionSuffix ? `${base}-${collisionSuffix}` : base;
};

const generateUniqueAccountCode = async (connection, { lastName, role, sequence }) => {
  const base = buildAccountCode({ lastName, role, sequence });
  const [rows] = await connection.query('SELECT id FROM users WHERE account_code = ? LIMIT 1', [base]);
  if (!rows.length) return base;
  // Same-surname/same-role/same-sequence people are disambiguated without changing the hidden per-person sequence.
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = buildAccountCode({ lastName, role, sequence, collisionSuffix: suffix });
    const [candidateRows] = await connection.query('SELECT id FROM users WHERE account_code = ? LIMIT 1', [candidate]);
    if (!candidateRows.length) return candidate;
  }
  throw createValidationError('Unable to generate a unique account code.');
};

const getNextRoleSequence = async (connection, personKey, role) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(role_sequence), 0) AS max_sequence FROM users WHERE person_key = ? AND role = ? FOR UPDATE`,
    [personKey, role]
  );
  return Number(rows[0]?.max_sequence || 0) + 1;
};

const previewNextRoleSequence = async (connection, personKey, role) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(role_sequence), 0) AS max_sequence FROM users WHERE person_key = ? AND role = ?`,
    [personKey, role]
  );
  return Number(rows[0]?.max_sequence || 0) + 1;
};

const PERMANENT_DEACTIVATION_CODE = 'ACCOUNT_PERMANENTLY_DEACTIVATED';
const LEGACY_PERMANENT_DEACTIVATION_CODE = 'ACCOUNT_DEACTIVATED_PERMANENTLY';

const normalizeSystemProjectAccess = (body = {}) => ({
  allProjects: normalizeBoolean(body.all_projects_access ?? body.admin_all_projects),
  projectIds: normalizeProjectIds(body.project_ids ?? body.admin_project_ids),
});

const assertSystemProjectSelection = (role, access) => {
  if (role === 'super_admin') return;
  if (configurableSystemRoles.has(role) && !access.allProjects && !access.projectIds.length) {
    throw createValidationError('Select at least one project this user can access, or choose All Projects.');
  }
};

const assertActorCanAssignAdminProjects = async (req, _connection, _allProjects, _projectIds) => {
  if (req.authUser?.role === 'super_admin') return;
  const error = new Error('Only Super Admin can assign project scope for internal system accounts.');
  error.statusCode = 403;
  error.code = 'SYSTEM_ACCESS_SUPER_ADMIN_ONLY';
  throw error;
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeAdminType = () => null;


const getSellerDependencyState = async (connection, userId) => {
  if (!userId) return { seller: null, headedGroup: null, directReports: [] };

  const [[sellerRows], [headedRows], [directReports]] = await Promise.all([
    connection.query(
      `
        SELECT
          seller.accredited_seller_id,
          seller.seller_group_id,
          user.role
        FROM accredited_sellers seller
        INNER JOIN users user ON user.id = seller.user_id
        WHERE seller.user_id = ?
          AND COALESCE(seller.is_system_dummy, 0) = 0
        LIMIT 1
      `,
      [userId]
    ),
    connection.query(
      `SELECT seller_group_id FROM seller_groups WHERE seller_group_head_user_id = ? LIMIT 1`,
      [userId]
    ),
    connection.query(
      `
        SELECT
          child.accredited_seller_id,
          child.seller_group_id,
          child_user.role,
          ${buildFullNameSql('child_user')} AS full_name
        FROM accredited_sellers child
        INNER JOIN users child_user ON child_user.id = child.user_id
        WHERE child.accredited_seller_reports_under_user_id = ?
          AND COALESCE(child.is_system_dummy, 0) = 0
      `,
      [userId]
    ),
  ]);

  return {
    seller: sellerRows[0] || null,
    headedGroup: headedRows[0] || null,
    directReports,
  };
};

const validateSellerRemovalOrRoleChange = async (connection, userId, requestedRole) => {
  const dependencies = await getSellerDependencyState(connection, userId);
  if (!dependencies.seller) return dependencies;

  if (!isSellerRole(requestedRole)) {
    if (dependencies.headedGroup) {
      throw createValidationError('Change the In-House Group Head before removing this user from the hierarchy.');
    }
    if (dependencies.directReports.length) {
      throw createValidationError('Reassign this seller’s direct reports before changing the account to a non-seller role.');
    }
  }

  return dependencies;
};

const validateSellerHierarchyAssignment = async (
  connection,
  {
    role,
    sellerGroupId,
    reportsUnderUserId,
    userId = null,
    dependencyState = null,
  }
) => {
  const groupId = toNullableNumber(sellerGroupId);
  const parentUserId = toNullableNumber(reportsUnderUserId);

  if (!groupId) throw createValidationError('Select an In-House Group.');

  const [groupRows] = await connection.query(
    `
      SELECT
        group_row.seller_group_id,
        group_row.seller_group_head_user_id,
        group_row.seller_group_status,
        group_row.seller_group_type,
        head_user.role AS seller_group_head_role
      FROM seller_groups group_row
      LEFT JOIN users head_user ON head_user.id = group_row.seller_group_head_user_id
      WHERE group_row.seller_group_id = ?
      LIMIT 1
    `,
    [groupId]
  );
  const group = groupRows[0];
  if (!group) throw createValidationError('The selected In-House Group was not found.');
  if (group.seller_group_status !== 'active') {
    throw createValidationError('The selected In-House Group is inactive.');
  }
  if (group.seller_group_type !== 'in_house') {
    throw createValidationError('In-house positions can only be assigned to an In-House Group.');
  }

  const dependencies = dependencyState || await getSellerDependencyState(connection, userId);
  const currentSeller = dependencies.seller;
  const headedGroup = dependencies.headedGroup;

  if (headedGroup && !isGroupHeadRole(role)) {
    throw createValidationError('Only a Division Manager or Sales Director can be the head of an In-House Group. Change the Group Head first.');
  }
  if (headedGroup && Number(headedGroup.seller_group_id) !== groupId) {
    throw createValidationError('A Group Head cannot be moved to another In-House Group. Change the Group Head first.');
  }

  if (
    currentSeller
    && Number(currentSeller.seller_group_id || 0) !== groupId
    && dependencies.directReports.length
  ) {
    throw createValidationError('Reassign this seller’s direct reports before moving the seller to another group.');
  }

  const invalidDirectReport = dependencies.directReports.find(
    (child) => getRequiredParentRole(child.role) !== role
  );
  if (invalidDirectReport) {
    throw createValidationError(
      `${invalidDirectReport.full_name || 'A direct report'} is a ${SELLER_ROLE_LABELS[invalidDirectReport.role] || invalidDirectReport.role} and cannot report under a ${SELLER_ROLE_LABELS[role] || role}. Reassign direct reports before changing this role.`
    );
  }

  const isCurrentGroupHead = Boolean(userId && Number(group.seller_group_head_user_id) === Number(userId));

  if (role === 'division_manager') {
    if (parentUserId) throw createValidationError('A Division Manager reports directly to the developer.');
    const canReplaceBrokerHead = group.seller_group_head_user_id
      && group.seller_group_head_role === 'sales_director'
      && !isCurrentGroupHead;
    if (group.seller_group_head_user_id && !isCurrentGroupHead && !canReplaceBrokerHead) {
      throw createValidationError('This group already has a Division Manager as its Group Head.');
    }
    return null;
  }

  if (!parentUserId) {
    const canBeUnassignedBroker = role === 'sales_director'
      && (!group.seller_group_head_user_id || isCurrentGroupHead);
    if (canBeUnassignedBroker) return null;

    throw createValidationError(
      `${SELLER_ROLE_LABELS[role] || 'This seller'} must report under a ${SELLER_ROLE_LABELS[getRequiredParentRole(role)] || 'valid parent seller'}.`
    );
  }

  if (userId && Number(parentUserId) === Number(userId)) {
    throw createValidationError('A seller cannot report under themselves.');
  }
  if (isCurrentGroupHead) {
    throw createValidationError('The In-House Group Head reports directly to the developer and cannot have a reporting parent.');
  }

  const [parentRows] = await connection.query(
    `
      SELECT
        parent_user.id AS user_id,
        parent_user.role,
        parent_seller.seller_group_id,
        parent_user.status AS user_status,
        parent_seller.accredited_seller_status,
        COALESCE(parent_seller.is_system_dummy, 0) AS is_system_dummy
      FROM users parent_user
      INNER JOIN accredited_sellers parent_seller ON parent_seller.user_id = parent_user.id
      WHERE parent_user.id = ?
      LIMIT 1
    `,
    [parentUserId]
  );
  const parent = parentRows[0];
  if (!parent || Number(parent.is_system_dummy || 0) === 1) {
    throw createValidationError('The selected reporting parent was not found.');
  }
  if (parent.user_status !== 'active' || parent.accredited_seller_status !== 'active') {
    throw createValidationError('The selected reporting parent must be active.');
  }
  if (Number(parent.seller_group_id) !== groupId) {
    throw createValidationError('The seller and reporting parent must belong to the same In-House Group.');
  }

  const expectedRole = getRequiredParentRole(role);
  if (parent.role !== expectedRole) {
    throw createValidationError(
      `${SELLER_ROLE_LABELS[role] || 'This seller'} can only report under a ${SELLER_ROLE_LABELS[expectedRole] || 'valid parent seller'}.`
    );
  }

  return parentUserId;
};

const hydrateUserProjectRates = async (users) => users.map((user) => ({ ...user, project_rates: [] }));


const syncManagedSellerLink = async (connection, accreditedSellerId, reportsUnderUserId) => {
  await connection.query(
    `DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?`,
    [accreditedSellerId]
  );

  if (!reportsUnderUserId) return;

  const [parentRows] = await connection.query(
    `
      SELECT accredited_seller_id
      FROM accredited_sellers
      WHERE user_id = ?
      LIMIT 1
    `,
    [reportsUnderUserId]
  );

  const parentAccreditedSellerId = parentRows[0]?.accredited_seller_id;
  if (!parentAccreditedSellerId) return;

  await connection.query(
    `
      INSERT INTO accredited_seller_managed_sellers (
        manager_accredited_seller_id,
        managed_accredited_seller_id
      ) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `,
    [parentAccreditedSellerId, accreditedSellerId]
  );
};

const getUserSelectSql = () => `
  SELECT
    u.id,
    u.account_code,
    u.account_category,
    u.person_key,
    u.role_sequence,
    u.first_name,
    u.last_name,
    u.middle_name,
    ${buildFullNameSql('u')} AS full_name,
    u.contact_no,
    u.tin_no,
    u.prc_no,
    u.address,
    u.email,
    u.role,
    u.admin_type,
    COALESCE(u.all_projects_access, u.admin_all_projects, 0) AS all_projects_access,
    COALESCE(u.admin_all_projects, 0) AS admin_all_projects,
    u.status,
    u.deactivated_at,
    u.deactivated_by_user_id,
    u.deactivation_reason,
    u.must_change_password,
    u.can_login,
    u.is_system_account,
    u.last_login,
    u.created_at,
    u.updated_at,
    a.accredited_seller_id,
    a.seller_group_id,
    sg.seller_group_name,
    a.accredited_seller_reports_under_user_id AS reports_under_user_id,
    ${buildFullNameSql('parent')} AS reports_under_name,
    parent.role AS reports_under_role,
    a.accredited_seller_accreditation_date AS accreditation_date,
    a.accredited_seller_status
  FROM users u
  LEFT JOIN accredited_sellers a ON a.user_id = u.id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
  LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
`;


export const login = async (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  const { password, rememberMe } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email or Account Code and password are required.' });
  }

  const [rows] = await db.query(
    `
      SELECT
        id,
        account_code,
        account_category,
        person_key,
        role_sequence,
        first_name,
        last_name,
        middle_name,
        contact_no,
        tin_no,
        prc_no,
        address,
        email,
        password_hash,
        role,
        admin_type,
        COALESCE(all_projects_access, admin_all_projects, 0) AS all_projects_access,
        status,
        must_change_password,
        COALESCE(auth_version, 0) AS auth_version,
        can_login,
        is_system_account,
        last_login,
        created_at,
        updated_at
      FROM users
      WHERE
        (account_code = ?)
        OR (
          LOWER(email) = LOWER(?)
          AND status = 'active'
          AND can_login = 1
          AND is_system_account = 0
        )
      ORDER BY (account_code = ?) DESC, (status = 'active') DESC, id DESC
      LIMIT 1
    `,
    [identifier, identifier, identifier]
  );

  let user = rows[0];

  if (!user) return res.status(401).json({ message: 'Invalid email/account code or password.' });
  if (user.status !== 'active') return res.status(403).json({ code: PERMANENT_DEACTIVATION_CODE, legacy_code: LEGACY_PERMANENT_DEACTIVATION_CODE, message: 'This account has been permanently deactivated.' });
  if (Number(user.can_login ?? 1) !== 1 || Number(user.is_system_account || 0) === 1) {
    return res.status(403).json({ message: 'This system account cannot sign in.' });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordCorrect) return res.status(401).json({ message: 'Invalid email/account code or password.' });

  user = await hydrateUserPermissions(user);
  [user] = await hydrateAdminProjectAccess([user]);

  const session = getLoginSessionConfig(rememberMe);
  const token = jwt.sign(
    { id: user.id, role: user.role, authVersion: Number(user.auth_version || 0) },
    process.env.JWT_SECRET,
    { expiresIn: session.expiresInSeconds }
  );

  res.cookie('token', token, getAuthCookieOptions({ maxAge: session.cookieMaxAge }));
  await db.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);

  await writeAuditLog(db, req, {
    actor: user,
    action: 'login',
    module: 'Authentication',
    entityType: 'user',
    entityId: String(user.id),
    entityLabel: user.account_code || buildPersonName(user),
    title: 'User logged in',
    description: `${user.account_code || user.email} logged in successfully.`,
  });

  const { password_hash: _passwordHash, ...safeUser } = user;
  return res.status(200).json({
    message: user.must_change_password ? 'Login successful. Password change is required.' : 'Login successful',
    user: { ...safeUser, must_change_password: Boolean(user.must_change_password) },
    session: { remembered: session.rememberMe, expiresInSeconds: session.expiresInSeconds },
  });
};

const passwordResetRequestMessage = 'If an active account matches that email, a 6-digit verification code has been sent.';

export const requestForgotPasswordCode = async (req, res) => {
  const connection = await db.getConnection();
  let resetCodeId = null;

  try {
    const email = normalizeResetEmail(req.body?.email);
    if (!isValidResetEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    assertPasswordResetEmailConfigured();
    await ensurePasswordResetSchema(connection);

    const [userRows] = await connection.query(
      `
        SELECT
          id,
          first_name,
          middle_name,
          last_name,
          email,
          role,
          status,
          can_login,
          is_system_account,
          COALESCE(auth_version, 0) AS auth_version
        FROM users
        WHERE LOWER(email) = LOWER(?)
          AND status = 'active'
          AND can_login = 1
          AND is_system_account = 0
        ORDER BY id DESC
        LIMIT 1
      `,
      [email]
    );
    const user = userRows[0];

    if (
      !user
      || user.status !== 'active'
      || Number(user.can_login ?? 1) !== 1
      || Number(user.is_system_account || 0) === 1
    ) {
      return res.json({
        message: passwordResetRequestMessage,
        expiresInMinutes: PASSWORD_RESET_CODE_EXPIRY_MINUTES,
        resendAfterSeconds: PASSWORD_RESET_RESEND_SECONDS,
      });
    }

    const [recentRows] = await connection.query(
      `
        SELECT user_password_reset_code_id
        FROM user_password_reset_codes
        WHERE user_id = ?
          AND status IN ('pending', 'verified')
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
        ORDER BY user_password_reset_code_id DESC
        LIMIT 1
      `,
      [user.id, PASSWORD_RESET_RESEND_SECONDS]
    );

    if (recentRows.length) {
      return res.json({
        message: passwordResetRequestMessage,
        expiresInMinutes: PASSWORD_RESET_CODE_EXPIRY_MINUTES,
        resendAfterSeconds: PASSWORD_RESET_RESEND_SECONDS,
      });
    }

    const code = generatePasswordResetCode();
    const codeHash = hashPasswordResetCode({ userId: user.id, code });
    const requestIp = getRequestIpAddress(req);
    const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 255) || null;

    await connection.beginTransaction();
    await connection.query(
      `
        UPDATE user_password_reset_codes
        SET status = CASE WHEN status = 'verified' THEN 'used' ELSE 'expired' END,
            used_at = CASE WHEN status = 'verified' THEN NOW() ELSE used_at END,
            updated_at = NOW()
        WHERE user_id = ?
          AND status IN ('pending', 'verified')
      `,
      [user.id]
    );
    const [insertResult] = await connection.query(
      `
        INSERT INTO user_password_reset_codes (
          user_id,
          code_hash,
          status,
          attempt_count,
          max_attempts,
          expires_at,
          request_ip,
          user_agent
        ) VALUES (?, ?, 'pending', 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)
      `,
      [
        user.id,
        codeHash,
        PASSWORD_RESET_MAX_ATTEMPTS,
        PASSWORD_RESET_CODE_EXPIRY_MINUTES,
        requestIp,
        userAgent,
      ]
    );
    resetCodeId = insertResult.insertId;
    await connection.commit();

    try {
      await sendPasswordResetCodeEmail({
        to: user.email,
        name: buildPersonName(user),
        code,
      });
    } catch (emailError) {
      await connection.query(
        `UPDATE user_password_reset_codes SET status = 'expired', updated_at = NOW() WHERE user_password_reset_code_id = ?`,
        [resetCodeId]
      );
      console.error('Password reset email failed:', {
        name: emailError?.name,
        message: emailError?.message,
        statusCode: emailError?.statusCode,
      });
      throw emailError;
    }

    return res.json({
      message: passwordResetRequestMessage,
      expiresInMinutes: PASSWORD_RESET_CODE_EXPIRY_MINUTES,
      resendAfterSeconds: PASSWORD_RESET_RESEND_SECONDS,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const verifyForgotPasswordCode = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const email = normalizeResetEmail(req.body?.email);
    const code = String(req.body?.code || '').replace(/\D/g, '').slice(0, 6);
    if (!isValidResetEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Enter your email and the 6-digit verification code.' });
    }

    await ensurePasswordResetSchema(connection);
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          reset.user_password_reset_code_id,
          reset.user_id,
          reset.code_hash,
          reset.status AS reset_status,
          reset.attempt_count,
          reset.max_attempts,
          reset.expires_at,
          user.first_name,
          user.middle_name,
          user.last_name,
          user.email,
          user.role,
          user.status,
          user.can_login,
          user.is_system_account,
          COALESCE(user.auth_version, 0) AS auth_version
        FROM user_password_reset_codes reset
        INNER JOIN users user ON user.id = reset.user_id
        WHERE LOWER(user.email) = LOWER(?)
          AND reset.status = 'pending'
        ORDER BY reset.user_password_reset_code_id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [email]
    );
    const row = rows[0];

    if (!row) {
      await connection.commit();
      return res.status(400).json({ message: 'The verification code is invalid or has expired.' });
    }

    if (
      row.status !== 'active'
      || Number(row.can_login ?? 1) !== 1
      || Number(row.is_system_account || 0) === 1
    ) {
      await connection.query(
        `UPDATE user_password_reset_codes SET status = 'locked', updated_at = NOW() WHERE user_password_reset_code_id = ?`,
        [row.user_password_reset_code_id]
      );
      await connection.commit();
      return res.status(400).json({ message: 'The verification code is invalid or has expired.' });
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await connection.query(
        `UPDATE user_password_reset_codes SET status = 'expired', updated_at = NOW() WHERE user_password_reset_code_id = ?`,
        [row.user_password_reset_code_id]
      );
      await connection.commit();
      return res.status(400).json({ message: 'The verification code has expired. Request a new code.' });
    }

    const matches = passwordResetCodeMatches({
      userId: row.user_id,
      code,
      expectedHash: row.code_hash,
    });

    if (!matches) {
      const nextAttempts = Number(row.attempt_count || 0) + 1;
      const locked = nextAttempts >= Number(row.max_attempts || PASSWORD_RESET_MAX_ATTEMPTS);
      await connection.query(
        `
          UPDATE user_password_reset_codes
          SET attempt_count = ?, status = ?, updated_at = NOW()
          WHERE user_password_reset_code_id = ?
        `,
        [nextAttempts, locked ? 'locked' : 'pending', row.user_password_reset_code_id]
      );
      await connection.commit();
      return res.status(400).json({
        message: locked
          ? 'Too many incorrect attempts. Request a new verification code.'
          : 'The verification code is incorrect.',
      });
    }

    await connection.query(
      `
        UPDATE user_password_reset_codes
        SET status = 'verified', verified_at = NOW(), updated_at = NOW()
        WHERE user_password_reset_code_id = ?
      `,
      [row.user_password_reset_code_id]
    );
    await connection.commit();

    return res.json({
      message: 'Verification code accepted. You can now set a new password.',
      resetToken: createPasswordResetToken({
        userId: row.user_id,
        resetCodeId: row.user_password_reset_code_id,
        authVersion: row.auth_version,
      }),
      expiresInMinutes: PASSWORD_RESET_CODE_EXPIRY_MINUTES,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const resetForgottenPassword = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const password = validatePasswordResetValue({
      newPassword: req.body?.newPassword ?? req.body?.new_password,
      confirmPassword: req.body?.confirmPassword ?? req.body?.confirm_password,
    });
    let decoded;
    try {
      decoded = verifyPasswordResetToken(req.body?.resetToken ?? req.body?.reset_token);
    } catch {
      return res.status(400).json({ message: 'Your password reset session is invalid or expired. Request a new code.' });
    }

    await ensurePasswordResetSchema(connection);
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          reset.user_password_reset_code_id,
          reset.user_id,
          reset.status AS reset_status,
          reset.expires_at,
          reset.used_at,
          user.first_name,
          user.middle_name,
          user.last_name,
          user.email,
          user.role,
          user.status,
          user.can_login,
          user.is_system_account,
          COALESCE(user.auth_version, 0) AS auth_version
        FROM user_password_reset_codes reset
        INNER JOIN users user ON user.id = reset.user_id
        WHERE reset.user_password_reset_code_id = ?
          AND reset.user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [decoded.resetCodeId, decoded.userId]
    );
    const row = rows[0];

    if (
      !row
      || row.reset_status !== 'verified'
      || row.used_at
      || new Date(row.expires_at).getTime() <= Date.now()
      || row.status !== 'active'
      || Number(row.can_login ?? 1) !== 1
      || Number(row.is_system_account || 0) === 1
      || Number(decoded.authVersion || 0) !== Number(row.auth_version || 0)
    ) {
      await connection.rollback();
      return res.status(400).json({ message: 'Your password reset session is invalid or expired. Request a new code.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await connection.query(
      `
        UPDATE users
        SET password_hash = ?,
            must_change_password = 0,
            auth_version = COALESCE(auth_version, 0) + 1,
            updated_at = NOW()
        WHERE id = ?
      `,
      [passwordHash, row.user_id]
    );
    await connection.query(
      `
        UPDATE user_password_reset_codes
        SET status = 'used', used_at = NOW(), updated_at = NOW()
        WHERE user_password_reset_code_id = ?
      `,
      [row.user_password_reset_code_id]
    );
    await connection.query(
      `
        UPDATE user_password_reset_codes
        SET status = CASE WHEN status = 'verified' THEN 'used' ELSE 'expired' END,
            used_at = CASE WHEN status = 'verified' THEN COALESCE(used_at, NOW()) ELSE used_at END,
            updated_at = NOW()
        WHERE user_id = ?
          AND user_password_reset_code_id <> ?
          AND status IN ('pending', 'verified')
      `,
      [row.user_id, row.user_password_reset_code_id]
    );

    await writeAuditLog(connection, req, {
      actor: row,
      action: 'update',
      module: 'Authentication',
      entityType: 'user',
      entityId: String(row.user_id),
      entityLabel: buildPersonName(row),
      title: 'Password reset completed',
      description: 'User reset their password using an email verification code.',
    });

    await connection.commit();
    clearAuthCookie(res);

    return res.json({ message: 'Password reset successfully. Sign in with your new password.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const logout = async (req, res) => {
  try {
    await writeAuditLog(db, req, {
      action: 'logout',
      module: 'Authentication',
      title: 'User logged out',
      description: 'User ended the current session.',
    });

    clearAuthCookie(res);

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch {
    return res.status(500).json({ message: 'Logout failed' });
  }
};

export const getMe = async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ code: 'NOT_AUTHENTICATED', message: 'Not authenticated' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.warn('getMe JWT verification failed:', { name: error.name, message: error.message });
    clearAuthCookie(res);
    return res.status(401).json({ code: 'INVALID_SESSION', message: 'Invalid or expired token' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        id, account_code, account_category, person_key, role_sequence,
        first_name, last_name, middle_name, contact_no, tin_no, email, role, admin_type,
        COALESCE(all_projects_access, admin_all_projects, 0) AS all_projects_access,
        status, must_change_password, COALESCE(auth_version, 0) AS auth_version,
        last_login, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [decoded.id]
    );

    let user = rows[0];
    if (!user || user.status !== 'active') {
      clearAuthCookie(res);
      return res.status(401).json({ code: 'USER_NOT_ACTIVE', message: 'This account is not active.' });
    }

    if (Number(decoded.authVersion ?? 0) !== Number(user.auth_version || 0)) {
      clearAuthCookie(res);
      return res.status(401).json({ code: 'INVALID_SESSION', message: 'Your session is no longer valid. Please sign in again.' });
    }

    user = await hydrateUserPermissions(user);
    [user] = await hydrateAdminProjectAccess([user]);

    return res.json({ user, message: 'Authenticated successfully' });
  } catch (error) {
    console.error('getMe database failure:', { code: error.code, message: error.message, sqlMessage: error.sqlMessage });
    return res.status(503).json({ code: 'SERVER_UNAVAILABLE', message: 'The server is temporarily unavailable.' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'You must be logged in to change your password.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.id);

    if (!userId) return res.status(401).json({ message: 'Invalid or expired session.' });

    const currentPassword = String(req.body.current_password ?? req.body.currentPassword ?? '');
    const newPassword = String(req.body.new_password ?? req.body.newPassword ?? '');
    const confirmPassword = String(req.body.confirm_password ?? req.body.confirmPassword ?? '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Current password, new password, and confirmation are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from the current password.' });
    }

    if (newPassword.toLowerCase() === 'password') {
      return res.status(400).json({ message: 'Do not use the temporary default password.' });
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          first_name,
          middle_name,
          last_name,
          contact_no,
          tin_no,
          prc_no,
          address,
          email,
          password_hash,
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
      [userId]
    );

    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active.' });

    const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `
        UPDATE users
        SET password_hash = ?, must_change_password = 0, updated_at = NOW()
        WHERE id = ?
      `,
      [passwordHash, userId]
    );

    await writeAuditLog(db, req, {
      actor: user,
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: buildPersonName(user),
      title: 'Changed password',
      description: 'User changed their password after a reset requirement.',
      metadata: { previousMustChangePassword: Boolean(user.must_change_password) },
    });

    return res.json({
      message: 'Password changed successfully.',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        contact_no: user.contact_no,
        tin_no: user.tin_no,
        email: user.email,
        role: user.role,
        status: user.status,
        must_change_password: false,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || 'all');
    const status = String(req.query.status || 'all');

    // System-owned direct-sales agents are operational identities, not user accounts.
    const where = ["COALESCE(u.is_system_account, 0) = 0", "COALESCE(u.account_category, CASE WHEN u.role IN ('super_admin','admin','marketing','sales','accounting','operations') THEN 'system' ELSE 'seller' END) = 'system'"];
    const params = [];

    if (search) {
      where.push(`(
        ${buildFullNameSql('u')} LIKE ? OR
        u.email LIKE ? OR
        IFNULL(u.contact_no, '') LIKE ? OR
        IFNULL(u.tin_no, '') LIKE ? OR
        IFNULL(u.prc_no, '') LIKE ? OR
        IFNULL(u.address, '') LIKE ? OR
        IFNULL(sg.seller_group_name, '') LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (role !== 'all') {
      where.push('u.role = ?');
      params.push(role);
    }

    if (status !== 'all') {
      where.push('u.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN accredited_sellers a ON a.user_id = u.id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [rows] = await db.query(
      `
        ${getUserSelectSql()}
        ${whereSql}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const hydratedRows = await hydrateAdminProjectAccess(rows);

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'active') AS active,
        SUM(status = 'inactive') AS inactive,
        SUM(must_change_password = 1) AS mustChangePassword
      FROM users
      WHERE COALESCE(is_system_account, 0) = 0
        AND COALESCE(account_category, CASE WHEN role IN ('super_admin','admin','marketing','sales','accounting','operations') THEN 'system' ELSE 'seller' END) = 'system'
    `);

    return res.json({
      data: hydratedRows,
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
        mustChangePassword: Number(summaryRows[0]?.mustChangePassword || 0),
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

export const previewSystemAccountCode = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const lastName = String(req.query?.last_name || '').trim();
    const role = String(req.query?.role || '').trim();
    if (!lastName) return res.status(400).json({ message: 'Last name is required for an account-code preview.' });
    if (!systemUserRoles.has(role)) return res.status(400).json({ message: 'Select a valid internal system role.' });
    const roleSequence = 1;
    const accountCode = await generateUniqueAccountCode(connection, { lastName, role, sequence: roleSequence });
    return res.json({ account_code: accountCode, role_sequence: roleSequence, preview: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const previewChangeUserPosition = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const sourceUserId = Number(req.params.id || 0);
    const newRole = String(req.query?.role || req.query?.new_role || '').trim();

    if (!sourceUserId) return res.status(400).json({ message: 'Invalid user id.' });
    if (!CONFIGURABLE_SYSTEM_ROLES.includes(newRole)) {
      return res.status(400).json({ message: 'New position must be Admin, Marketing, Sales, Accounting, or Operations.' });
    }

    const [rows] = await connection.query(
      `SELECT id, account_code, person_key, first_name, middle_name, last_name, email, role, status
       FROM users WHERE id = ? LIMIT 1`,
      [sourceUserId]
    );
    const source = rows[0];
    if (!source) return res.status(404).json({ message: 'User not found.' });
    if (!systemUserRoles.has(source.role)) {
      return res.status(400).json({ message: 'Change Position applies only to internal system users.' });
    }
    if (source.role === 'super_admin') {
      return res.status(409).json({ message: 'A Super Admin account cannot be changed through the position workflow.' });
    }
    if (source.status !== 'active') {
      return res.status(409).json({ code: PERMANENT_DEACTIVATION_CODE, message: 'Only an active account can be changed to a new position.' });
    }
    if (source.role === newRole) {
      return res.status(400).json({ message: 'Choose a different position. The current role is already assigned to this active account.' });
    }

    const personKey = source.person_key || crypto.randomUUID();
    const roleSequence = await previewNextRoleSequence(connection, personKey, newRole);
    const accountCode = await generateUniqueAccountCode(connection, {
      lastName: source.last_name,
      role: newRole,
      sequence: roleSequence,
    });

    return res.json({
      preview: true,
      source: {
        id: source.id,
        account_code: source.account_code,
        role: source.role,
      },
      replacement: {
        account_code: accountCode,
        role: newRole,
        role_sequence: roleSequence,
        person_key: personKey,
        email: source.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ code: error.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      first_name,
      last_name,
      middle_name,
      contact_no,
      tin_no,
      prc_no,
      address,
      email,
      password,
      role = 'sales_agent',
      admin_type,
      admin_all_projects = false,
      admin_project_ids = [],
      status = 'active',
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
    }
    if (!validateRequestedRole(role)) {
      return res.status(400).json({ message: 'Select a valid user role.' });
    }
    if (role === 'external_group') {
      return res.status(400).json({ message: 'Create External Group accounts from the External Groups page.' });
    }
    if (!actorCanCreateTargetRole(req, role)) {
      return denyUserManagement(res, 'You do not have permission to create this account type.');
    }

    if (systemUserRoles.has(role)) {
      if (req.authUser?.role !== 'super_admin') {
        return res.status(403).json({
          code: 'SYSTEM_ACCESS_SUPER_ADMIN_ONLY',
          message: 'Only Super Admin can create internal system accounts because account permissions and project scope are assigned at creation.',
        });
      }
      const projectAccess = role === 'super_admin'
        ? { allProjects: true, projectIds: [] }
        : normalizeSystemProjectAccess(req.body);
      assertSystemProjectSelection(role, projectAccess);
      await assertActorCanAssignAdminProjects(req, connection, projectAccess.allProjects, projectAccess.projectIds);

      await connection.beginTransaction();
      const personKey = crypto.randomUUID();
      const roleSequence = 1;
      const accountCode = await generateUniqueAccountCode(connection, { lastName: last_name, role, sequence: roleSequence });
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      const normalizedStatus = normalizeStatus(status);

      const [result] = await connection.query(
        `INSERT INTO users (
          account_code, account_category, person_key, role_sequence,
          first_name, last_name, middle_name, contact_no, tin_no, prc_no, address, email,
          password_hash, role, admin_type, admin_all_projects, all_projects_access,
          status, must_change_password, can_login, is_system_account
        ) VALUES (?, 'system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, 1, 0)`,
        [
          accountCode, personKey, roleSequence,
          first_name.trim(), last_name.trim(), middle_name?.trim() || null,
          contact_no?.trim() || null, tin_no?.trim() || null, prc_no?.trim() || null,
          address?.trim() || null, email.trim(), passwordHash, role,
          projectAccess.allProjects ? 1 : 0, projectAccess.allProjects ? 1 : 0,
          normalizedStatus,
        ]
      );

      const userId = result.insertId;
      if (role !== 'super_admin') {
        await replaceAdminProjectAccess(connection, {
          userId,
          role,
          allProjects: projectAccess.allProjects,
          projectIds: projectAccess.projectIds,
          changedByUserId: req.authUser?.id || null,
        });
        if (req.authUser?.role === 'super_admin' && Array.isArray(req.body?.permissions)) {
          await replaceUserPermissions(connection, {
            userId,
            permissionKeys: req.body.permissions,
            changedByUserId: req.authUser?.id || null,
          });
        } else {
          await copyRoleDefaultsToUser(connection, { userId, role, changedByUserId: req.authUser?.id || null });
        }
      }

      await writeAuditLog(connection, req, {
        action: 'create', module: 'Users', entityType: 'user', entityId: String(userId),
        entityLabel: accountCode, title: 'Created system user account',
        description: `Created ${accountCode} for ${first_name.trim()} ${last_name.trim()}.`,
        metadata: {
          role, account_code: accountCode, person_key: personKey, role_sequence: roleSequence,
          all_projects_access: projectAccess.allProjects, project_ids: projectAccess.projectIds,
        },
      });

      await connection.commit();

      let credentialsEmailSent = false;
      let credentialsEmailWarning = null;
      try {
        await sendTemporaryLoginCredentials({
          user: { first_name, middle_name, last_name, email: email.trim(), role, account_code: accountCode },
          temporaryPassword,
        });
        credentialsEmailSent = true;
      } catch (emailError) {
        credentialsEmailWarning = 'Account created, but the login credentials email could not be delivered. Use Resend Login Credentials from User Management.';
        console.error('Failed to send new-user login credentials:', emailError.message);
      }

      return res.status(201).json({
        message: credentialsEmailSent ? 'User created successfully. Login credentials were sent by email.' : credentialsEmailWarning,
        user_id: userId,
        account_code: accountCode,
        credentials_email_sent: credentialsEmailSent,
        credentials_email_warning: credentialsEmailWarning,
      });
    }

    const normalizedAdminProjectIds = role === 'admin' ? normalizeProjectIds(admin_project_ids) : [];
    const normalizedAdminAllProjects = role === 'admin' && (admin_all_projects === true || Number(admin_all_projects) === 1 || String(admin_all_projects).toLowerCase() === 'true');
    if (role === 'admin' && !normalizedAdminAllProjects && !normalizedAdminProjectIds.length) {
      return res.status(400).json({ message: 'Select at least one project this Admin can manage, or choose All Projects.' });
    }
    await assertActorCanAssignAdminProjects(req, connection, normalizedAdminAllProjects, normalizedAdminProjectIds);
    const normalizedAdminType = normalizeAdminType(role, admin_type);
    const normalizedReportsUnderUserId = sellerRoles.has(role)
      ? await validateSellerHierarchyAssignment(connection, {
          role,
          sellerGroupId: seller_group_id,
          reportsUnderUserId: reports_under_user_id,
        })
      : null;

    await connection.beginTransaction();

    const isAdminLoginAccount = ADMIN_LOGIN_ROLES.has(role);
    const temporaryPassword = isAdminLoginAccount ? generateTemporaryPassword() : String(password || 'password');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const [result] = await connection.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          middle_name,
          contact_no,
          tin_no,
          prc_no,
          address,
          email,
          password_hash,
          role,
          admin_type,
          admin_all_projects,
          status,
          must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        first_name.trim(),
        last_name.trim(),
        middle_name?.trim() || null,
        contact_no?.trim() || null,
        tin_no?.trim() || null,
        prc_no?.trim() || null,
        address?.trim() || null,
        email.trim(),
        passwordHash,
        role,
        normalizedAdminType,
        normalizedAdminAllProjects ? 1 : 0,
        normalizeStatus(status),
      ]
    );

    const userId = result.insertId;
    await replaceAdminProjectAccess(connection, {
      userId, role, allProjects: normalizedAdminAllProjects, projectIds: normalizedAdminProjectIds, changedByUserId: req.authUser?.id || null,
    });
    let accreditedSellerId = null;

    if (sellerRoles.has(role)) {
      const [sellerResult] = await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          normalizedReportsUnderUserId,
          accreditation_date || new Date().toISOString().slice(0, 10),
          normalizeStatus(status),
        ]
      );

      accreditedSellerId = sellerResult.insertId;
      if (isGroupHeadRole(role) && !normalizedReportsUnderUserId) {
        await assignTopLevelSellerAsGroupHead(connection, Number(seller_group_id), userId);
      }
      await syncManagedSellerLink(connection, accreditedSellerId, normalizedReportsUnderUserId);
      await assertSellerGroupRoleHierarchy(connection, Number(seller_group_id));
      await assertGroupCurrentPathsWithinPools(connection, Number(seller_group_id));
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: `${first_name.trim()} ${last_name.trim()}`,
      title: 'Created user account',
      description: `Created account for ${first_name.trim()} ${last_name.trim()} (${email.trim()}).`,
      metadata: { role, admin_all_projects: normalizedAdminAllProjects, admin_project_ids: normalizedAdminProjectIds, status: normalizeStatus(status), seller_group_id, reports_under_user_id: normalizedReportsUnderUserId },
    });

    if (accreditedSellerId) {
      await writeAuditLog(connection, req, {
        action: 'create',
        module: 'Accreditation',
        entityType: 'accredited_seller',
        entityId: String(accreditedSellerId),
        entityLabel: `${first_name.trim()} ${last_name.trim()}`,
        title: 'Accredited seller',
        description: `Accredited ${first_name.trim()} ${last_name.trim()} as ${role}.`,
        metadata: { role, admin_type: normalizedAdminType, status: normalizeStatus(status), seller_group_id, reports_under_user_id: normalizedReportsUnderUserId },
      });
    }

    await connection.commit();

    let credentialsEmailSent = false;
    let credentialsEmailWarning = null;
    if (isAdminLoginAccount) {
      try {
        await sendTemporaryLoginCredentials({
          user: { first_name, middle_name, last_name, email: email.trim(), role },
          temporaryPassword,
        });
        credentialsEmailSent = true;
      } catch (emailError) {
        credentialsEmailWarning = 'Account created, but the login credentials email could not be delivered. Use Resend Login Credentials from User Management.';
        console.error('Failed to send new-user login credentials:', emailError.message);
      }
    }

    return res.status(201).json({
      message: isAdminLoginAccount
        ? (credentialsEmailSent ? 'User created successfully. Login credentials were sent by email.' : credentialsEmailWarning)
        : 'User created successfully.',
      user_id: userId,
      credentials_email_sent: credentialsEmailSent,
      credentials_email_warning: credentialsEmailWarning,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const editUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = Number(req.params.id);

    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const {
      first_name,
      last_name,
      middle_name,
      contact_no,
      tin_no,
      prc_no,
      address,
      email,
      role,
      admin_type,
      admin_all_projects = false,
      admin_project_ids = [],
      status,
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
    }
    if (!validateRequestedRole(role)) {
      return res.status(400).json({ message: 'Select a valid user role.' });
    }

    const [targetRows] = await connection.query(
      `SELECT id, account_code, account_category, person_key, role_sequence, role, status, email, admin_type, COALESCE(all_projects_access, admin_all_projects, 0) AS all_projects_access FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const targetUser = targetRows[0];
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });
    if (targetUser.role === 'external_group' || role === 'external_group') {
      return res.status(400).json({ message: 'Manage External Group accounts from the External Groups page.' });
    }

    if (!actorCanManageTargetRole(req, targetUser.role)) {
      return denyUserManagement(res, 'You do not have permission to edit this account.');
    }

    if (systemUserRoles.has(targetUser.role)) {
      if (String(role || targetUser.role) !== targetUser.role) {
        return res.status(409).json({
          code: 'SYSTEM_ROLE_IMMUTABLE',
          message: 'A system account role cannot be changed. Use Change Position / Create New Account instead.',
        });
      }
      if (targetUser.status !== 'active') {
        return res.status(409).json({
          code: 'ACCOUNT_PERMANENTLY_DEACTIVATED',
          message: 'This account is permanently deactivated and retained as a historical identity.',
        });
      }

      await connection.beginTransaction();
      await connection.query(
        `UPDATE users SET
          first_name = ?, last_name = ?, middle_name = ?, contact_no = ?, tin_no = ?, prc_no = ?, address = ?, email = ?,
          auth_version = COALESCE(auth_version, 0) + 1
         WHERE id = ?`,
        [
          first_name.trim(), last_name.trim(), middle_name?.trim() || null,
          contact_no?.trim() || null, tin_no?.trim() || null, prc_no?.trim() || null,
          address?.trim() || null, email.trim(), userId,
        ]
      );
      await writeAuditLog(connection, req, {
        action: 'update', module: 'Users', entityType: 'user', entityId: String(userId),
        entityLabel: targetUser.account_code || email.trim(), title: 'Updated system user details',
        description: `Updated personal/contact details for ${targetUser.account_code || email.trim()}. Role and access were unchanged.`,
        metadata: { role: targetUser.role, role_immutable: true },
      });
      await connection.commit();
      return res.json({ message: 'User details updated. Role and access remain unchanged; existing sessions were invalidated.' });
    }

    if (!actorCanChangeTargetRole(req, targetUser.role, role)) {
      return denyUserManagement(
        res,
        'You do not have permission to assign the selected role.'
      );
    }

    const normalizedAdminProjectIds = role === 'admin' ? normalizeProjectIds(admin_project_ids) : [];
    const normalizedAdminAllProjects = role === 'admin' && (admin_all_projects === true || Number(admin_all_projects) === 1 || String(admin_all_projects).toLowerCase() === 'true');
    if (role === 'admin' && !normalizedAdminAllProjects && !normalizedAdminProjectIds.length) {
      return res.status(400).json({ message: 'Select at least one project this Admin can manage, or choose All Projects.' });
    }
    await assertActorCanAssignAdminProjects(req, connection, normalizedAdminAllProjects, normalizedAdminProjectIds);
    const normalizedAdminType = normalizeAdminType(role, admin_type);

    const dependencyState = await validateSellerRemovalOrRoleChange(connection, userId, role);
    const normalizedReportsUnderUserId = sellerRoles.has(role)
      ? await validateSellerHierarchyAssignment(connection, {
          role,
          sellerGroupId: seller_group_id,
          reportsUnderUserId: reports_under_user_id,
          userId,
          dependencyState,
        })
      : null;
    const previousSellerGroupId = Number(dependencyState.seller?.seller_group_id || 0);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE users
        SET
          first_name = ?,
          last_name = ?,
          middle_name = ?,
          contact_no = ?,
          tin_no = ?,
          prc_no = ?,
          address = ?,
          email = ?,
          role = ?,
          admin_type = ?,
          admin_all_projects = ?,
          status = ?
        WHERE id = ?
      `,
      [
        first_name.trim(),
        last_name.trim(),
        middle_name?.trim() || null,
        contact_no?.trim() || null,
        tin_no?.trim() || null,
        prc_no?.trim() || null,
        address?.trim() || null,
        email.trim(),
        role,
        normalizedAdminType,
        normalizedAdminAllProjects ? 1 : 0,
        normalizeStatus(status),
        userId,
      ]
    );

    await replaceAdminProjectAccess(connection, {
      userId, role, allProjects: normalizedAdminAllProjects, projectIds: normalizedAdminProjectIds, changedByUserId: req.authUser?.id || null,
    });

    let accreditedSellerId = null;

    if (sellerRoles.has(role)) {
      await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            seller_group_id = VALUES(seller_group_id),
            accredited_seller_reports_under_user_id = VALUES(accredited_seller_reports_under_user_id),
            accredited_seller_accreditation_date = VALUES(accredited_seller_accreditation_date),
            accredited_seller_status = VALUES(accredited_seller_status)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          normalizedReportsUnderUserId,
          accreditation_date || new Date().toISOString().slice(0, 10),
          normalizeStatus(status),
        ]
      );

      const [sellerRows] = await connection.query(
        `SELECT accredited_seller_id FROM accredited_sellers WHERE user_id = ? LIMIT 1`,
        [userId]
      );

      accreditedSellerId = sellerRows[0]?.accredited_seller_id;
      if (isGroupHeadRole(role) && !normalizedReportsUnderUserId) {
        await assignTopLevelSellerAsGroupHead(connection, Number(seller_group_id), userId);
      }
      await syncManagedSellerLink(connection, accreditedSellerId, normalizedReportsUnderUserId);
      await assertSellerGroupRoleHierarchy(connection, Number(seller_group_id));
      await assertGroupCurrentPathsWithinPools(connection, Number(seller_group_id));
    } else {
      await connection.query(`DELETE FROM accredited_sellers WHERE user_id = ?`, [userId]);
    }

    if (previousSellerGroupId && previousSellerGroupId !== Number(seller_group_id || 0)) {
      await assertSellerGroupRoleHierarchy(connection, previousSellerGroupId);
      await assertGroupCurrentPathsWithinPools(connection, previousSellerGroupId);
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: `${first_name.trim()} ${last_name.trim()}`,
      title: 'Updated user account',
      description: `Updated account for ${first_name.trim()} ${last_name.trim()} (${email.trim()}).`,
      metadata: { role, admin_all_projects: normalizedAdminAllProjects, admin_project_ids: normalizedAdminProjectIds, status: normalizeStatus(status), seller_group_id, reports_under_user_id: normalizedReportsUnderUserId },
    });

    if (accreditedSellerId) {
      await writeAuditLog(connection, req, {
        action: 'update',
        module: 'Accreditation',
        entityType: 'accredited_seller',
        entityId: String(accreditedSellerId),
        entityLabel: `${first_name.trim()} ${last_name.trim()}`,
        title: 'Updated accreditation',
        description: `Updated accreditation for ${first_name.trim()} ${last_name.trim()}.`,
        metadata: { role, status: normalizeStatus(status), seller_group_id, reports_under_user_id: normalizedReportsUnderUserId },
      });
    }

    await connection.commit();

    return res.json({ message: 'User updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deactivateUserPermanently = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const requestedStatus = req.body?.status == null ? 'inactive' : String(req.body.status).trim().toLowerCase();
    if (requestedStatus !== 'inactive') {
      return res.status(409).json({
        code: PERMANENT_DEACTIVATION_CODE,
        legacy_code: LEGACY_PERMANENT_DEACTIVATION_CODE,
        message: 'Accounts cannot be reactivated. Create a new account if the employee returns or changes position.',
      });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, account_code, first_name, middle_name, last_name, email, role, status
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const user = rows[0];
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    if (user.role === 'external_group') throw Object.assign(new Error('Manage External Group accounts from the External Groups page.'), { statusCode: 400 });
    if (!actorCanPerformUserAction(req, user.role)) throw Object.assign(new Error('Only Super Admin can deactivate another Super Admin account.'), { statusCode: 403 });
    if (user.status !== 'active') {
      const error = new Error('This account is permanently deactivated and cannot be activated again. Create a new account if the employee returns or changes position.');
      error.statusCode = 409;
      error.code = PERMANENT_DEACTIVATION_CODE;
      throw error;
    }
    if (userId === Number(req.authUser?.id || 0)) {
      throw Object.assign(new Error('You cannot permanently deactivate the account you are currently using.'), { statusCode: 409 });
    }

    const reason = String(req.body?.reason || req.body?.deactivation_reason || 'Account permanently deactivated by an authorized user.').trim().slice(0, 500);
    await connection.query(
      `UPDATE users
       SET status = 'inactive', deactivated_at = NOW(), deactivated_by_user_id = ?, deactivation_reason = ?,
           auth_version = COALESCE(auth_version, 0) + 1
       WHERE id = ?`,
      [req.authUser?.id || null, reason, userId]
    );
    await connection.query(
      `UPDATE accredited_sellers SET accredited_seller_status = 'inactive' WHERE user_id = ?`,
      [userId]
    );

    await writeAuditLog(connection, req, {
      action: 'update', module: 'Users', entityType: 'user', entityId: String(userId),
      entityLabel: user.account_code || buildPersonName(user), title: 'Permanently deactivated user account',
      description: `${user.account_code || user.email} was permanently deactivated. The account cannot be reactivated.`,
      metadata: { previousStatus: 'active', nextStatus: 'inactive', permanent: true, reason },
    });

    await connection.commit();
    return res.json({
      message: 'Account permanently deactivated. It cannot be activated again.',
      status: 'inactive',
      permanent: true,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const changeUserPosition = async (req, res) => {
  const connection = await db.getConnection();
  let newAccount = null;
  let temporaryPassword = null;
  try {
    const sourceUserId = Number(req.params.id || 0);
    const newRole = String(req.body?.new_role || req.body?.role || '').trim();
    if (!sourceUserId) return res.status(400).json({ message: 'Invalid user id.' });
    if (!CONFIGURABLE_SYSTEM_ROLES.includes(newRole)) {
      return res.status(400).json({ message: 'New position must be Admin, Marketing, Sales, Accounting, or Operations.' });
    }

    const projectAccess = normalizeSystemProjectAccess(req.body);
    assertSystemProjectSelection(newRole, projectAccess);
    await assertActorCanAssignAdminProjects(req, connection, projectAccess.allProjects, projectAccess.projectIds);

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, account_code, account_category, person_key, role_sequence,
              first_name, last_name, middle_name, contact_no, tin_no, prc_no, address, email,
              role, status
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [sourceUserId]
    );
    const source = rows[0];
    if (!source) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    if (!systemUserRoles.has(source.role)) throw Object.assign(new Error('Change Position applies only to internal system users.'), { statusCode: 400 });
    if (source.role === 'super_admin') throw Object.assign(new Error('A Super Admin account cannot be changed through the position workflow.'), { statusCode: 409 });
    if (source.status !== 'active') throw Object.assign(new Error('Only an active account can be changed to a new position.'), { statusCode: 409, code: PERMANENT_DEACTIVATION_CODE });
    if (source.role === newRole) throw Object.assign(new Error('Choose a different position. The current role is already assigned to this active account.'), { statusCode: 400 });

    const personKey = source.person_key || crypto.randomUUID();
    if (!source.person_key) await connection.query('UPDATE users SET person_key = ? WHERE id = ?', [personKey, sourceUserId]);
    const roleSequence = await getNextRoleSequence(connection, personKey, newRole);
    const accountCode = await generateUniqueAccountCode(connection, { lastName: source.last_name, role: newRole, sequence: roleSequence });
    temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const reason = String(req.body?.reason || `Position changed from ${source.role} to ${newRole}.`).trim().slice(0, 500);

    // Deactivate first inside the same transaction so the active-email uniqueness constraint
    // can accept the replacement account. Rollback restores the old account if anything fails.
    await connection.query(
      `UPDATE users
       SET status = 'inactive', deactivated_at = NOW(), deactivated_by_user_id = ?, deactivation_reason = ?,
           auth_version = COALESCE(auth_version, 0) + 1
       WHERE id = ?`,
      [req.authUser?.id || null, reason, sourceUserId]
    );

    const [insertResult] = await connection.query(
      `INSERT INTO users (
        account_code, account_category, person_key, role_sequence,
        first_name, last_name, middle_name, contact_no, tin_no, prc_no, address, email,
        password_hash, role, admin_type, admin_all_projects, all_projects_access,
        status, must_change_password, can_login, is_system_account
      ) VALUES (?, 'system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'active', 1, 1, 0)`,
      [
        accountCode, personKey, roleSequence,
        source.first_name, source.last_name, source.middle_name, source.contact_no, source.tin_no, source.prc_no, source.address, source.email,
        passwordHash, newRole, projectAccess.allProjects ? 1 : 0, projectAccess.allProjects ? 1 : 0,
      ]
    );

    const newUserId = insertResult.insertId;
    await replaceAdminProjectAccess(connection, {
      userId: newUserId, role: newRole, allProjects: projectAccess.allProjects,
      projectIds: projectAccess.projectIds, changedByUserId: req.authUser?.id || null,
    });
    if (Array.isArray(req.body?.permissions)) {
      await replaceUserPermissions(connection, { userId: newUserId, permissionKeys: req.body.permissions, changedByUserId: req.authUser?.id || null });
    } else {
      await copyRoleDefaultsToUser(connection, { userId: newUserId, role: newRole, changedByUserId: req.authUser?.id || null });
    }

    await writeAuditLog(connection, req, {
      action: 'update', module: 'Users', entityType: 'user', entityId: String(sourceUserId),
      entityLabel: source.account_code || source.email, title: 'Retired account for position change',
      description: `${source.account_code || source.email} was permanently deactivated for a position change.`,
      metadata: { old_role: source.role, new_role: newRole, replacement_user_id: newUserId, replacement_account_code: accountCode, reason },
    });
    await writeAuditLog(connection, req, {
      action: 'create', module: 'Users', entityType: 'user', entityId: String(newUserId),
      entityLabel: accountCode, title: 'Created replacement position account',
      description: `Created ${accountCode} as the replacement account for ${source.account_code || source.email}.`,
      metadata: { previous_user_id: sourceUserId, previous_account_code: source.account_code, role: newRole, role_sequence: roleSequence, person_key: personKey },
    });

    await connection.commit();
    newAccount = { id: newUserId, account_code: accountCode, role: newRole, email: source.email, first_name: source.first_name, middle_name: source.middle_name, last_name: source.last_name };
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }

  let credentialsEmailSent = false;
  let credentialsEmailWarning = null;
  try {
    await sendTemporaryLoginCredentials({ user: newAccount, temporaryPassword });
    credentialsEmailSent = true;
  } catch (emailError) {
    credentialsEmailWarning = 'The position change was completed, but the new login credentials email could not be delivered. Use Resend Login Credentials.';
    console.error('Failed to send position-change credentials:', emailError.message);
  }

  return res.status(201).json({
    message: credentialsEmailSent
      ? `Position changed successfully. ${newAccount.account_code} was created and credentials were emailed.`
      : credentialsEmailWarning,
    previous_account_permanently_deactivated: true,
    user: newAccount,
    credentials_email_sent: credentialsEmailSent,
    credentials_email_warning: credentialsEmailWarning,
  });
};

export const resetUserPassword = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, account_code, first_name, middle_name, last_name, email, role, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );
    const user = rows[0];

    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    if (!ADMIN_LOGIN_ROLES.has(user.role)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Login credential emails are available only for internal system-user accounts.' });
    }
    if (user.status !== 'active') {
      await connection.rollback();
      return res.status(409).json({ code: PERMANENT_DEACTIVATION_CODE, legacy_code: LEGACY_PERMANENT_DEACTIVATION_CODE, message: 'This account is permanently deactivated. Create a new account instead of resetting historical credentials.' });
    }
    if (!actorCanPerformUserAction(req, user.role)) {
      await connection.rollback();
      return denyUserManagement(res, 'Only Super Admin can reset another Super Admin account password.');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await connection.query(
      `UPDATE users
       SET password_hash = ?, must_change_password = 1, auth_version = COALESCE(auth_version, 0) + 1
       WHERE id = ?`,
      [passwordHash, userId]
    );

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: buildPersonName(user),
      title: 'Regenerated user login credentials',
      description: 'A new temporary password was generated for email delivery. Existing sessions will be invalidated when the change is committed.',
      metadata: { delivery: 'email' },
    });

    try {
      await sendTemporaryLoginCredentials({ user, temporaryPassword });
    } catch (emailError) {
      await connection.rollback();
      const error = new Error('Login credentials could not be emailed. The existing password and sessions were left unchanged. Check the Resend configuration and try again.');
      error.statusCode = emailError?.statusCode || 502;
      throw error;
    }

    await connection.commit();
    return res.json({
      message: 'New login credentials were sent by email. Existing sessions were invalidated and the user must change the temporary password after signing in.',
      credentials_email_sent: true,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

