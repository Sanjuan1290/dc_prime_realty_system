import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getGroupFixedRateForRole,
  validateGroupFixedRateStructure,
} from '../controllers/System/groupFixedCommissionRates.service.js';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('in-house Network rates are derived from the distributable Pool Rate', () => {
  const result = validateGroupFixedRateStructure({
    seller_group_pool_rate: 8,
    company_profit_rate: 2,
  }, { groupType: 'in_house' });

  assert.equal(result.distribution_pool_rate, 6);
  assert.equal(result.allocated_rate, 6);
  assert.equal(result.total_accounted_rate, 8);
  assert.equal(getGroupFixedRateForRole('sales_agent', result), 3);
  assert.equal(getGroupFixedRateForRole('division_manager', result), 0.8508);
});

test('external Network accepts the full Pool Rate with no in-house distribution', () => {
  const result = validateGroupFixedRateStructure({ seller_group_pool_rate: 8 }, { groupType: 'external' });
  assert.equal(result.seller_group_type, 'external');
  assert.equal(result.allocated_rate, 8);
  assert.equal(result.company_profit_rate, 0);
  assert.equal(result.division_manager_rate, 0);
  assert.equal(result.sales_agent_rate, 0);
  assert.equal(getGroupFixedRateForRole('external_group', result), 8);
});

test('migration renames persisted roles and adds external Network and reservation types', async () => {
  const migration = await readSource('../migrations/20260725_in_house_external_groups_and_role_rename.sql');
  assert.match(migration, /WHEN 'broker_network_manager' THEN 'division_manager'/);
  assert.match(migration, /WHEN 'broker' THEN 'sales_director'/);
  assert.match(migration, /WHEN 'manager' THEN 'unit_manager'/);
  assert.match(migration, /WHEN 'agent' THEN 'sales_agent'/);
  assert.match(migration, /seller_group_type/);
  assert.match(migration, /seller_group_external_account_user_id/);
  assert.match(migration, /'external_group'/);
  assert.match(migration, /sale_channel ENUM\([\s\S]*'external_group'/);
});

test('reservation and reports include External Networks as one commission recipient', async () => {
  const [shared, hierarchy, reserve, proof] = await Promise.all([
    readSource('../controllers/Lot_Projects/_shared/lotProject.shared.js'),
    readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js'),
    readSource('../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx'),
  ]);

  assert.match(shared, /u\.role = 'sales_agent'/);
  assert.match(shared, /u\.role = 'external_group'/);
  assert.match(shared, /Full project Pool Rate paid to the External Network/);
  assert.match(hierarchy, /commissionRows = \[\{/);
  assert.match(hierarchy, /fixedRates\.groupType === 'external'/);
  assert.match(reserve, /saleChannel = isExternalGroupAccount \? 'external_group' : 'distributed'/);
  assert.match(proof, /Representative:/);
  assert.match(proof, /seller\.seller_group_name/);
});

test('Accredited Sellers owns In-House and External Network navigation', async () => {
  const [users, accredited, app, permissions] = await Promise.all([
    readSource('../../client/src/pages/System/Users.jsx'),
    readSource('../../client/src/pages/System/Accredited.jsx'),
    readSource('../../client/src/App.jsx'),
    readSource('../config/permissions.js'),
  ]);
  assert.match(users, /System Users/);
  assert.match(users, /System Admin, Auditor, Department Staff and Department Head accounts/);
  assert.doesNotMatch(users, /division_manager|sales_director|unit_manager|sales_agent|external_group/);
  assert.match(accredited, />\s*In-House Networks\s*<\/NavLink>/);
  assert.match(accredited, />\s*External Networks\s*<\/NavLink>/);
  assert.match(app, /accredited\/groups\/in-house/);
  assert.match(app, /accredited\/groups\/external/);
  assert.match(permissions, /SELLER_USER_ROLES/);
  assert.match(permissions, /'external_group'/);
});

