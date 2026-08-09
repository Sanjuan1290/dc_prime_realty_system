export const IN_HOUSE_SELLER_ROLES = Object.freeze([
  'division_manager',
  'sales_director',
  'unit_manager',
  'sales_agent',
]);

export const SELLER_ROLE_LABELS = Object.freeze({
  division_manager: 'Division Manager',
  sales_director: 'Sales Director',
  unit_manager: 'Unit Manager',
  sales_agent: 'Sales Agent',
  external_group: 'External Group',
});

export const REQUIRED_PARENT_ROLE = Object.freeze({
  sales_director: 'division_manager',
  unit_manager: 'sales_director',
  sales_agent: 'unit_manager',
});

export const getSellerRoleLabel = (role) =>
  SELLER_ROLE_LABELS[String(role || '')] || String(role || '').replaceAll('_', ' ');

export const getRequiredParentRole = (role) =>
  REQUIRED_PARENT_ROLE[String(role || '')] || '';

export const isInHouseSellerRole = (role) =>
  IN_HOUSE_SELLER_ROLES.includes(String(role || ''));

