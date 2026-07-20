import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('protected document upload imports and uses columnExists', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js');

  assert.match(
    controller,
    /import\s*\{[\s\S]*?columnExists[\s\S]*?\}\s*from '\.\.\/_shared\/lotProject\.shared\.js'/
  );
  assert.match(
    controller,
    /await columnExists\(connection, 'lot_project_client_documents', 'lot_project_account_id'\)/
  );
});
