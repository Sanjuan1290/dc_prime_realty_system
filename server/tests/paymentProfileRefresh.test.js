import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('payment mutations refresh the exact active listing profile cache key', () => {
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(profile, /<PaymentsSOA[\s\S]*profileQueryKey=\{profileKey\}/);
  assert.match(payments, /const activeProfileKey = useMemo/);
  assert.match(payments, /accountId \|\| 'current'/);
  assert.match(payments, /queryKey: activeProfileKey,[\s\S]*exact: true,[\s\S]*refetchType: 'active'/);
  assert.match(payments, /Payment saved successfully[\s\S]*await refreshProfile\(\)/);
  assert.doesNotMatch(payments, /listing\?\.accountId \|\| 'current'/);
});
