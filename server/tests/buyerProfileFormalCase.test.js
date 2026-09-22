import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toFormalTitleCase } from '../controllers/Lot_Projects/_shared/buyerProfileText.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('formal title case handles names, places, addresses, suffixes, and common acronyms', () => {
  assert.equal(toFormalTitleCase('robert renby'), 'Robert Renby');
  assert.equal(toFormalTitleCase('imus'), 'Imus');
  assert.equal(toFormalTitleCase("maria o'connor-santos iii"), "Maria O'Connor-Santos III");
  assert.equal(toFormalTitleCase('d&c prime realty'), 'D&C Prime Realty');
  assert.equal(toFormalTitleCase('it manager'), 'IT Manager');
  assert.equal(toFormalTitleCase('phase 2a'), 'Phase 2A');
  assert.equal(
    toFormalTitleCase('b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite'),
    'B70 L44 Cremona St. Cluster 5, Bella Vista, Brgy. Santiago, General Trias, Cavite'
  );
});

test('internal reserve and edit endpoints normalize formal buyer text before database writes', () => {
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const clientProfileController = read('server/controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js');

  for (const controller of [reserveController, clientProfileController]) {
    assert.match(controller, /import \{ toFormalTitleCase \} from '\.\.\/_shared\/buyerProfileText\.js';/);
    assert.match(controller, /const cleanNamePart = \(value\) => toFormalTitleCase\(value, 255\);/);
    assert.match(controller, /toFormalTitleCase\([^\n]*placeOfBirth/);
    assert.match(controller, /toFormalTitleCase\([^\n]*presentAddress/);
    assert.match(controller, /toFormalTitleCase\([^\n]*employerBusinessName/);
    assert.match(controller, /toFormalTitleCase\([^\n]*occupationPositionTitle/);
  }
});


