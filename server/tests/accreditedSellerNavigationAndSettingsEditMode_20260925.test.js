import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const accredited = read('../../client/src/pages/System/Accredited.jsx');
const sellerGroup = read('../../client/src/pages/System/SellerGroup.jsx');
const sellerGroupDetails = read('../../client/src/pages/System/SellerGroupDetails.jsx');
const settings = read('../../client/src/pages/System/Settings.jsx');
const roleAccess = read('../../client/src/components/System/settingsComponents/RoleAccessControl.jsx');
const app = read('../../client/src/App.jsx');

test('Accredited Sellers is the entry point for In-House and External Groups', () => {
  assert.match(accredited, /In-House Groups/);
  assert.match(accredited, /External Groups/);
  assert.match(accredited, /SYSTEM_SELLER_GROUPS_VIEW/);
  assert.match(accredited, /accredited\/groups\/in-house/);
  assert.match(accredited, /accredited\/groups\/external/);
  assert.match(sellerGroup, /Back to Accredited Sellers/);
  assert.match(sellerGroup, /accredited\/groups/);
  assert.match(sellerGroupDetails, /accredited\/groups/);
});

test('new Accredited Seller group routes are canonical and old Users group routes redirect', () => {
  assert.match(app, /path="accredited\/groups\/in-house"/);
  assert.match(app, /path="accredited\/groups\/external"/);
  assert.match(app, /LegacySellerGroupRedirect/);
  assert.match(app, /path="users\/groups\/in-house"/);
  assert.match(app, /path="users\/groups\/external"/);
});

test('Role & Access Control only mounts while Edit Settings is active', () => {
  assert.match(settings, /canManage && isEditing \? <RoleAccessControl \/> : null/);
  assert.match(roleAccess, /Save Role Defaults/);
  assert.match(roleAccess, /Existing users keep their current permissions/);
});
