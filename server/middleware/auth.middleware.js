import bcrypt from 'bcrypt';
import { getAuthenticatedUser } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import { isFullAccessAdministrator, roleHasPermission } from '../config/permissions.js';

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

export const requirePermission = (permission) => (req, res, next) => {
  if (!roleHasPermission(req.authUser?.role, permission)) {
    return denied(res, 403, 'You do not have permission to perform this action.');
  }
  return next();
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
