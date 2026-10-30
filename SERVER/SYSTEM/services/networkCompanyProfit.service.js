// Network Company Profit is NOT an accredited seller's personal commission.
// Payout terms are snapshotted once for each buyer account + in-house Network.
import { tableExists } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

import { splitNetworkProfit, roundProfitMoney } from './networkCompanyProfitTerms.js';
// Called inside the existing reservation transaction, after seller commission lines
// are created. UNIQUE(account, network) and UNIQUE(account, stage) guarantee idempotency.
export const provisionNetworkCompanyProfit = async (connection, {
  projectId, listingId, clientProfileId, networkId, commissionBase,
  companyProfitRate, sourceCommissionId,
} = {}) => {
  if (!networkId || Number(companyProfitRate || 0) <= 0) return null;
  if (!(await tableExists(connection, 'lot_project_network_profit_accounts'))) return null; // migration not deployed yet
  const [[network]] = await connection.query(
    `SELECT seller_group_id, seller_group_name, seller_group_type, broker_name, realty_name
       FROM seller_groups WHERE seller_group_id = ? LIMIT 1`, [networkId]
  );
  if (network?.seller_group_type !== 'in_house') return null;
  const [[account]] = await connection.query(
    `SELECT lot_project_account_id FROM lot_project_accounts
      WHERE lot_project_client_profile_id = ? AND lot_project_id = ? LIMIT 1`,
    [clientProfileId, projectId]
  );
  if (!account?.lot_project_account_id) return null;
  const rate = Number(companyProfitRate);
  const base = roundProfitMoney(commissionBase);
  const gross = roundProfitMoney(base * rate / 100);
  if (gross <= 0) return null;
  const payee = String(network.realty_name || network.broker_name || network.seller_group_name).trim();
  await connection.query(`
    INSERT INTO lot_project_network_profit_accounts (
      lot_project_id, lot_project_listing_id, lot_project_account_id, seller_group_id,
      source_commission_id, network_name_snapshot, broker_name_snapshot, payee_name_snapshot,
      commission_base_snapshot, company_profit_rate_snapshot, gross_profit_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id`, [
      projectId, listingId, account.lot_project_account_id, networkId,
      sourceCommissionId || null, network.seller_group_name,
      network.broker_name || network.seller_group_name, payee, base, rate, gross,
    ]);
  const [[profit]] = await connection.query(
    `SELECT id, gross_profit_snapshot FROM lot_project_network_profit_accounts
      WHERE lot_project_account_id = ? AND seller_group_id = ? LIMIT 1`,
    [account.lot_project_account_id, networkId]
  );
  if (!profit) throw new Error('Could not load the Network Company Profit ledger.');
  for (const stage of splitNetworkProfit(profit.gross_profit_snapshot)) {
    await connection.query(`
      INSERT INTO lot_project_network_profit_releases
        (profit_account_id, release_stage, release_trigger_percent, release_percent, release_amount)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id`,
      [profit.id, stage.stage, stage.triggerPercent, stage.releasePercent, stage.amount]
    );
  }
  return profit.id;
};


