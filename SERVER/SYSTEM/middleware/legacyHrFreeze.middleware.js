/**
 * Batch 10 – reversible legacy HR route isolation.
 * Modes: active (legacy untouched); frozen (GET only); retired (all HR routes 410).
 * Does NOT protect raw SQL, SQL jobs started in other processes, or non-HTTP writers.
 * DB-level privileges and application job inventory remain cutover gates.
 */
export const parseLegacyHrMode = value => {
  const mode = String(value ?? 'active').trim().toLowerCase();
  if (!['active','frozen','retired'].includes(mode)) throw new Error('HR_LEGACY_MODE must be active, frozen, or retired.');
  return mode;
};
const segments = path => String(path || '/').split('?')[0].replace(/\/+$/,'').toLowerCase();
const hrPrefixes = ['/employees','/attendance','/employee-payroll','/attendance-kiosk'];
export const classifyLegacyHrRoute = path => {
  const p = segments(path);
  if (hrPrefixes.some(prefix => p === prefix || p.startsWith(prefix+'/'))) return 'hr';
  // Seller Network import can UPDATE employees.linked_user_id or clear it on undo.
  if (/^\/seller-groups\/[^/]+\/members\/import\/(commit|[^/]+\/undo)$/.test(p)) return 'seller-import-hr-link';
  return null;
};
export const makeLegacyHrFreeze = modeString => {
  const mode=parseLegacyHrMode(modeString);
  return (req,res,next) => {
    if (mode === 'active') return next();
    const classification = classifyLegacyHrRoute(req.path);
    if (!classification) return next();
    const method=String(req.method||'GET').toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') return next();
    const hr=classification === 'hr';
    if (mode === 'retired' && hr) {
      res.set('Cache-Control','no-store');
      return res.status(410).json({code:'HR_MOVED_TO_INDEPENDENT_APP',message:'The legacy HR API is retired. Use the independent HR application.'});
    }
    if (!['GET','HEAD','OPTIONS'].includes(method)) {
      res.set('Cache-Control','no-store');
      return res.status(423).json({code:'LEGACY_HR_WRITES_FROZEN',message:'Legacy HR writes are disabled during system separation.'});
    }
    return next();
  };
};
