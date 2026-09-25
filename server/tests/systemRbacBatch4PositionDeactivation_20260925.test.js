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

test('system accounts use permanent identity and person+role sequencing', () => {
  assert.match(migration, /person_key/);
  assert.match(migration, /role_sequence/);
  assert.match(migration, /UNIQUE KEY uq_users_person_role_sequence \(person_key, role, role_sequence\)/);
  assert.match(usersController, /getNextRoleSequence/);
  assert.match(usersController, /WHERE person_key = \? AND role = \? FOR UPDATE/);
  assert.match(usersController, /generateUniqueAccountCode/);
});

test('change-position preview uses the same person identity and next role sequence', () => {
  assert.match(usersController, /export const previewChangeUserPosition/);
  assert.match(usersController, /previewNextRoleSequence\(connection, personKey, newRole\)/);
  assert.match(usersController, /lastName: source\.last_name[\s\S]*role: newRole[\s\S]*sequence: roleSequence/);
  assert.match(usersRouter, /change-position\/:id\/preview[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(positionModal, /change-position\/\$\{user\.id\}\/preview/);
  assert.match(positionModal, /Replacement Account Preview/);
  assert.match(positionModal, /role_sequence/);
});

test('position transition remains atomic and preserves historical user ids', () => {
  assert.match(usersController, /export const changeUserPosition/);
  assert.match(usersController, /SELECT id, account_code, account_category, person_key, role_sequence,[\s\S]*FOR UPDATE/);
  assert.match(usersController, /const personKey = source\.person_key \|\| crypto\.randomUUID\(\)/);
  assert.match(usersController, /const roleSequence = await getNextRoleSequence\(connection, personKey, newRole\)/);
  assert.match(usersController, /SET status = 'inactive', deactivated_at = NOW\(\), deactivated_by_user_id = \?, deactivation_reason = \?,[\s\S]*auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(usersController, /INSERT INTO users \([\s\S]*account_code, account_category, person_key, role_sequence/);
  assert.match(usersController, /await connection\.commit\(\)/);
  assert.match(usersController, /await connection\.rollback\(\)/);
  assert.match(usersController, /replacement_user_id: newUserId/);
  assert.match(usersController, /previous_user_id: sourceUserId/);
  assert.doesNotMatch(usersController, /UPDATE audit_logs SET actor_user_id/);
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
  assert.match(usersPage, /isSuperAdmin && user\.status === 'active'/);
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
  assert.match(usersController, /\(account_code = \?\)[\s\S]*LOWER\(email\) = LOWER\(\?\)[\s\S]*status = 'active'/);
  assert.match(usersController, /requestForgotPasswordCode[\s\S]*LOWER\(email\) = LOWER\(\?\)[\s\S]*status = 'active'/);
  assert.match(usersController, /verifyForgotPasswordCode[\s\S]*row\.status !== 'active'/);
});
