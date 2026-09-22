import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getGroupFixedRateForRole,
  validateGroupFixedRateStructure,
} from '../controllers/System/groupFixedCommissionRates.service.js';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('in-house fixed positions equal the Pool Rate using the renamed roles', () => {
  const result = validateGroupFixedRateStructure({
    seller_group_pool_rate: 8,
    division_manager_rate: 1,
    sales_director_rate: 1,
    unit_manager_rate: 1,
    sales_agent_rate: 5,
  }, { groupType: 'in_house', groupHeadRole: 'division_manager' });

  assert.equal(result.allocated_rate, 8);
  assert.equal(getGroupFixedRateForRole('sales_agent', result), 5);
  assert.equal(getGroupFixedRateForRole('division_manager', result), 1);
});

test('external structure accepts only the Pool Rate and maps it to the external account', () => {
  const result = validateGroupFixedRateStructure({ seller_group_pool_rate: 8 }, { groupType: 'external' });
  assert.equal(result.seller_group_type, 'external');
  assert.equal(result.allocated_rate, 8);
  assert.equal(result.division_manager_rate, 0);
  assert.equal(result.sales_agent_rate, 0);
  assert.equal(getGroupFixedRateForRole('external_group', result), 8);

  assert.throws(
    () => validateGroupFixedRateStructure({ seller_group_pool_rate: 8, sales_agent_rate: 1 }, { groupType: 'external' }),
    /full Pool Rate/i
  );
});

test('migration renames persisted roles and adds external group and reservation types', async () => {
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

test('reservation and reports include External Groups as one commission recipient', async () => {
  const [shared, hierarchy, reserve, proof] = await Promise.all([
    readSource('../controllers/Lot_Projects/_shared/lotProject.shared.js'),
    readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js'),
    readSource('../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx'),
  ]);

  assert.match(shared, /u\.role = 'sales_agent'/);
  assert.match(shared, /u\.role = 'external_group'/);
  assert.match(shared, /Full project Pool Rate paid to the External Group/);
  assert.match(hierarchy, /commissionRows = \[\{/);
  assert.match(hierarchy, /fixedRates\.groupType === 'external'/);
  assert.match(reserve, /saleChannel = isExternalGroupAccount \? 'external_group' : 'distributed'/);
  assert.match(proof, /Representative:/);
  assert.match(proof, /seller\.seller_group_name/);
});

test('users page separates In-House and External Group management', async () => {
  const [users, app, permissions] = await Promise.all([
    readSource('../../client/src/pages/System/Users.jsx'),
    readSource('../../client/src/App.jsx'),
    readSource('../config/permissions.js'),
  ]);
  assert.match(users, />In-House Group<\/NavLink>/);
  assert.match(users, />External Group<\/NavLink>/);
  assert.match(users, /Managed in External Groups/);
  assert.match(app, /users\/groups\/in-house/);
  assert.match(app, /users\/groups\/external/);
  assert.match(permissions, /'external_group'/);
});


