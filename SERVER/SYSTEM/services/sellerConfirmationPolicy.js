// Only the designated seller-management actions bypass a second password/email prompt.
// Permissions, status/role validation, and audit logging remain mandatory.
export const SELLER_STATUS_ROLES = Object.freeze(['sales_agent', 'unit_manager', 'sales_director', 'division_manager']);
export const isSellerStatusRole = role => SELLER_STATUS_ROLES.includes(String(role || ''));
export const usesSellerStatusConfirmation = role => isSellerStatusRole(role);
export const managerReplacementAuthMode = (role, { replacesNetworkHead = role === 'division_manager' } = {}) => {
  if (role === 'division_manager') return replacesNetworkHead ? 'email_code' : 'confirmation';
  if (role === 'unit_manager' || role === 'sales_director') return 'confirmation';
  throw Object.assign(new Error('Choose a Unit Manager, Sales Director, or Division Manager.'), {statusCode:400});
};


