export const SELLER_ROLES = Object.freeze([
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]);

export const SELLER_ROLE_LABELS = Object.freeze({
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
});

export const REQUIRED_PARENT_ROLE = Object.freeze({
  broker: 'broker_network_manager',
  manager: 'broker',
  agent: 'manager',
});

export const isSellerRole = (role) => SELLER_ROLES.includes(String(role || ''));

export const isGroupHeadRole = (role) =>
  ['broker_network_manager', 'broker'].includes(String(role || ''));

export const getRequiredParentRole = (role) =>
  REQUIRED_PARENT_ROLE[String(role || '')] || null;

export const isValidDirectReportingPair = (childRole, parentRole) =>
  getRequiredParentRole(childRole) === String(parentRole || '');

export const getRoleRateType = (role) =>
  String(role || '') === 'agent' ? 'sales' : 'override';

export const getRoleRateLabel = (role) =>
  getRoleRateType(role) === 'sales'
    ? 'Sales commission rate'
    : 'Override commission rate';
const sellerLabel = (seller = {}) =>
  seller.full_name || seller.display_name || SELLER_ROLE_LABELS[seller.role] || 'Seller';

/**
 * Validates the live reporting chain used for new reservations. Historical
 * commission rows remain untouched, but a new reservation must use the exact
 * Agent -> Manager -> Broker -> BNM structure, ending at the group head.
 */
export const validateSellerReportingChain = (
  chain = [],
  { requireGroupHead = false } = {}
) => {
  if (!Array.isArray(chain) || !chain.length) {
    throw new Error('Assigned seller hierarchy could not be loaded.');
  }
  if (chain[0]?.role !== 'agent') {
    throw new Error('Only active sales agents can be assigned to a reservation.');
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
      throw new Error('Every seller in the commission hierarchy must belong to the same seller group.');
    }
  }

  if (requireGroupHead) {
    const terminal = chain[chain.length - 1] || {};
    if (!terminal.is_group_head || !isGroupHeadRole(terminal.role)) {
      throw new Error('Assign a Broker Network Manager or Broker as the seller group head before reserving this listing.');
    }
  }

  return true;
};
