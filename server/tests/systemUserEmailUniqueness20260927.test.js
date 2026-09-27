import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Create System User checks email availability before leaving Personal Information', () => {
  const modal = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  assert.match(modal, /email-availability\?email=/);
  assert.match(modal, /Checking email availability/);
  assert.match(modal, /emailAvailabilityMutation\.mutateAsync/);
  assert.match(modal, /if \(!result\?\.available\)/);
});

test('email availability endpoint rejects any email already stored in users', () => {
  const router = read('server/routers/System/users.routers.js');
  const controller = read('server/controllers/System/users.controllers.js');
  assert.match(router, /\/email-availability/);
  assert.match(controller, /checkSystemUserEmailAvailability/);
  assert.match(controller, /LOWER\(TRIM\(email\)\) = LOWER\(\?\)/);
  assert.match(controller, /USER_EMAIL_ALREADY_EXISTS/);
});

test('final create endpoint rechecks duplicate email server-side', () => {
  const controller = read('server/controllers/System/users.controllers.js');
  const createBlock = controller.slice(controller.indexOf('export const createUser'), controller.indexOf('export const editUser'));
  assert.match(createBlock, /existingEmailRows/);
  assert.match(createBlock, /status\(409\)/);
  assert.match(createBlock, /USER_EMAIL_ALREADY_EXISTS/);
  assert.match(createBlock, /normalizedEmail/);
});
