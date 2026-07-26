import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('group details show a type-aware project commission structure and performance range', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Project Commission Structure/);
  assert.match(source, /Division Manager Rate/);
  assert.match(source, /Sales Director Rate/);
  assert.match(source, /Unit Manager Rate/);
  assert.match(source, /Sales Agent Rate/);
  assert.match(source, /External Group Rate/);
  assert.match(source, /type="date"/);
  assert.match(source, /Released commissions are grouped by actual release date/);
  assert.doesNotMatch(source, /Commission Paths/);
});

test('new and edit group forms configure in-house rates or an external Pool Rate', async () => {
  const [newGroupSource, editGroupSource, projectFieldsSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  for (const source of [newGroupSource, editGroupSource]) {
    assert.match(source, /groupType/);
    assert.match(source, /ProjectAccreditationFields/);
    assert.match(source, /Remove Project Accreditation\?/);
    assert.match(source, /external_account/);
  }
  assert.match(projectFieldsSource, /seller_group_pool_rate/);
  assert.match(projectFieldsSource, /division_manager_rate/);
  assert.match(projectFieldsSource, /sales_director_rate/);
  assert.match(projectFieldsSource, /unit_manager_rate/);
  assert.match(projectFieldsSource, /sales_agent_rate/);
  assert.match(projectFieldsSource, /Full Pool Rate/);
  assert.match(projectFieldsSource, /Allocated \$\{moneyRate\(allocated\)\}% of/);
});

test('reservation commission service branches between in-house distribution and one external recipient', async () => {
  const source = await readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js');

  assert.match(source, /fixedRates\.groupType === 'external'/);
  assert.match(source, /Only the registered External Group account/);
  assert.match(source, /saleType: 'direct'/);
  assert.match(source, /buildGroupFixedRateDistribution/);
  assert.match(source, /Math\.abs\(allocatedRate - poolRate\) > 0\.0001/);
});

test('group API filters by group type and exposes project commission editing', async () => {
  const [router, controller] = await Promise.all([
    readSource('../routers/System/sellerGroup.routers.js'),
    readSource('../controllers/System/sellerGroup.controller.js'),
  ]);

  assert.match(controller, /sg\.seller_group_type = \?/);
  assert.match(controller, /Group Type cannot be changed after creation/);
  assert.match(controller, /An External Group must contain exactly one External Group account/);
  assert.match(router, /\/:groupId\/projects\/:projectId\/analytics/);
  assert.match(router, /\/:groupId\/projects\/:projectId\/pool/);
  assert.doesNotMatch(router, /agents\/:agentId\/direct-rate/);
});

test('group member counts exclude system dummy sellers and use type-specific account totals', async () => {
  const controller = await readSource('../controllers/System/sellerGroup.controller.js');

  assert.match(controller, /COALESCE\(member\.is_system_dummy, 0\) = 0/);
  assert.match(controller, /COUNT\(DISTINCT sg\.seller_group_external_account_user_id\) AS total_accounts/);
});
