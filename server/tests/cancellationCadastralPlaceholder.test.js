import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('cancellation settlement never treats the display dash as a cadastral lot', () => {
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');

  assert.match(
    unitStatus,
    /\.filter\(\(item\) => item && item !== '-' && item !== '—'\)/
  );
  assert.match(controller, /const cadastralWasSubmitted = !completesCancellation && \(/);
  assert.match(
    controller,
    /\.filter\(\(item\) => item && item !== '-' && item !== '—'\)/
  );
});
