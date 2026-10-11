import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateInHousePoolAllocation,
  normalizeInHousePoolShares,
  validateGroupFixedRateStructure,
} from '../controllers/System/groupFixedCommissionRates.service.js';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('default 8% pool with no Company Profit distributes 14.18/15.82/20/50 exactly', () => {
  const result = calculateInHousePoolAllocation({ poolRate: 8, companyProfitRate: 0 });
  assert.equal(result.division_manager_rate, 1.1344);
  assert.equal(result.sales_director_rate, 1.2656);
  assert.equal(result.unit_manager_rate, 1.6);
  assert.equal(result.sales_agent_rate, 4);
  assert.equal(result.allocated_rate, 8);
  assert.equal(result.total_accounted_rate, 8);
  assert.equal(result.remaining_rate, 0);
});

test('8% pool less 2% Company Profit distributes only the remaining 6%', () => {
  const result = calculateInHousePoolAllocation({ poolRate: 8, companyProfitRate: 2 });
  assert.equal(result.distribution_pool_rate, 6);
  assert.equal(result.division_manager_rate, 0.8508);
  assert.equal(result.sales_director_rate, 0.9492);
  assert.equal(result.unit_manager_rate, 1.2);
  assert.equal(result.sales_agent_rate, 3);
  assert.equal(result.allocated_rate, 6);
  assert.equal(result.total_accounted_rate, 8);
});

test('pool shares must total exactly 100%', () => {
  assert.deepEqual(normalizeInHousePoolShares({
    division_manager: 14.18,
    sales_director: 15.82,
    unit_manager: 20,
    sales_agent: 50,
  }), {
    division_manager: 14.18,
    sales_director: 15.82,
    unit_manager: 20,
    sales_agent: 50,
  });
  assert.throws(() => normalizeInHousePoolShares({
    division_manager: 10,
    sales_director: 10,
    unit_manager: 20,
    sales_agent: 50,
  }), /total exactly 100/i);
});

test('Company Profit must remain below the Pool Rate', () => {
  assert.throws(
    () => calculateInHousePoolAllocation({ poolRate: 8, companyProfitRate: 8 }),
    /Company Profit must be lower/i
  );
  assert.throws(
    () => calculateInHousePoolAllocation({ poolRate: 8, companyProfitRate: 9 }),
    /Company Profit must be lower/i
  );
});

test('manual role-rate inputs no longer control an In-House Network allocation', () => {
  const result = validateGroupFixedRateStructure({
    seller_group_pool_rate: 8,
    company_profit_rate: 2,
    division_manager_rate: 6,
    sales_director_rate: 0,
    unit_manager_rate: 0,
    sales_agent_rate: 0,
  }, { groupType: 'in_house' });
  assert.equal(result.division_manager_rate, 0.8508);
  assert.equal(result.sales_agent_rate, 3);
});

test('Network migration adds broker identity, CP, precision, settings, snapshots, and uniqueness guards', async () => {
  const migration = await readSource('../migrations/20261004_network_broker_company_profit_pool_distribution.sql');
  for (const field of ['broker_name', 'broker_license_number', 'realty_name', 'broker_prc_number']) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /company_profit_rate DECIMAL\(7,4\)/);
  assert.match(migration, /in_house_dm_pool_share_percent/);
  assert.match(migration, /commission_pool_rate_snapshot/);
  assert.match(migration, /role_pool_share_percent_snapshot/);
  assert.match(migration, /uq_network_broker_name_normalized/);
  assert.match(migration, /uq_network_broker_license_normalized/);
  assert.match(migration, /uq_network_realty_name_normalized/);
  assert.match(migration, /uq_network_broker_prc_normalized/);
});

test('Network controller requires unique broker identity across Network types', async () => {
  const controller = await readSource('../controllers/System/sellerGroup.controller.js');
  assert.match(controller, /normalizeNetworkBrokerFields/);
  assert.match(controller, /assertUniqueNetworkBrokerIdentity/);
  // 2026-10-05: Broker Name may repeat (warning only); the other three stay unique.
  assert.doesNotMatch(controller, /broker_name_normalized = \? OR/);
  assert.match(controller, /AND broker_name_normalized = \?/);
  assert.match(controller, /broker_license_number_normalized = \? OR/);
  assert.match(controller, /realty_name_normalized = \? OR/);
  assert.match(controller, /broker_prc_number_normalized = \?/);
});

test('active seller cannot be reassigned to another Network', async () => {
  const users = await readSource('../controllers/System/users.controllers.js');
  assert.match(users, /currentSeller\.accredited_seller_status === 'active'/);
  assert.match(users, /currently active in another Network/);
  assert.match(users, /current Network membership to Inactive/);
});


test('reservation seller options validate the seller distribution against Pool Rate less Company Profit', async () => {
  const shared = await readSource('../controllers/Lot_Projects/_shared/lotProject.shared.js');
  assert.match(shared, /'company_profit_rate'/);
  assert.match(shared, /ROUND\(group_rate\.seller_group_pool_rate - group_rate\.company_profit_rate, 4\)/);
  assert.match(shared, /companyProfitRate: Number\(row\.company_profit_rate \|\| 0\)/);
  assert.match(shared, /distributionPoolRate: Number\(row\.distribution_pool_rate \|\| 0\)/);
});

test('Network migration is TiDB-safe and does not rely on stored procedures or same-statement AFTER dependencies', async () => {
  const migration = await readSource('../migrations/20261004_network_broker_company_profit_pool_distribution.sql');
  assert.doesNotMatch(migration, /CREATE\s+PROCEDURE/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_network_broker_name_normalized/i);
  assert.match(migration, /ALTER TABLE seller_groups\s+ADD COLUMN IF NOT EXISTS broker_name[\s\S]*?;\s*ALTER TABLE seller_groups\s+ADD COLUMN IF NOT EXISTS broker_license_number/i);
  assert.match(migration, /ALTER TABLE system_settings\s+ADD COLUMN IF NOT EXISTS in_house_dm_pool_share_percent[\s\S]*?;\s*ALTER TABLE system_settings\s+ADD COLUMN IF NOT EXISTS in_house_sd_pool_share_percent/i);
});

