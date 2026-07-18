import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('seller group details uses one Rates column and live analytics', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Sales and Commission Performance/);
  assert.match(source, /\['Seller', 'Role', 'Reports Under', 'Rates', 'Status', 'Actions'\]/);
  assert.match(source, />Edit Rate</);
  assert.doesNotMatch(source, /Project Commission Pool/);
  assert.doesNotMatch(source, /Paths With Errors/);
});

test('new and edit group forms require explicit project accreditation fields', async () => {
  const [newGroupSource, editGroupSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
  ]);

  assert.match(newGroupSource, /project_rates: \[\]/);
  assert.match(newGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /ProjectAccreditationFields/);
  assert.match(editGroupSource, /Remove Project Accreditation\?/);
});

test('seller group router exposes analytics and unified member-rate APIs', async () => {
  const source = await readSource('../routers/System/sellerGroup.routers.js');

  assert.match(source, /\/:groupId\/projects\/:projectId\/analytics/);
  assert.match(source, /\/:groupId\/projects\/:projectId\/members\/:memberId\/rates/);
});
