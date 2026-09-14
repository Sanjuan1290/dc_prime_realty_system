import { db } from '../db/connect.js';

const clean = (value = '') => String(value ?? '').trim();
const uniquePositiveIds = (values = []) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value) && value > 0))];

export const isSuperAdmin = (user = {}) => String(user?.role || '').toLowerCase() === 'super_admin';
export const isOperationalAdmin = (user = {}) => String(user?.role || '').toLowerCase() === 'admin';

export const getAdminProjectAccess = async (user, connection = db) => {
  if (!user?.id) return { allProjects: false, projectIds: [] };
  if (isSuperAdmin(user)) return { allProjects: true, projectIds: [] };
  if (!isOperationalAdmin(user)) return { allProjects: false, projectIds: [] };

  const [[userRows], [projectRows]] = await Promise.all([
    connection.query('SELECT COALESCE(admin_all_projects, 0) AS admin_all_projects FROM users WHERE id = ? LIMIT 1', [user.id]),
    connection.query('SELECT lot_project_id FROM admin_project_access WHERE user_id = ? ORDER BY lot_project_id ASC', [user.id]),
  ]);

  return {
    allProjects: Number(userRows[0]?.admin_all_projects || 0) === 1,
    projectIds: projectRows.map((row) => Number(row.lot_project_id)).filter(Boolean),
  };
};

export const canAccessProject = async (user, projectId, connection = db) => {
  const numericProjectId = Number(projectId || 0);
  if (!numericProjectId) return false;
  if (isSuperAdmin(user)) return true;
  if (!isOperationalAdmin(user)) return false;

  const access = await getAdminProjectAccess(user, connection);
  return access.allProjects || access.projectIds.includes(numericProjectId);
};

export const getAccessibleProjectIds = async (user, connection = db) => {
  if (isSuperAdmin(user)) return null; // null = unrestricted
  if (!isOperationalAdmin(user)) return [];
  const access = await getAdminProjectAccess(user, connection);
  if (access.allProjects) return null;
  return access.projectIds;
};

export const replaceAdminProjectAccess = async (connection, {
  userId,
  role,
  allProjects = false,
  projectIds = [],
  changedByUserId = null,
}) => {
  const id = Number(userId || 0);
  if (!id) throw Object.assign(new Error('User id is required for project access.'), { statusCode: 400 });

  await connection.query('DELETE FROM admin_project_access WHERE user_id = ?', [id]);

  if (String(role || '') !== 'admin') {
    await connection.query('UPDATE users SET admin_all_projects = 0, admin_type = NULL WHERE id = ?', [id]);
    return { allProjects: false, projectIds: [] };
  }

  const normalizedIds = uniquePositiveIds(projectIds);
  if (!allProjects && !normalizedIds.length) {
    throw Object.assign(new Error('Select at least one project this Admin can manage, or choose All Projects.'), { statusCode: 400 });
  }

  if (normalizedIds.length) {
    const placeholders = normalizedIds.map(() => '?').join(', ');
    const [validRows] = await connection.query(
      `SELECT lot_project_id FROM lot_projects WHERE lot_project_id IN (${placeholders})`,
      normalizedIds
    );
    const validIds = new Set(validRows.map((row) => Number(row.lot_project_id)));
    const invalid = normalizedIds.find((projectId) => !validIds.has(projectId));
    if (invalid) throw Object.assign(new Error('One or more selected projects no longer exist.'), { statusCode: 400 });
  }

  await connection.query(
    'UPDATE users SET admin_all_projects = ?, admin_type = NULL WHERE id = ?',
    [allProjects ? 1 : 0, id]
  );

  if (!allProjects && normalizedIds.length) {
    await connection.query(
      `INSERT INTO admin_project_access (user_id, lot_project_id, created_by_user_id)
       VALUES ${normalizedIds.map(() => '(?, ?, ?)').join(', ')}`,
      normalizedIds.flatMap((projectId) => [id, projectId, changedByUserId || null])
    );
  }

  return { allProjects: Boolean(allProjects), projectIds: allProjects ? [] : normalizedIds };
};

export const hydrateAdminProjectAccess = async (rows = [], connection = db) => {
  const adminIds = rows.filter((row) => String(row.role || '') === 'admin').map((row) => Number(row.id)).filter(Boolean);
  if (!adminIds.length) return rows;

  const placeholders = adminIds.map(() => '?').join(', ');
  const [accessRows] = await connection.query(
    `SELECT apa.user_id, apa.lot_project_id, lp.lot_project_name
     FROM admin_project_access apa
     INNER JOIN lot_projects lp ON lp.lot_project_id = apa.lot_project_id
     WHERE apa.user_id IN (${placeholders})
     ORDER BY lp.lot_project_name ASC`,
    adminIds
  );
  const grouped = new Map();
  accessRows.forEach((row) => {
    const key = Number(row.user_id);
    const list = grouped.get(key) || [];
    list.push({ id: Number(row.lot_project_id), name: row.lot_project_name });
    grouped.set(key, list);
  });

  return rows.map((row) => {
    if (String(row.role || '') !== 'admin') return row;
    const projects = grouped.get(Number(row.id)) || [];
    return {
      ...row,
      admin_all_projects: Number(row.admin_all_projects || 0) === 1,
      admin_project_ids: projects.map((project) => project.id),
      admin_projects: projects,
    };
  });
};

export const projectAccessSummary = (row = {}) => {
  if (String(row.role || '') !== 'admin') return null;
  if (Number(row.admin_all_projects || 0) === 1 || row.admin_all_projects === true) return 'All Projects';
  const projects = Array.isArray(row.admin_projects) ? row.admin_projects : [];
  return projects.map((project) => clean(project.name)).filter(Boolean).join(', ') || 'No Projects';
};

export const grantAdminProjectAccess = async (connection, { userId, projectId, changedByUserId = null }) => {
  const uid = Number(userId || 0);
  const pid = Number(projectId || 0);
  if (!uid || !pid) return;
  const [rows] = await connection.query('SELECT role, COALESCE(admin_all_projects, 0) AS admin_all_projects FROM users WHERE id = ? LIMIT 1', [uid]);
  const user = rows[0];
  if (!user || user.role !== 'admin' || Number(user.admin_all_projects || 0) === 1) return;
  await connection.query(
    `INSERT INTO admin_project_access (user_id, lot_project_id, created_by_user_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE created_by_user_id = COALESCE(created_by_user_id, VALUES(created_by_user_id))`,
    [uid, pid, changedByUserId || null]
  );
};
