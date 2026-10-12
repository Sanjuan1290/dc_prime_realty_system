// Read-only performance attribution. Never feeds or changes the financial snapshot KPIs.
// A sale belongs to one buyer account, one originating seller and one Network.
const amount = (value) => Number(value || 0);
const money = (value) => Math.round((amount(value) + Number.EPSILON) * 100) / 100;
const sellerKey = (id) => String(id || 'unassigned');

export const buildPerformanceRankings = ({ roster = [], sales = [], commissions = [], profits = [] } = {}) => {
  const sellerMap = new Map();
  const groupMap = new Map();
  const seenAccounts = new Set();
  const ensureSeller = (row) => {
    const id = Number(row.seller_id || row.sellerId || 0);
    const key = sellerKey(id);
    if (!sellerMap.has(key)) sellerMap.set(key, {
      id, seller: row.seller_name || row.sellerName || 'Unassigned Seller',
      role: row.seller_role || row.sellerRole || '-', group: row.group_name || row.groupName || '-',
      groupId: Number(row.group_id || row.groupId || 0), groupType: row.group_type || row.groupType || '',
      status: row.seller_status || row.status || 'active',
      units: 0, salesAmount: 0, cashCollected: 0, grossCommission: 0,
      eligibleCommission: 0, releasedCommission: 0, remainingCommission: 0,
    });
    return sellerMap.get(key);
  };
  const ensureGroup = (row) => {
    const id = Number(row.group_id || row.groupId || 0);
    const type = row.group_type || row.groupType || '';
    if (!id) return null;
    const key = String(id);
    if (!groupMap.has(key)) groupMap.set(key, {
      id, group: row.group_name || row.groupName || 'Network', groupType: type,
      payee: row.payee_name || row.payee || '-',
      units: 0, salesAmount: 0, cashCollected: 0,
      grossCommission: 0, eligibleCommission: 0, releasedCommission: 0,
      remainingCommission: 0, companyProfit: 0,
    });
    return groupMap.get(key);
  };

  // Seed the directory first: no-sale and zero-commission sellers remain ranked.
  // The query has already limited these identities to this particular project.
  for (const seller of roster) {
    if (Number(seller.seller_id || seller.sellerId || 0) > 0) ensureSeller(seller);
  }

  for (const sale of sales) {
    const account = Number(sale.account_id || sale.accountId || 0);
    if (!account || seenAccounts.has(account)) continue;
    seenAccounts.add(account);
    const row = ensureSeller(sale);
    const group = ensureGroup(sale);
    const saleAmount = amount(sale.sale_amount ?? sale.salesAmount);
    const paid = amount(sale.cash_collected ?? sale.cashCollected);
    row.units += 1;
    row.salesAmount = money(row.salesAmount + saleAmount);
    row.cashCollected = money(row.cashCollected + paid);
    if (group) {
      group.units += 1;
      group.salesAmount = money(group.salesAmount + saleAmount);
      group.cashCollected = money(group.cashCollected + paid);
    }
  }
  for (const commission of commissions) {
    const seller = ensureSeller(commission);
    for (const field of ['grossCommission', 'eligibleCommission', 'releasedCommission', 'remainingCommission']) {
      const dbKey = { grossCommission: 'gross_commission', eligibleCommission: 'eligible_commission', releasedCommission: 'released_commission', remainingCommission: 'remaining_commission' }[field];
      seller[field] = money(seller[field] + amount(commission[dbKey] ?? commission[field]));
    }
    // External partner's whole commission is payable to the Network, not Company Profit.
    const group = ensureGroup(commission);
    if (group?.groupType === 'external') {
      for (const field of ['grossCommission', 'eligibleCommission', 'releasedCommission', 'remainingCommission']) {
        const dbKey = { grossCommission: 'gross_commission', eligibleCommission: 'eligible_commission', releasedCommission: 'released_commission', remainingCommission: 'remaining_commission' }[field];
        group[field] = money(group[field] + amount(commission[dbKey] ?? commission[field]));
      }
    }
  }
  for (const profit of profits) {
    const group = ensureGroup(profit);
    if (!group || group.groupType !== 'in_house') continue;
    // Persisted payee snapshot wins over editable Network profile labels.
    if (profit.payee_name) group.payee = profit.payee_name;
    group.companyProfit = money(group.companyProfit + amount(profit.gross_profit ?? profit.companyProfit));
    group.grossCommission = money(group.grossCommission + amount(profit.gross_profit ?? profit.companyProfit));
    group.eligibleCommission = money(group.eligibleCommission + amount(profit.eligible_profit ?? profit.eligibleCommission));
    group.releasedCommission = money(group.releasedCommission + amount(profit.released_profit ?? profit.releasedCommission));
    group.remainingCommission = money(group.remainingCommission + amount(profit.remaining_profit ?? profit.remainingCommission));
  }
  const sort = (a, b) => b.salesAmount - a.salesAmount || b.units - a.units || b.grossCommission - a.grossCommission || String(a.seller || a.group).localeCompare(String(b.seller || b.group));
  return {
    sellerPerformance: [...sellerMap.values()].filter((r) => r.id > 0 || r.units || r.grossCommission).sort(sort),
    groupPerformance: [...groupMap.values()].filter((r) => r.units || r.grossCommission).sort(sort),
  };
};

