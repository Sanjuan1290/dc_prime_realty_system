import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('seller group details shows recipient rates, pool totals, and member pagination', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Sales and Commission Performance/);
  assert.match(source, /\['Seller', 'Role', 'Reports Under', 'Rates', 'Status', 'Actions'\]/);
  assert.match(source, /Commission Paths/);
  assert.match(source, />Edit Path</);
  assert.match(source, />Edit Sales Rate</);
  assert.match(source, /memberRatesById/);
  assert.match(source, /memberTotalPages/);
  assert.match(source, /All \${allocationPaths\.length} path\(s\) ready/);
  assert.doesNotMatch(source, /Direct sales: Not enabled/);
  assert.doesNotMatch(source, /Parent gets/);
  assert.doesNotMatch(source, /Sales and Commission Trend/);
  assert.doesNotMatch(source, /Sales by Agent/);
  assert.doesNotMatch(source, /Project Commission Pool/);
  assert.doesNotMatch(source, /Paths With Errors/);
});

test('new and edit group forms use explicit project accreditation and pool-rate dropdowns', async () => {
  const [newGroupSource, editGroupSource, projectFieldsSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(newGroupSource, /project_rates: \[\]/);
  assert.match(newGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /Remove Project Accreditation\?/);
  assert.match(projectFieldsSource, /POOL_RATE_OPTIONS/);
  assert.match(projectFieldsSource, /<select/);
  assert.doesNotMatch(projectFieldsSource, /type="number"/);
});

test('reservation hierarchy requires allocated rates to equal the group pool', async () => {
  const source = await readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js');

  assert.match(source, /allocationDifference/);
  assert.match(source, /allocationDifference <= 0\.0001/);
  assert.match(source, /group pool is still unallocated/);
});

test('seller group router exposes analytics, member-rate, and relationship-specific path APIs', async () => {
  const source = await readSource('../routers/System/sellerGroup.routers.js');

  assert.match(source, /\/:groupId\/projects\/:projectId\/analytics/);
  assert.match(source, /\/:groupId\/projects\/:projectId\/members\/:memberId\/rates/);
  assert.match(source, /\/:groupId\/projects\/:projectId\/agents\/:agentId\/path/);
});
