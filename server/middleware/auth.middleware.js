import bcrypt from 'bcrypt';
import { getAuthenticatedUser } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import { isFullAccessAdministrator, roleHasPermission } from '../config/permissions.js';
import { canAccessProject } from '../services/adminProjectAccess.service.js';
import { db } from '../db/connect.js';

const denied = (res, status, message) => res.status(status).json({ success: false, message });

// Resolves the current cookie/Bearer session once and attaches it to the request.
export const authenticateUser = async (req, res, next) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return denied(res, 401, 'Authentication is required.');
  req.authUser = user;
  return next();
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
  const role = req.authUser?.role;
  const allowedAsFullAdmin = allowedRoles.includes('super_admin') && isFullAccessAdministrator(req.authUser);
  if (!allowedRoles.includes(role) && !allowedAsFullAdmin) {
    return denied(res, 403, 'You do not have permission to perform this action.');
  }
  return next();
};

export const requireExactRole = (...allowedRoles) => (req, res, next) => {
  const role = req.authUser?.role;
  if (!allowedRoles.includes(role)) {
    return denied(res, 403, 'This owner-only action requires a Super Admin account.');
  }
  return next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!roleHasPermission(req.authUser, permission)) {
    return denied(res, 403, 'You do not have permission to perform this action.');
  }
  return next();
};



export const requireProjectAccessBySlug = async (req, res, next, projectSlug) => {
  try {
    if (req.authUser?.role === 'super_admin') return next();
    const slug = String(projectSlug || '').trim();
    const [rows] = await db.query('SELECT lot_project_id FROM lot_projects WHERE lot_project_slug = ? LIMIT 1', [slug]);
    const projectId = Number(rows[0]?.lot_project_id || 0);
    if (!projectId) return denied(res, 404, 'Lot project not found.');
    if (!(await canAccessProject(req.authUser, projectId))) {
      return denied(res, 403, 'You do not have access to this project.');
    }
    req.authorizedLotProjectId = projectId;
    return next();
  } catch (error) {
    return denied(res, 500, error?.message || 'Unable to verify project access.');
  }
};

export const requireProjectAccessById = (paramName = 'id') => async (req, res, next) => {
  try {
    if (req.authUser?.role === 'super_admin') return next();
    const projectId = Number(req.params?.[paramName] || 0);
    if (!projectId) return denied(res, 400, 'Invalid project id.');
    if (!(await canAccessProject(req.authUser, projectId))) {
      return denied(res, 403, 'You do not have access to this project.');
    }
    req.authorizedLotProjectId = projectId;
    return next();
  } catch (error) {
    return denied(res, 500, error?.message || 'Unable to verify project access.');
  }
};

/**
 * Requires the authenticated user's current password for sensitive actions.
 * The password is removed from req.body after verification so downstream
 * controllers and audit metadata cannot accidentally persist it.
 */
export const requireCurrentPassword = ({
  field = 'password',
  label = 'Current password',
} = {}) => async (req, res, next) => {
  const password = typeof req.body?.[field] === 'string' ? req.body[field] : '';

  if (!password) {
    return denied(res, 400, `${label} is required.`);
  }

  const passwordHash = req.authUser?.password_hash;
  const isCorrect = Boolean(passwordHash) && await bcrypt.compare(password, passwordHash);

  if (!isCorrect) {
    return denied(res, 401, `${label} is incorrect.`);
  }

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
    req.body = { ...req.body };
    delete req.body[field];
  }

  return next();
};


