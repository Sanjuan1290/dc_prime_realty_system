import { db } from '../db/connect.js';
import { SYSTEM_USER_ROLES } from '../config/permissions.js';

const uniquePositiveIds = (values = []) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value) && value > 0))];

export const isSuperAdmin = (user = {}) => String(user?.role || '').toLowerCase() === 'super_admin';
export const isOperationalAdmin = (user = {}) => SYSTEM_USER_ROLES.includes(String(user?.role || '').toLowerCase());

export const getUserProjectAccess = async (user, connection = db) => {
  if (!user?.id) return { allProjects: false, projectIds: [] };
  if (isSuperAdmin(user)) return { allProjects: true, projectIds: [] };
  if (!isOperationalAdmin(user)) return { allProjects: false, projectIds: [] };

  const [[userRows], [projectRows]] = await Promise.all([
    connection.query('SELECT COALESCE(all_projects_access, 0) AS all_projects_access FROM users WHERE id = ? LIMIT 1', [user.id]),
    connection.query('SELECT lot_project_id FROM user_project_access WHERE user_id = ? ORDER BY lot_project_id ASC', [user.id]),
  ]);

  return {
    allProjects: Number(userRows[0]?.all_projects_access || 0) === 1,
    projectIds: projectRows.map((row) => Number(row.lot_project_id)).filter(Boolean),
  };
};

// Backward-compatible alias used by older controllers while the UI wording is generalized.
export const getAdminProjectAccess = getUserProjectAccess;

export const canAccessProject = async (user, projectId, connection = db) => {
  const numericProjectId = Number(projectId || 0);
  if (!numericProjectId) return false;
  if (isSuperAdmin(user)) return true;
  if (!isOperationalAdmin(user)) return false;
  const access = await getUserProjectAccess(user, connection);
  return access.allProjects || access.projectIds.includes(numericProjectId);
};

export const getAccessibleProjectIds = async (user, connection = db) => {
  if (isSuperAdmin(user)) return null;
  if (!isOperationalAdmin(user)) return [];
  const access = await getUserProjectAccess(user, connection);
  return access.allProjects ? null : access.projectIds;
};

export const replaceUserProjectAccess = async (connection, {
  userId,
  role,
  allProjects = false,
  projectIds = [],
  changedByUserId = null,
}) => {
  const id = Number(userId || 0);
  if (!id) throw Object.assign(new Error('User id is required for project access.'), { statusCode: 400 });

  await connection.query('DELETE FROM user_project_access WHERE user_id = ?', [id]);

  const normalizedRole = String(role || '');
  if (!SYSTEM_USER_ROLES.includes(normalizedRole) || normalizedRole === 'super_admin') {
    await connection.query('UPDATE users SET all_projects_access = ? WHERE id = ?', [normalizedRole === 'super_admin' ? 1 : 0, id]);
    return { allProjects: normalizedRole === 'super_admin', projectIds: [] };
  }

  const normalizedIds = uniquePositiveIds(projectIds);
  if (!allProjects && !normalizedIds.length) {
    throw Object.assign(new Error('Select at least one project this user can access, or choose All Projects.'), { statusCode: 400 });
  }

  if (normalizedIds.length) {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const [validRows] = await connection.query(`SELECT lot_project_id FROM lot_projects WHERE lot_project_id IN (${placeholders})`, normalizedIds);
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

export const replaceAdminProjectAccess = replaceUserProjectAccess;

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
     ORDER BY p.lot_project_name`, ids
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
      // Legacy response properties retained so older UI pieces do not break.
      admin_all_projects: allProjects,
      admin_project_ids: projects.map((project) => project.id),
      admin_projects: projects,
    };
  });
};

export const hydrateAdminProjectAccess = hydrateUserProjectAccess;

export const describeAdminProjectAccess = (row = {}) => {
  if (row.role === 'super_admin' || row.all_projects_access === true || Number(row.all_projects_access || row.admin_all_projects || 0) === 1) return 'All Projects';
  const projects = row.projects || row.admin_projects || [];
  return projects.map((project) => project.name).filter(Boolean).join(', ') || 'No Projects';
};

export const grantProjectAccessToAdmin = async (connection, userId, projectId, changedByUserId = null) => {
  const uid = Number(userId || 0);
  const pid = Number(projectId || 0);
  if (!uid || !pid) return;
  const [rows] = await connection.query('SELECT role, COALESCE(all_projects_access, 0) AS all_projects_access FROM users WHERE id = ? LIMIT 1', [uid]);
  const user = rows[0];
  if (!user || !SYSTEM_USER_ROLES.includes(user.role) || user.role === 'super_admin' || Number(user.all_projects_access || 0) === 1) return;
  await connection.query(
    `INSERT INTO user_project_access (user_id, lot_project_id, created_by_user_id)
     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE created_by_user_id = VALUES(created_by_user_id)`,
    [uid, pid, changedByUserId || null]
  );
};

