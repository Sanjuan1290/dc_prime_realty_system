import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAccountCode,
  chooseNextAccountCodeSequence,
  generateUniqueAccountCode,
} from '../services/systemAccountCode.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('same surname and role advances the visible numeric account-code sequence', async () => {
  const connection = {
    async query(sql, params) {
      assert.match(sql, /SELECT account_code FROM users WHERE account_code LIKE \?/);
      assert.equal(params[0], 'CORTEZ-ADM-%');
      return [[{ account_code: 'CORTEZ-ADM-001' }]];
    },
  };
  const code = await generateUniqueAccountCode(connection, {
    lastName: 'Cortez',
    role: 'admin',
    sequence: 1,
  });
  assert.equal(code, 'CORTEZ-ADM-002');
});

test('same surname accounts continue 001, 002, 003 without collision suffixes', () => {
  const next = chooseNextAccountCodeSequence({
    existingAccountCodes: ['CORTEZ-ADM-001', 'CORTEZ-ADM-002'],
    lastName: 'Cortez',
    role: 'admin',
    minimumSequence: 1,
  });
  assert.equal(next, 3);
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', sequence: next }), 'CORTEZ-ADM-003');
});

test('legacy collision-suffix accounts consume a logical slot instead of being reproduced', () => {
  const next = chooseNextAccountCodeSequence({
    existingAccountCodes: ['CORTEZ-ADM-001', 'CORTEZ-ADM-001-2'],
    lastName: 'Cortez',
    role: 'admin',
    minimumSequence: 1,
  });
  assert.equal(next, 3);
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', sequence: next }), 'CORTEZ-ADM-003');
});

test('person role sequence remains a minimum while account code stays globally unique by surname and role', () => {
  const next = chooseNextAccountCodeSequence({
    existingAccountCodes: ['CORTEZ-MKT-001', 'CORTEZ-MKT-002'],
    lastName: 'Cortez',
    role: 'marketing',
    minimumSequence: 2,
  });
  assert.equal(next, 3);
});

test('create-user UI explains the surname plus role sequence and no longer advertises collision suffixes', () => {
  const modal = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  assert.match(modal, /CORTEZ-ADM-001 already exists[\s\S]*CORTEZ-ADM-002/);
  assert.doesNotMatch(modal, /collision suffix/i);
});
