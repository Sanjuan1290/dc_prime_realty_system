export const IN_HOUSE_SELLER_ROLES = Object.freeze([
  'division_manager',
  'sales_director',
  'unit_manager',
  'sales_agent',
]);

export const EXTERNAL_GROUP_ROLE = 'external_group';
export const SELLER_ROLES = IN_HOUSE_SELLER_ROLES;

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

export const isSellerRole = (role) => IN_HOUSE_SELLER_ROLES.includes(String(role || ''));
export const isExternalGroupRole = (role) => String(role || '') === EXTERNAL_GROUP_ROLE;
export const isCommissionRecipientRole = (role) => isSellerRole(role) || isExternalGroupRole(role);

export const isGroupHeadRole = (role) =>
  ['division_manager', 'sales_director'].includes(String(role || ''));

export const getRequiredParentRole = (role) =>
  REQUIRED_PARENT_ROLE[String(role || '')] || null;

export const isValidDirectReportingPair = (childRole, parentRole) =>
  getRequiredParentRole(childRole) === String(parentRole || '');

export const getRoleRateType = (role) =>
  String(role || '') === 'sales_agent' || String(role || '') === EXTERNAL_GROUP_ROLE
    ? 'sales'
    : 'override';

export const getRoleRateLabel = (role) => {
  if (String(role || '') === EXTERNAL_GROUP_ROLE) return 'External group pool rate';
  return getRoleRateType(role) === 'sales'
    ? 'Sales commission rate'
    : 'Override commission rate';
};

const sellerLabel = (seller = {}) =>
  seller.full_name || seller.display_name || SELLER_ROLE_LABELS[seller.role] || 'Seller';

/**
 * Validates the live in-house reporting chain used for new reservations.
 * Historical commission rows remain untouched, but a new reservation must use
 * the exact Sales Agent -> Unit Manager -> Sales Director -> Division Manager
 * structure, ending at the in-house group head.
 */
export const validateSellerReportingChain = (
  chain = [],
  { requireGroupHead = false } = {}
) => {
  if (!Array.isArray(chain) || !chain.length) {
    throw new Error('Assigned seller hierarchy could not be loaded.');
  }
  if (chain[0]?.role !== 'sales_agent') {
    throw new Error('Only active Sales Agents can be assigned to the in-house commission hierarchy.');
  }

  const groupId = Number(chain[0]?.seller_group_id || 0);
  for (let index = 1; index < chain.length; index += 1) {
    const child = chain[index - 1] || {};
    const parent = chain[index] || {};
    const expectedParentRole = getRequiredParentRole(child.role);

    if (!expectedParentRole || parent.role !== expectedParentRole) {
      throw new Error(
        `${sellerLabel(child)} is a ${SELLER_ROLE_LABELS[child.role] || child.role || 'seller'} and can only report under a ${SELLER_ROLE_LABELS[expectedParentRole] || 'valid parent seller'}.`
      );
    }

    if (groupId && Number(parent.seller_group_id || 0) !== groupId) {
      throw new Error('Every seller in the commission hierarchy must belong to the same in-house group.');
    }
  }

  if (requireGroupHead) {
    const terminal = chain[chain.length - 1] || {};
    if (!terminal.is_group_head || !isGroupHeadRole(terminal.role)) {
      throw new Error('Assign a Division Manager or Sales Director as the in-house group head before reserving this listing.');
    }
  }

  return true;
};

