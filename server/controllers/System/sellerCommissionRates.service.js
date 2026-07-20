import { tableExists } from '../Lot_Projects/_shared/lotProject.shared.js';

const ACTIVE = 'active';
const INACTIVE = 'inactive';

const normalizeStatus = (value) => (value === INACTIVE ? INACTIVE : ACTIVE);

const normalizeRates = (projectRates = []) => (Array.isArray(projectRates) ? projectRates : [])
  .map((rate) => ({
    lot_project_id: Number(rate?.lot_project_id || 0),
    rate: Number(rate?.accredited_seller_project_rate ?? rate?.rate ?? rate?.seller_rate ?? 0),
    status: normalizeStatus(
      rate?.accredited_seller_lot_project_rate_status
      ?? rate?.rate_status
      ?? rate?.status
    ),
  }))
  .filter((rate) => rate.lot_project_id && Number.isFinite(rate.rate));

const getSellerContext = async (connection, accreditedSellerId) => {
  const [rows] = await connection.query(
    `
      SELECT
        seller.accredited_seller_id,
        seller.user_id,
        seller.seller_group_id,
        seller.accredited_seller_reports_under_user_id,
        user.role,
        CASE WHEN group_row.seller_group_head_user_id = seller.user_id THEN 1 ELSE 0 END AS is_group_head
      FROM accredited_sellers seller
      INNER JOIN users user ON user.id = seller.user_id
      LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
      WHERE seller.accredited_seller_id = ?
      LIMIT 1
    `,
    [accreditedSellerId]
  );

  return rows[0] || null;
};

const upsertDirectRates = async (connection, accreditedSellerId, projectRates) => {
  if (!(await tableExists(connection, 'agent_lot_project_direct_rates')) || !projectRates.length) return;

  await connection.query(
    `
      INSERT INTO agent_lot_project_direct_rates (
        accredited_seller_id,
        lot_project_id,
        direct_rate,
        direct_rate_status
      ) VALUES ${projectRates.map(() => '(?, ?, ?, ?)').join(', ')}
      ON DUPLICATE KEY UPDATE
        direct_rate = VALUES(direct_rate),
        direct_rate_status = VALUES(direct_rate_status)
    `,
    projectRates.flatMap((rate) => [
      accreditedSellerId,
      rate.lot_project_id,
      rate.rate,
      rate.status,
    ])
  );
};

const syncParentOverrides = async (connection, seller, projectRates) => {
  if (!(await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) || !projectRates.length) return;

  for (const projectRate of projectRates) {
    // Every manager, broker, and BNM owns one override rate per project. The
    // relationship table mirrors that rate for every seller directly below them.
    await connection.query(
      `
        INSERT INTO seller_hierarchy_lot_project_overrides (
          child_accredited_seller_id,
          parent_accredited_seller_id,
          lot_project_id,
          override_rate,
          override_rate_status
        )
        SELECT
          child.accredited_seller_id,
          ?,
          ?,
          ?,
          ?
        FROM accredited_sellers child
        WHERE child.seller_group_id = ?
          AND child.accredited_seller_id <> ?
          AND (
            child.accredited_seller_reports_under_user_id = ?
            OR (
              ? = 1
              AND child.accredited_seller_reports_under_user_id IS NULL
              AND child.user_id <> ?
            )
          )
        ON DUPLICATE KEY UPDATE
          override_rate = VALUES(override_rate),
          override_rate_status = VALUES(override_rate_status)
      `,
      [
        seller.accredited_seller_id,
        projectRate.lot_project_id,
        projectRate.rate,
        projectRate.status,
        seller.seller_group_id || 0,
        seller.accredited_seller_id,
        seller.user_id,
        Number(seller.is_group_head || 0),
        seller.user_id,
      ]
    );

    await connection.query(
      `
        UPDATE seller_hierarchy_lot_project_overrides
        SET override_rate = ?, override_rate_status = ?
        WHERE parent_accredited_seller_id = ?
          AND lot_project_id = ?
      `,
      [
        projectRate.rate,
        projectRate.status,
        seller.accredited_seller_id,
        projectRate.lot_project_id,
      ]
    );
  }
};

/**
 * Mirrors the role-based project rate into the commission tables:
 * agents own a direct sales rate; managers, brokers, and BNMs own an override.
 */
