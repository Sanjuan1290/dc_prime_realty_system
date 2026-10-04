import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const usersController = read('server/controllers/System/users.controllers.js');
const usersRouter = read('server/routers/System/users.routers.js');
const accessController = read('server/controllers/System/accessControl.controller.js');
const migration = read('server/migrations/20260922_system_user_access_control.sql');
const usersPage = read('client/src/pages/System/Users.jsx');
const positionModal = read('client/src/components/System/userComponents/ChangePositionModal.jsx');
const deactivateModal = read('client/src/components/System/userComponents/DeactivateSystemUserModal.jsx');
const sharedAuth = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
const apiClient = read('client/src/utils/apiClient.js');

test('system accounts use permanent identity and person+role sequencing', () => {
  assert.match(migration, /person_key/);
  assert.match(migration, /role_sequence/);
  assert.match(migration, /UNIQUE KEY uq_users_person_role_sequence \(person_key, role, role_sequence\)/);
  assert.match(usersController, /getNextRoleSequence/);
  assert.match(usersController, /WHERE person_key = \? AND role = \? FOR UPDATE/);
  assert.match(usersController, /buildAccountCode/);
});

test('change-position preview keeps the same account identity instead of creating a replacement account', () => {
  assert.match(usersController, /export const previewChangeUserPosition/);
  assert.match(usersController, /same_account:\s*true/);
  assert.match(usersController, /The same user account will be retained/);
  assert.match(usersRouter, /change-position\/:id\/preview[\s\S]*SYSTEM_USERS_EDIT/);
  assert.match(positionModal, /same_account|same account|retained/i);
});

test('position transition is atomic, preserves the user id, and records immutable role history', () => {
  assert.match(usersController, /export const changeUserPosition/);
  assert.match(usersController, /UPDATE users[\s\S]*SET role = \?/);
  assert.match(usersController, /INSERT INTO user_role_history/);
  assert.match(usersController, /same_user_id:\s*true/);
  assert.match(usersController, /await connection\.commit\(\)/);
  assert.match(usersController, /await connection\.rollback\(\)/);
  assert.doesNotMatch(usersController, /replacement_user_id: newUserId/);
});

test('permanent deactivation has no reactivation route and requires password plus email verification', () => {
  assert.match(usersController, /export const requestUserDeactivationCode/);
  assert.match(usersController, /export const deactivateUserPermanently/);
  assert.match(usersRouter, /post\('\/deactivate\/:id\/code'[\s\S]*SYSTEM_USERS_DEACTIVATE[\s\S]*requireCurrentPassword/);
  assert.match(usersRouter, /patch\('\/deactivate\/:id'[\s\S]*SYSTEM_USERS_DEACTIVATE/);
  assert.doesNotMatch(usersRouter, /toggleUserStatus/);
  assert.doesNotMatch(usersPage, /Reactivate|Activate Account|toggleUserStatus/);
  assert.match(deactivateModal, /This action is permanent/);
  assert.match(deactivateModal, /can never be activated again/);
  assert.match(deactivateModal, /Deactivation Reason/);
  assert.match(deactivateModal, /Administrator Password/);
  assert.match(deactivateModal, /Email Verification Code/);
  assert.match(deactivateModal, /Verify Password & Send Code/);
  assert.match(apiClient, /user\\\/deactivate\\\/\\d\+\\\/code/);
  assert.match(deactivateModal, /confirmationHandled: 'technical'/);
  assert.match(usersController, /verifyAndConsumeSensitiveAction/);
  assert.match(usersController, /verificationMethod: 'administrator_password_email_code'/);
});

test('permanent deactivation rejects active status intent and invalidates sessions', () => {
  assert.match(usersController, /PERMANENT_DEACTIVATION_CODE = 'ACCOUNT_PERMANENTLY_DEACTIVATED'/);
  assert.match(usersController, /requestedStatus !== 'inactive'/);
  assert.match(usersController, /auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(usersController, /deactivated_at = NOW\(\)/);
  assert.match(usersController, /deactivated_by_user_id = \?/);
  assert.match(usersController, /deactivation_reason = \?/);
  assert.match(sharedAuth, /user\.status !== 'active'/);
  assert.match(sharedAuth, /decoded\.authVersion/);
});

test('historical inactive system accounts cannot have access or credentials changed', () => {
  assert.match(accessController, /historical account is permanently deactivated and its access can no longer be changed/);
  assert.match(accessController, /historical account is permanently deactivated and its permissions can no longer be reset/);
  assert.match(usersController, /Create a new account instead of resetting historical credentials/);
  assert.match(usersPage, /canViewAccess && user\.status === 'active'/);
  assert.match(usersPage, /canManageTarget/);
});


test('deactivation and password reset do not silently require Edit Users', () => {
  assert.match(usersController, /actorCanPerformUserAction/);
  assert.match(usersRouter, /deactivate\/:id[\s\S]*SYSTEM_USERS_DEACTIVATE/);
  assert.match(usersRouter, /resetPassword\/:id[\s\S]*SYSTEM_USERS_RESET_PASSWORD/);
  assert.doesNotMatch(usersController, /permission to deactivate this account[\s\S]*SYSTEM_USERS_EDIT/);
});

test('email login and forgot-password resolve only the active login account', () => {
  assert.match(migration, /active_login_email/);
  assert.match(migration, /status = 'active' AND can_login = 1 AND is_system_account = 0/);
  assert.match(migration, /UNIQUE KEY uq_users_active_login_email/);
  assert.match(usersController, /login[\s\S]*LOWER\(email\) = LOWER\(\?\)[\s\S]*status = 'active'[\s\S]*can_login = 1[\s\S]*is_system_account = 0/);
  assert.doesNotMatch(usersController, /login[\s\S]{0,2400}\(account_code = \?\)/);
  assert.match(usersController, /requestForgotPasswordCode[\s\S]*LOWER\(email\) = LOWER\(\?\)[\s\S]*status = 'active'/);
  assert.match(usersController, /verifyForgotPasswordCode[\s\S]*row\.status !== 'active'/);
});
