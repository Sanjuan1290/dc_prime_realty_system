import { getAuthenticatedUser } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import { roleHasPermission } from '../config/permissions.js';

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
  if (!allowedRoles.includes(role)) {
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
