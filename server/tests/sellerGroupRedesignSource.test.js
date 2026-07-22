import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('seller group details shows one fixed project structure and scalable member pagination', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Sales and Commission Performance/);
  assert.match(source, /Fixed Project Commission Structure/);
  assert.match(source, /BNM Override/);
  assert.match(source, /Broker Override/);
  assert.match(source, /Manager Override/);
  assert.match(source, /Agent Sales Rate/);
  assert.match(source, /\['Seller', 'Role', 'Reports Under', 'Status'\]/);
  assert.match(source, /memberTotalPages/);
  assert.doesNotMatch(source, /Commission Paths/);
  assert.doesNotMatch(source, /Edit Sales Rate/);
  assert.doesNotMatch(source, /memberRatesById/);
});

test('new and edit Realty forms configure fixed role rates for every selected project', async () => {
  const [newGroupSource, editGroupSource, projectFieldsSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(newGroupSource, /project_rates: \[\]/);
  assert.match(newGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /Remove Project Accreditation\?/);
  assert.match(projectFieldsSource, /seller_group_pool_rate/);
  assert.match(projectFieldsSource, /bnm_override_rate/);
  assert.match(projectFieldsSource, /broker_override_rate/);
  assert.match(projectFieldsSource, /manager_override_rate/);
  assert.match(projectFieldsSource, /agent_rate/);
  assert.match(projectFieldsSource, /Allocated \{moneyRate\(allocated\)\}% of/);
});

test('reservation hierarchy uses fixed Realty rates and requires an exact pool allocation', async () => {
  const source = await readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js');

  assert.match(source, /loadGroupFixedCommissionRates/);
  assert.match(source, /buildGroupFixedRateDistribution/);
  assert.match(source, /Math\.abs\(allocatedRate - poolRate\) > 0\.0001/);
  assert.match(source, /Fixed group rates total/);
});

test('seller group router exposes group project rate editing and removes individual rate endpoints', async () => {
  const [router, controller] = await Promise.all([
    readSource('../routers/System/sellerGroup.routers.js'),
    readSource('../controllers/System/sellerGroup.controller.js'),
  ]);

  assert.match(router, /\/:groupId\/projects\/:projectId\/analytics/);
  assert.match(router, /\/:groupId\/projects\/:projectId\/pool/);
  assert.doesNotMatch(router, /agents\/:agentId\/direct-rate/);
  assert.doesNotMatch(router, /agents\/:agentId\/path/);
  assert.doesNotMatch(router, /children\/:childId\/override/);
  assert.doesNotMatch(router, /members\/:memberId\/rates/);
  assert.doesNotMatch(controller, /upsertAgentDirectRate/);
});

test('Realty records do not count the empty LEFT JOIN row as a member', async () => {
  const controller = await readSource('../controllers/System/sellerGroup.controller.js');

  assert.match(controller, /a\.accredited_seller_id IS NOT NULL[\s\S]*AS member_count/);
  assert.match(controller, /COALESCE\(SUM\(CASE[\s\S]*a\.accredited_seller_id IS NOT NULL[\s\S]*AS active_member_count/);
});

test('Realty performance uses the dashboard-style complete-month range filter', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /\{ value: '3_months', label: '3 Months' \}/);
  assert.match(source, /resolvePresetDateRange/);
  assert.match(source, /Preset ranges cover complete calendar months/);
  assert.match(source, /disabled=\{dateRange !== 'custom'\}/);
  assert.doesNotMatch(source, /Apply Range/);
  assert.doesNotMatch(source, /Top of hierarchy|Direct parent/);
});

