import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), 'utf8');

test('seller group analytics returns recent sales with unit account links', async () => {
  const controller = await readSource('../controllers/System/sellerGroup.controller.js');
  const page = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(controller, /const \[recentSalesRows\] = await connection\.query/);
  assert.match(controller, /LEFT JOIN lot_project_accounts account/);
  assert.match(controller, /assigned\.seller_group_id = \?/);
  assert.match(controller, /LIMIT 10/);
  assert.match(controller, /recentSales: recentSalesRows\.map/);
  assert.match(controller, /projectSlug: group\.lot_project_slug/);

  assert.match(page, /title="Recent Sales"/);
  assert.match(page, /View Unit/);
  assert.match(page, /\/accounts\/\$\{sale\.accountId\}/);
  assert.match(page, /sale\.contractPrice/);
});

