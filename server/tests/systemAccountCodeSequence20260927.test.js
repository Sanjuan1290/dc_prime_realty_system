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
const loginPage = read('client/src/auth/Login.jsx');

test('visible account code is role abbreviation plus the users table id only', () => {
  assert.equal(buildAccountCode({ role: 'admin', userId: 1 }), 'ADM-00001');
  assert.equal(buildAccountCode({ role: 'admin', userId: 2 }), 'ADM-00002');
  assert.equal(buildAccountCode({ role: 'marketing', userId: 3 }), 'MKT-00003');
  assert.equal(buildAccountCode({ role: 'sales', userId: 27 }), 'SS-00027');
  assert.equal(buildAccountCode({ role: 'operations', userId: 1004 }), 'OPS-01004');
  assert.equal(buildAccountCode({ role: 'super_admin', userId: 100000 }), 'SA-100000');
});

test('surname has no effect on visible account code uniqueness', () => {
  assert.equal(buildAccountCode({ role: 'admin', userId: 4, lastName: 'Cortez' }), 'ADM-00004');
  assert.equal(buildAccountCode({ role: 'admin', userId: 5, lastName: 'Reyes' }), 'ADM-00005');
  assert.equal(buildAccountCode({ role: 'admin', userId: 6, lastName: 'Cortez' }), 'ADM-00006');
});

test('account code refuses a missing or invalid user id', () => {
  assert.throws(() => formatUserIdForAccountCode(null), /valid users table id/i);
  assert.throws(() => buildAccountCode({ role: 'admin', userId: 0 }), /valid users table id/i);
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
    await previewAccountCode(connection, { role: 'admin' }),
    { accountCode: 'ADM-00012', userId: 12 },
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

test('final create and position-change codes are rebuilt from insertId without surname', () => {
  assert.match(usersController, /const userId = Number\(result\.insertId\);[\s\S]*buildAccountCode\(\{ role, userId \}\)/);
  assert.match(usersController, /UPDATE users SET account_code = \? WHERE id = \?/);
  assert.match(usersController, /const newUserId = Number\(insertResult\.insertId\);[\s\S]*buildAccountCode\(\{ role: newRole, userId: newUserId \}\)/);
  assert.doesNotMatch(usersController, /buildAccountCode\(\{[^}]*lastName/);
});

test('role_sequence remains separate historical identity data and is not the visible code suffix', () => {
  assert.match(usersController, /const roleSequence = await getNextRoleSequence\(connection, personKey, newRole\)/);
  assert.match(usersController, /role_sequence: roleSequence/);
  assert.match(positionModal, /Tracks this person's history in the role only/);
  assert.match(positionModal, /Users table ID/);
});

test('create-user UI describes account-code format while login remains email-only', () => {
  assert.match(createModal, /role abbreviation plus the Users table ID/i);
  assert.match(createModal, /SS-00002/);
  assert.doesNotMatch(createModal, /CORTEZ-ADM/);
  assert.match(loginPage, />Email<\/span>/);
  assert.match(loginPage, /type="email"/);
  assert.doesNotMatch(loginPage, /ADM-00002/);
  assert.doesNotMatch(loginPage, /Email or Account Code/);
});
