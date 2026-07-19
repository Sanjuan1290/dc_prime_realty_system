const ROLE_LEVEL = Object.freeze({
  agent: 1,
  manager: 2,
  broker: 3,
  broker_network_manager: 4,
});

const ROLE_LABEL = Object.freeze({
  agent: 'Agent',
  manager: 'Manager',
  broker: 'Broker',
  broker_network_manager: 'Broker Network Manager',
});

const asNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const formatRate = (value) => {
  const numeric = asNumber(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

/**
 * Pure hierarchy validator used by API workflows and unit tests.
 * A lower-level seller can never have a higher project ceiling rate than the
 * seller they report to. A seller also cannot be lowered below a direct child.
 */
export const validateSellerHierarchyRateSnapshot = ({
  projectName = 'Selected project',
  sellerName = 'Seller',
  sellerRate = 0,
  groupPoolRate = null,
  parent = null,
  children = [],
} = {}) => {
  const normalizedSellerRate = asNumber(sellerRate);
  const normalizedPoolRate = groupPoolRate === null || groupPoolRate === undefined
    ? null
    : asNumber(groupPoolRate);

  if (normalizedPoolRate !== null && normalizedPoolRate > 0 && normalizedSellerRate > normalizedPoolRate) {
    throw createValidationError(
      `${sellerName} rate (${formatRate(normalizedSellerRate)}%) cannot be higher than the ${projectName} group pool rate (${formatRate(normalizedPoolRate)}%).`
    );
  }

  if (parent) {
    const parentRate = asNumber(parent.rate);
    if (normalizedSellerRate > parentRate) {
      throw createValidationError(
        `${sellerName} rate (${formatRate(normalizedSellerRate)}%) cannot be greater than ${parent.name || 'the parent seller'} rate (${formatRate(parentRate)}%) for ${projectName}. A seller under another seller cannot have a higher project rate than their parent.`
      );
    }
  }

  const highestChild = [...children]
    .map((child) => ({ ...child, rate: asNumber(child.rate) }))
    .sort((left, right) => right.rate - left.rate)[0];

  if (highestChild && highestChild.rate > normalizedSellerRate) {
    throw createValidationError(
      `${sellerName} rate (${formatRate(normalizedSellerRate)}%) cannot be lower than ${highestChild.name || 'the seller below them'} rate (${formatRate(highestChild.rate)}%) for ${projectName}. Lower the child rate first or raise ${sellerName}'s rate.`
    );
  }

  return true;
};

const loadSellerContext = async (connection, accreditedSellerId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id AS reports_under_user_id,
        u.role,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS seller_name,
        CASE WHEN sg.seller_group_head_user_id = acs.user_id THEN 1 ELSE 0 END AS is_group_head
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      LEFT JOIN seller_groups sg ON sg.seller_group_id = acs.seller_group_id
      WHERE acs.accredited_seller_id = ?
      LIMIT 1
    `,
    [accreditedSellerId]
  );

  return rows[0] || null;
};

const loadParentContext = async (connection, parentUserId, projectId) => {
  if (!parentUserId) return null;

  const [rows] = await connection.query(
    `
      SELECT
        parent_acs.accredited_seller_id,
        parent_acs.user_id,
        parent_acs.seller_group_id,
        parent_user.role,
        TRIM(CONCAT_WS(' ', parent_user.first_name, parent_user.middle_name, parent_user.last_name)) AS seller_name,
        COALESCE(parent_rate.accredited_seller_project_rate, 0) AS project_rate
      FROM users parent_user
      INNER JOIN accredited_sellers parent_acs ON parent_acs.user_id = parent_user.id
      LEFT JOIN accredited_seller_lot_project_rates parent_rate
        ON parent_rate.accredited_seller_id = parent_acs.accredited_seller_id
       AND parent_rate.lot_project_id = ?
       AND parent_rate.accredited_seller_lot_project_rate_status = 'active'
      WHERE parent_user.id = ?
      LIMIT 1
    `,
    [projectId, parentUserId]
  );

  return rows[0] || null;
};

const loadGroupHeadContext = async (connection, groupId, sellerUserId, projectId) => {
  if (!groupId) return null;

  const [rows] = await connection.query(
    `
      SELECT
        head_acs.accredited_seller_id,
        head_acs.user_id,
        head_acs.seller_group_id,
        head_user.role,
        TRIM(CONCAT_WS(' ', head_user.first_name, head_user.middle_name, head_user.last_name)) AS seller_name,
        COALESCE(head_rate.accredited_seller_project_rate, 0) AS project_rate
      FROM seller_groups sg
      INNER JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
      INNER JOIN accredited_sellers head_acs ON head_acs.user_id = head_user.id
      LEFT JOIN accredited_seller_lot_project_rates head_rate
        ON head_rate.accredited_seller_id = head_acs.accredited_seller_id
       AND head_rate.lot_project_id = ?
       AND head_rate.accredited_seller_lot_project_rate_status = 'active'
      WHERE sg.seller_group_id = ?
        AND head_user.id <> ?
      LIMIT 1
    `,
    [projectId, groupId, sellerUserId]
  );

  return rows[0] || null;
};

const loadDirectChildren = async (connection, seller, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        child_acs.accredited_seller_id,
        child_acs.user_id,
        child_acs.seller_group_id,
        child_user.role,
        TRIM(CONCAT_WS(' ', child_user.first_name, child_user.middle_name, child_user.last_name)) AS seller_name,
        COALESCE(child_rate.accredited_seller_project_rate, 0) AS project_rate
      FROM accredited_sellers child_acs
      INNER JOIN users child_user ON child_user.id = child_acs.user_id
      LEFT JOIN accredited_seller_lot_project_rates child_rate
        ON child_rate.accredited_seller_id = child_acs.accredited_seller_id
       AND child_rate.lot_project_id = ?
       AND child_rate.accredited_seller_lot_project_rate_status = 'active'
      WHERE child_acs.accredited_seller_reports_under_user_id = ?
         OR (
           ? = 1
           AND child_acs.seller_group_id = ?
           AND child_acs.accredited_seller_reports_under_user_id IS NULL
           AND child_acs.user_id <> ?
         )
      ORDER BY child_rate.accredited_seller_project_rate DESC, seller_name ASC
    `,
    [
      projectId,
      seller.user_id,
      Number(seller.is_group_head || 0),
      seller.seller_group_id || 0,
      seller.user_id,
    ]
  );

  return rows;
};

const loadProjectPolicy = async (connection, groupId, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        lp.lot_project_name,
        COALESCE(group_rate.seller_group_pool_rate, 0) AS group_pool_rate
      FROM lot_projects lp
      LEFT JOIN seller_group_lot_project_rates group_rate
        ON group_rate.lot_project_id = lp.lot_project_id
       AND group_rate.seller_group_id = ?
       AND group_rate.seller_group_lot_project_rate_status = 'active'
      WHERE lp.lot_project_id = ?
      LIMIT 1
    `,
    [groupId || 0, projectId]
  );

  return rows[0] || null;
};

const assertParentRelationship = (seller, parent) => {
  if (!parent) return;

  if (Number(parent.user_id) === Number(seller.user_id)) {
    throw createValidationError('A seller cannot report under themselves.');
  }

  const sellerLevel = ROLE_LEVEL[seller.role] || 0;
  const parentLevel = ROLE_LEVEL[parent.role] || 0;
  if (!sellerLevel || !parentLevel || parentLevel <= sellerLevel) {
    throw createValidationError(
      `${seller.seller_name} (${ROLE_LABEL[seller.role] || seller.role}) must report under a higher seller role. ${parent.seller_name} is ${ROLE_LABEL[parent.role] || parent.role}.`
    );
  }

  if (
    seller.seller_group_id &&
    parent.seller_group_id &&
    Number(seller.seller_group_id) !== Number(parent.seller_group_id)
  ) {
    throw createValidationError(
      `${seller.seller_name} and ${parent.seller_name} must belong to the same seller group before they can be linked in the reporting hierarchy.`
    );
  }
};

/**
 * Validates proposed rates against the live parent and direct-child rates.
 * Call this inside the same transaction immediately before saving rate rows.
 */
export const assertSellerProjectRatesFollowHierarchy = async (
  connection,
  accreditedSellerId,
  projectRates = []
) => {
  if (!accreditedSellerId || !projectRates.length) return;

  const seller = await loadSellerContext(connection, accreditedSellerId);
  if (!seller) throw createValidationError('Seller record was not found.');

  for (const projectRate of projectRates) {
    const projectId = Number(projectRate.lot_project_id);
    if (!projectId) continue;

    const sellerRate = asNumber(
      projectRate.accredited_seller_project_rate ?? projectRate.rate ?? projectRate.seller_rate
    );

    const policy = await loadProjectPolicy(connection, seller.seller_group_id, projectId);
    const explicitParent = await loadParentContext(
      connection,
      seller.reports_under_user_id,
      projectId
    );
    const groupHeadParent = !explicitParent
      ? await loadGroupHeadContext(connection, seller.seller_group_id, seller.user_id, projectId)
      : null;
    const parent = explicitParent || groupHeadParent;
    const children = await loadDirectChildren(connection, seller, projectId);

    assertParentRelationship(seller, parent);

    validateSellerHierarchyRateSnapshot({
      projectName: policy?.lot_project_name || projectRate.lot_project_name || 'Selected project',
      sellerName: seller.seller_name,
      sellerRate,
      groupPoolRate: policy?.group_pool_rate || null,
      parent: parent
        ? { name: parent.seller_name, rate: parent.project_rate }
        : null,
      children: children.map((child) => ({
        name: child.seller_name,
        rate: child.project_rate,
      })),
    });
  }
};

