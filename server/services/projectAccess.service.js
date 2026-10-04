import { db } from '../db/connect.js';
import { CONFIGURABLE_SYSTEM_ROLES } from '../config/permissions.js';

const uniquePositiveIds = (values = []) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value) && value > 0))];

export const isSuperAdmin = (user = {}) => String(user?.role || '').toLowerCase() === 'super_admin';
export const isProjectScopedSystemUser = (user = {}) => CONFIGURABLE_SYSTEM_ROLES.includes(String(user?.role || '').toLowerCase());

const loadProjectScopeIdentity = async (connection, userId, { forUpdate = false } = {}) => {
  const id = Number(userId || 0);
  if (!id) return null;
  const [rows] = await connection.query(
    `SELECT id, role, status, COALESCE(all_projects_access, admin_all_projects, 0) AS all_projects_access
     FROM users
     WHERE id = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] || null;
};

export const getUserProjectAccess = async (user, connection = db) => {
  if (!user?.id) return { allProjects: false, projectIds: [] };

  const identity = await loadProjectScopeIdentity(connection, user.id);
  if (!identity || identity.status !== 'active') return { allProjects: false, projectIds: [] };
  if (identity.role === 'super_admin') return { allProjects: true, projectIds: [] };
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(identity.role)) return { allProjects: false, projectIds: [] };

  if (Number(identity.all_projects_access || 0) === 1) {
    return { allProjects: true, projectIds: [] };
  }

  const [projectRows] = await connection.query(
    'SELECT lot_project_id FROM user_project_access WHERE user_id = ? ORDER BY lot_project_id ASC',
    [identity.id]
  );

  return {
    allProjects: false,
    projectIds: projectRows.map((row) => Number(row.lot_project_id)).filter(Boolean),
  };
};

export const canAccessProject = async (user, projectId, connection = db) => {
  const numericProjectId = Number(projectId || 0);
  if (!numericProjectId || !user?.id) return false;
  const access = await getUserProjectAccess(user, connection);
  return access.allProjects || access.projectIds.includes(numericProjectId);
};

export const getAccessibleProjectIds = async (user, connection = db) => {
  if (!user?.id) return [];
  const access = await getUserProjectAccess(user, connection);
  return access.allProjects ? null : access.projectIds;
};

export const replaceUserProjectAccess = async (connection, {
  userId,
  role = null,
  allProjects = false,
  projectIds = [],
  changedByUserId = null,
}) => {
  const id = Number(userId || 0);
  if (!id) throw Object.assign(new Error('User id is required for project access.'), { statusCode: 400 });

  const identity = await loadProjectScopeIdentity(connection, id, { forUpdate: true });
  if (!identity) throw Object.assign(new Error('User not found.'), { statusCode: 404 });

  // Never trust a caller-supplied role as the authority. The persisted account role wins.
  if (role && String(role) !== String(identity.role)) {
    throw Object.assign(new Error('Project access role does not match the persisted user role.'), { statusCode: 409 });
  }

  await connection.query('DELETE FROM user_project_access WHERE user_id = ?', [id]);

  if (identity.role === 'super_admin') {
    await connection.query('UPDATE users SET all_projects_access = 1 WHERE id = ?', [id]);
    return { allProjects: true, projectIds: [] };
  }

  if (!CONFIGURABLE_SYSTEM_ROLES.includes(identity.role)) {
    await connection.query('UPDATE users SET all_projects_access = 0 WHERE id = ?', [id]);
    return { allProjects: false, projectIds: [] };
  }

  const normalizedIds = uniquePositiveIds(projectIds);
  if (!allProjects && !normalizedIds.length) {
    throw Object.assign(new Error('Select at least one project this user can access, or choose All Projects.'), { statusCode: 400 });
  }

  if (normalizedIds.length) {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const [validRows] = await connection.query(
      `SELECT lot_project_id FROM lot_projects WHERE lot_project_id IN (${placeholders})`,
      normalizedIds
    );
    const validIds = new Set(validRows.map((row) => Number(row.lot_project_id)));
    if (normalizedIds.some((projectId) => !validIds.has(projectId))) {
      throw Object.assign(new Error('One or more selected projects no longer exist.'), { statusCode: 400 });
    }
  }

  await connection.query('UPDATE users SET all_projects_access = ? WHERE id = ?', [allProjects ? 1 : 0, id]);

  if (!allProjects && normalizedIds.length) {
    const values = normalizedIds.map(() => '(?, ?, ?)').join(', ');
    const params = normalizedIds.flatMap((projectId) => [id, projectId, changedByUserId || null]);
    await connection.query(
      `INSERT INTO user_project_access (user_id, lot_project_id, created_by_user_id) VALUES ${values}`,
      params
    );
  }

  return { allProjects: Boolean(allProjects), projectIds: allProjects ? [] : normalizedIds };
};

export const hydrateUserProjectAccess = async (rows = [], connection = db) => {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const ids = rows.map((row) => Number(row.id)).filter(Boolean);
  if (!ids.length) return rows;
  const placeholders = ids.map(() => '?').join(', ');
  const [projectRows] = await connection.query(
    `SELECT upa.user_id, p.lot_project_id AS id, p.lot_project_name AS name, p.lot_project_slug AS slug
     FROM user_project_access upa
     INNER JOIN lot_projects p ON p.lot_project_id = upa.lot_project_id
     WHERE upa.user_id IN (${placeholders})
     ORDER BY p.lot_project_name`,
    ids
  );
  const byUser = new Map();
  for (const project of projectRows) {
    if (!byUser.has(Number(project.user_id))) byUser.set(Number(project.user_id), []);
    byUser.get(Number(project.user_id)).push({ id: Number(project.id), name: project.name, slug: project.slug });
  }
  return rows.map((row) => {
    const allProjects = row.role === 'super_admin' || Number(row.all_projects_access ?? row.admin_all_projects ?? 0) === 1;
    const projects = allProjects ? [] : (byUser.get(Number(row.id)) || []);
    return {
      ...row,
      all_projects_access: allProjects,
      project_ids: projects.map((project) => project.id),
      projects,
      // Temporary compatibility properties for older UI/controller call-sites.
      admin_all_projects: allProjects,
      admin_project_ids: projects.map((project) => project.id),
      admin_projects: projects,
    };
  });
};

export const describeUserProjectAccess = (row = {}) => {
  if (row.role === 'super_admin' || row.all_projects_access === true || Number(row.all_projects_access || row.admin_all_projects || 0) === 1) return 'All Projects';
  const projects = row.projects || row.admin_projects || [];
  return projects.map((project) => project.name).filter(Boolean).join(', ') || 'No Projects';
};

export const grantProjectAccessToUser = async (connection, userId, projectId, changedByUserId = null) => {
  const uid = Number(userId || 0);
  const pid = Number(projectId || 0);
  if (!uid || !pid) return;
  const identity = await loadProjectScopeIdentity(connection, uid);
  if (!identity || !CONFIGURABLE_SYSTEM_ROLES.includes(identity.role) || Number(identity.all_projects_access || 0) === 1) return;
  await connection.query(
    `INSERT INTO user_project_access (user_id, lot_project_id, created_by_user_id)
     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE created_by_user_id = VALUES(created_by_user_id)`,
    [uid, pid, changedByUserId || null]
  );
};

// Legacy symbol aliases retained during the staged RBAC rollout.
export const getAdminProjectAccess = getUserProjectAccess;
export const replaceAdminProjectAccess = replaceUserProjectAccess;
export const hydrateAdminProjectAccess = hydrateUserProjectAccess;
export const describeAdminProjectAccess = describeUserProjectAccess;
export const grantProjectAccessToAdmin = grantProjectAccessToUser;
export const isOperationalAdmin = isProjectScopedSystemUser;

// Older project-creation code used an object-shaped helper name that was never
// consistently exported. Keep it working during the migration to generalized scope.
export const grantAdminProjectAccess = async (connection, {
  userId,
  projectId,
  changedByUserId = null,
} = {}) => grantProjectAccessToUser(connection, userId, projectId, changedByUserId);