// Project access is enforced by the existing dashboard route and the resolved project id.
export const loadProjectPerformance = async (connection, projectId, from, to, { hasProfit = true } = {}) => {
  const [sales] = await connection.query(`
    SELECT a.lot_project_account_id AS account_id,
           COALESCE(NULLIF(origin.sale_origin_id, 0), origin.main_seller_id, p.assigned_accredited_seller_id) AS seller_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', seller_user.first_name, seller_user.middle_name, seller_user.last_name)), ''), 'Unassigned Seller') AS seller_name,
           seller_user.role AS seller_role,
           sg.seller_group_id AS group_id, sg.seller_group_name AS group_name,
           sg.seller_group_type AS group_type,
           COALESCE(NULLIF(sg.realty_name, ''), NULLIF(sg.broker_name, ''), sg.seller_group_name) AS payee_name,
           COALESCE(p.soa_selected_tcp, l.lot_project_listing_tcp, 0) AS sale_amount,
           COALESCE(payments.cash_collected, 0) AS cash_collected
    FROM lot_project_accounts a
    JOIN lot_project_client_profiles p ON p.lot_project_client_profile_id = a.lot_project_client_profile_id
    JOIN lot_project_listings l ON l.lot_project_listing_id = a.lot_project_listing_id
    LEFT JOIN (
      SELECT lot_project_account_id, MAX(sale_origin_accredited_seller_id) AS sale_origin_id,
             MAX(CASE WHEN commission_seller_type = 'main_seller' THEN accredited_seller_id ELSE NULL END) AS main_seller_id
      FROM lot_project_commissions WHERE lot_project_id = ? GROUP BY lot_project_account_id
    ) origin ON origin.lot_project_account_id = a.lot_project_account_id
    LEFT JOIN accredited_sellers s ON s.accredited_seller_id = COALESCE(NULLIF(origin.sale_origin_id, 0), origin.main_seller_id, p.assigned_accredited_seller_id)
    LEFT JOIN users seller_user ON seller_user.id = s.user_id
    LEFT JOIN seller_groups sg ON sg.seller_group_id = s.seller_group_id
    LEFT JOIN (
      SELECT lot_project_account_id, SUM(lot_project_payment_amount) AS cash_collected
      FROM lot_project_payments
      WHERE lot_project_id = ? AND lot_project_payment_status = 'Verified'
        AND lot_project_payment_date BETWEEN ? AND ?
      GROUP BY lot_project_account_id
    ) payments ON payments.lot_project_account_id = a.lot_project_account_id
    WHERE a.lot_project_id = ? AND a.account_status IN ('active','pending_cancellation','closed_fully_paid')
      AND DATE(COALESCE(a.reservation_date, p.lot_project_client_profile_created_at)) BETWEEN ? AND ?
    ORDER BY a.lot_project_account_id ASC
  `, [projectId, projectId, from, to, projectId, from, to]);
  const [commissions] = await connection.query(`
    SELECT c.accredited_seller_id AS seller_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), c.seller_display_name_snapshot, 'Unassigned Seller') AS seller_name,
           c.commission_role AS seller_role,
           sg.seller_group_id AS group_id, COALESCE(sg.seller_group_name, c.seller_group_name_snapshot) AS group_name,
           sg.seller_group_type AS group_type,
           COALESCE(NULLIF(sg.realty_name, ''), NULLIF(sg.broker_name, ''), sg.seller_group_name) AS payee_name,
           SUM(c.gross_commission_amount) AS gross_commission,
           SUM(COALESCE(rel.eligible_commission,0)) AS eligible_commission,
           SUM(COALESCE(rel.released_commission,0)) AS released_commission,
           SUM(GREATEST(c.gross_commission_amount - COALESCE(rel.released_commission,0) - COALESCE(rel.released_deductions,0),0)) AS remaining_commission
    FROM lot_project_commissions c
    JOIN lot_project_accounts a ON a.lot_project_account_id = c.lot_project_account_id
    JOIN lot_project_client_profiles p ON p.lot_project_client_profile_id = a.lot_project_client_profile_id
    LEFT JOIN accredited_sellers s ON s.accredited_seller_id = c.accredited_seller_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN seller_groups sg ON sg.seller_group_id = s.seller_group_id
    LEFT JOIN (
      SELECT lot_project_commission_id,
        SUM(CASE WHEN release_status IN ('Eligible','Released','Earned on Cancellation') THEN net_release_amount ELSE 0 END) AS eligible_commission,
        SUM(CASE WHEN release_status = 'Released' THEN net_release_amount ELSE 0 END) AS released_commission,
        SUM(CASE WHEN release_status = 'Released' THEN deduction_amount ELSE 0 END) AS released_deductions
      FROM lot_project_commission_releases GROUP BY lot_project_commission_id
    ) rel ON rel.lot_project_commission_id = c.lot_project_commission_id
    WHERE c.lot_project_id = ? AND a.account_status IN ('active','pending_cancellation','closed_fully_paid')
      AND DATE(COALESCE(a.reservation_date, p.lot_project_client_profile_created_at)) BETWEEN ? AND ?
    GROUP BY c.accredited_seller_id, seller_name, c.commission_role,
             sg.seller_group_id, group_name, sg.seller_group_type, payee_name
  `, [projectId, from, to]);
  let profits = [];
  if (hasProfit) {
    const [rows] = await connection.query(`
      SELECT n.seller_group_id AS group_id, n.network_name_snapshot AS group_name,
             'in_house' AS group_type, n.payee_name_snapshot AS payee_name,
             SUM(n.gross_profit_snapshot) AS gross_profit,
             SUM(COALESCE(rel.eligible_profit,0)) AS eligible_profit,
             SUM(COALESCE(rel.released_profit,0)) AS released_profit,
             SUM(GREATEST(n.gross_profit_snapshot - COALESCE(rel.released_profit,0),0)) AS remaining_profit
      FROM lot_project_network_profit_accounts n
      JOIN lot_project_accounts a ON a.lot_project_account_id = n.lot_project_account_id
      JOIN lot_project_client_profiles p ON p.lot_project_client_profile_id = a.lot_project_client_profile_id
      LEFT JOIN (
        SELECT profit_account_id,
          SUM(CASE WHEN release_status = 'Released' THEN release_amount ELSE 0 END) AS released_profit,
          SUM(CASE WHEN release_status = 'Released' THEN release_amount ELSE 0 END) AS eligible_profit
        FROM lot_project_network_profit_releases GROUP BY profit_account_id
      ) rel ON rel.profit_account_id = n.id
      WHERE n.lot_project_id = ? AND a.account_status IN ('active','pending_cancellation','closed_fully_paid')
        AND DATE(COALESCE(a.reservation_date, p.lot_project_client_profile_created_at)) BETWEEN ? AND ?
      GROUP BY n.seller_group_id, n.network_name_snapshot, n.payee_name_snapshot
    `, [projectId, from, to]);
    profits = rows;
  }
  // Membership comes from the current project accreditation, not from a sale.
  // Include previously involved sellers even if their accreditation was later disabled,
  // but exclude synthetic hierarchy placeholders. Neither earnings nor payments change.
  const [roster] = await connection.query(`
    SELECT s.accredited_seller_id AS seller_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), 'Unnamed Seller') AS seller_name,
           u.role AS seller_role, s.accredited_seller_status AS seller_status,
           sg.seller_group_id AS group_id, sg.seller_group_name AS group_name,
           sg.seller_group_type AS group_type
    FROM accredited_sellers s
    INNER JOIN users u ON u.id = s.user_id
    LEFT JOIN seller_groups sg ON sg.seller_group_id = s.seller_group_id
    WHERE COALESCE(s.is_system_dummy, 0) = 0
      AND (
        EXISTS (
          SELECT 1 FROM seller_group_lot_project_rates gr
          WHERE gr.seller_group_id = s.seller_group_id
            AND gr.lot_project_id = ?
            AND gr.seller_group_lot_project_rate_status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM accredited_seller_lot_project_rates sr
          WHERE sr.accredited_seller_id = s.accredited_seller_id
            AND sr.lot_project_id = ?
            AND sr.accredited_seller_lot_project_rate_status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM lot_project_commissions c
          WHERE c.accredited_seller_id = s.accredited_seller_id
            AND c.lot_project_id = ?
        )
      )
    ORDER BY seller_name ASC, s.accredited_seller_id ASC
  `, [projectId, projectId, projectId]);
  return buildPerformanceRankings({ roster, sales, commissions, profits });
};
