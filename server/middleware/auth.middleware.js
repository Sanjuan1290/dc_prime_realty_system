import { getAuthenticatedUser } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

export const requireAuth = async (req, res, next) => {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({ message: 'Please login to continue.' });
  }

  req.user = user;
  return next();
};

export const requirePasswordChanged = (req, res, next) => {
  if (Number(req.user?.must_change_password || 0) === 1) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Change your temporary password before using the system.',
    });
  }

  return next();
};

export const requireRole = (...roles) => {
  const allowedRoles = new Set(roles.map(normalizeRole).filter(Boolean));

  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    if (!role || !allowedRoles.has(role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }

    return next();
  };
};

export const requireAdmin = requireRole('super_admin', 'admin');
export const requireSuperAdmin = requireRole('super_admin');
