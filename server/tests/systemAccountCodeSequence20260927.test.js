import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAccountCode,
  formatUserIdForAccountCode,
  getNextUserIdPreview,
  previewAccountCode,
} from '../services/systemAccountCode.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const usersController = read('server/controllers/System/users.controllers.js');
const createModal = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
const positionModal = read('client/src/components/System/userComponents/ChangePositionModal.jsx');

test('visible account-code suffix is exactly the users table id', () => {
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', userId: 1 }), 'CORTEZ-ADM-001');
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', userId: 2 }), 'CORTEZ-ADM-002');
  assert.equal(buildAccountCode({ lastName: 'San Juan', role: 'marketing', userId: 3 }), 'SANJUAN-MKT-003');
  assert.equal(buildAccountCode({ lastName: 'Dela Cruz', role: 'sales', userId: 27 }), 'DELACRUZ-SS-027');
  assert.equal(buildAccountCode({ lastName: 'Santos', role: 'operations', userId: 1004 }), 'SANTOS-OPS-1004');
});

test('same surname does not create its own counter; different surnames still use the global users id', () => {
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', userId: 4 }), 'CORTEZ-ADM-004');
  assert.equal(buildAccountCode({ lastName: 'Reyes', role: 'admin', userId: 5 }), 'REYES-ADM-005');
  assert.equal(buildAccountCode({ lastName: 'Cortez', role: 'admin', userId: 6 }), 'CORTEZ-ADM-006');
});

test('account code refuses a missing or invalid user id', () => {
  assert.throws(() => formatUserIdForAccountCode(null), /valid users table id/i);
  assert.throws(() => buildAccountCode({ lastName: 'Cortez', role: 'admin', userId: 0 }), /valid users table id/i);
});

test('preview uses the database AUTO_INCREMENT id when available', async () => {
  const connection = {
    async query(sql) {
      assert.match(sql, /information_schema\.TABLES/);
      return [[{ next_id: 12 }]];
    },
  };
  assert.equal(await getNextUserIdPreview(connection), 12);
  assert.deepEqual(
    await previewAccountCode(connection, { lastName: 'Cortez', role: 'admin' }),
    { accountCode: 'CORTEZ-ADM-012', userId: 12 },
  );
});

test('preview falls back to max id plus one if AUTO_INCREMENT metadata is unavailable', async () => {
  let call = 0;
  const connection = {
    async query(sql) {
      call += 1;
      if (call === 1) throw new Error('metadata unavailable');
      assert.match(sql, /MAX\(id\)/);
      return [[{ next_id: 9 }]];
    },
  };
  assert.equal(await getNextUserIdPreview(connection), 9);
});

test('final create and position-change codes are rebuilt from insertId, not preview or role sequence', () => {
  assert.match(usersController, /const userId = Number\(result\.insertId\);[\s\S]*buildAccountCode\(\{ lastName: last_name, role, userId \}\)/);
  assert.match(usersController, /UPDATE users SET account_code = \? WHERE id = \?/);
  assert.match(usersController, /const newUserId = Number\(insertResult\.insertId\);[\s\S]*buildAccountCode\(\{ lastName: source\.last_name, role: newRole, userId: newUserId \}\)/);
  assert.doesNotMatch(usersController, /generateUniqueAccountCode/);
});

test('role_sequence remains separate historical identity data and is not the visible code suffix', () => {
  assert.match(usersController, /const roleSequence = await getNextRoleSequence\(connection, personKey, newRole\)/);
  assert.match(usersController, /role_sequence: roleSequence/);
  assert.match(positionModal, /Tracks this person's history in the role only/);
  assert.match(positionModal, /Users table ID/);
});

test('create-user UI explains that the account-code number is the Users table id', () => {
  assert.match(createModal, /numeric suffix represents the Users table ID/i);
  assert.match(createModal, /user ID 2 becomes CORTEZ-ADM-002/i);
  assert.doesNotMatch(createModal, /surname \+ role sequence/i);
});