export const syncSellerRoleProjectRates = async (
  connection,
  accreditedSellerId,
  role,
  projectRates = []
) => {
  const normalizedRates = normalizeRates(projectRates);
  if (!accreditedSellerId || !normalizedRates.length) return;

  const seller = await getSellerContext(connection, accreditedSellerId);
  if (!seller) return;

  if (role === 'agent') {
    await upsertDirectRates(connection, accreditedSellerId, normalizedRates);
    if (await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) {
      await connection.query(
        `UPDATE seller_hierarchy_lot_project_overrides SET override_rate_status = 'inactive' WHERE parent_accredited_seller_id = ?`,
        [accreditedSellerId]
      );
    }
    return;
  }

  if (await tableExists(connection, 'agent_lot_project_direct_rates')) {
    await connection.query(
      `UPDATE agent_lot_project_direct_rates SET direct_rate_status = 'inactive' WHERE accredited_seller_id = ?`,
      [accreditedSellerId]
    );
  }
  await syncParentOverrides(connection, seller, normalizedRates);
};

const resolveCurrentParent = async (connection, child) => {
  if (child.accredited_seller_reports_under_user_id) {
    const [rows] = await connection.query(
      `
        SELECT seller.accredited_seller_id, seller.user_id, user.role
        FROM accredited_sellers seller
        INNER JOIN users user ON user.id = seller.user_id
        WHERE seller.user_id = ?
          AND seller.seller_group_id = ?
        LIMIT 1
      `,
      [child.accredited_seller_reports_under_user_id, child.seller_group_id]
    );
    return rows[0] || null;
  }

  const [rows] = await connection.query(
    `
      SELECT seller.accredited_seller_id, seller.user_id, user.role
      FROM seller_groups group_row
      INNER JOIN accredited_sellers seller ON seller.user_id = group_row.seller_group_head_user_id
      INNER JOIN users user ON user.id = seller.user_id
      WHERE group_row.seller_group_id = ?
        AND seller.accredited_seller_id <> ?
      LIMIT 1
    `,
    [child.seller_group_id, child.accredited_seller_id]
  );
  return rows[0] || null;
};

/**
 * Rebuilds the one active override edge for a seller after its parent or group
 * changes. The parent project rate is copied to the relationship row.
 */
export const syncChildOverrideFromCurrentParent = async (connection, childAccreditedSellerId) => {
  if (!(await tableExists(connection, 'seller_hierarchy_lot_project_overrides'))) return;

  const child = await getSellerContext(connection, childAccreditedSellerId);
  if (!child) return;

  await connection.query(
    `UPDATE seller_hierarchy_lot_project_overrides SET override_rate_status = 'inactive' WHERE child_accredited_seller_id = ?`,
    [childAccreditedSellerId]
  );

  const parent = await resolveCurrentParent(connection, child);
  if (!parent || parent.role === 'agent') return;

  await connection.query(
    `
      INSERT INTO seller_hierarchy_lot_project_overrides (
        child_accredited_seller_id,
        parent_accredited_seller_id,
        lot_project_id,
        override_rate,
        override_rate_status
      )
      SELECT
        ?,
        ?,
        parent_rate.lot_project_id,
        parent_rate.accredited_seller_project_rate,
        parent_rate.accredited_seller_lot_project_rate_status
      FROM accredited_seller_lot_project_rates parent_rate
      WHERE parent_rate.accredited_seller_id = ?
      ON DUPLICATE KEY UPDATE
        override_rate = VALUES(override_rate),
        override_rate_status = VALUES(override_rate_status)
    `,
    [childAccreditedSellerId, parent.accredited_seller_id, parent.accredited_seller_id]
  );
};

/** Rebuilds fallback edges for members that report directly to the group head. */
export const syncGroupHeadFallbackOverrides = async (connection, sellerGroupId) => {
  if (!sellerGroupId || !(await tableExists(connection, 'seller_hierarchy_lot_project_overrides'))) return;

  const [children] = await connection.query(
    `
      SELECT child.accredited_seller_id
      FROM accredited_sellers child
      INNER JOIN seller_groups group_row ON group_row.seller_group_id = child.seller_group_id
      WHERE child.seller_group_id = ?
        AND child.accredited_seller_reports_under_user_id IS NULL
        AND child.user_id <> COALESCE(group_row.seller_group_head_user_id, 0)
        AND COALESCE(child.is_system_dummy, 0) = 0
    `,
    [sellerGroupId]
  );

  for (const child of children) {
    await syncChildOverrideFromCurrentParent(connection, child.accredited_seller_id);
  }
};

