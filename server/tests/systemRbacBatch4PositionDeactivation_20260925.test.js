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
const reactivateModal = read('client/src/components/System/userComponents/ReactivateSystemUserModal.jsx');
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

test('system-user positions are immutable and changing position requires a new account', () => {
  assert.doesNotMatch(usersController, /export const previewChangeUserPosition/);
  assert.doesNotMatch(usersController, /export const changeUserPosition/);
  assert.doesNotMatch(usersRouter, /change-position/);
  assert.match(usersController, /SYSTEM_ROLE_IMMUTABLE/);
  assert.match(usersController, /Deactivate the old account and create a new account for the new role/);
  assert.doesNotMatch(usersPage, /Change Position|ChangePositionModal/);
});

test('deactivation is owner-controlled, verified, and explicitly reversible by an owner administrator', () => {
  assert.match(usersController, /export const requestUserDeactivationCode/);
  assert.match(usersController, /export const deactivateUserPermanently/);
  assert.match(usersController, /export const reactivateUser/);
  assert.match(usersRouter, /post\('\/deactivate\/:id\/code'[\s\S]*requireExactRole\('super_admin', 'system_admin'\)[\s\S]*SYSTEM_USERS_DEACTIVATE[\s\S]*requireCurrentPassword/);
  assert.match(usersRouter, /patch\('\/deactivate\/:id'[\s\S]*requireExactRole\('super_admin', 'system_admin'\)[\s\S]*SYSTEM_USERS_DEACTIVATE/);
  assert.match(usersRouter, /post\('\/reactivate\/:id'[\s\S]*requireExactRole\('super_admin', 'system_admin'\)[\s\S]*requireCurrentPassword/);
  assert.doesNotMatch(usersRouter, /toggleUserStatus/);
  assert.match(usersPage, /Reactivate/);
  assert.match(reactivateModal, /Reactivation Reason|reactivation reason/i);
  assert.match(deactivateModal, /Deactivation Reason/);
  assert.match(deactivateModal, /Administrator Password/);
  assert.match(deactivateModal, /Email Verification Code/);
  assert.match(deactivateModal, /Verify Password & Send Code/);
  assert.match(apiClient, /user\\\/deactivate\\\/\\d\+\\\/code/);
  assert.match(deactivateModal, /confirmationHandled: 'technical'/);
  assert.match(usersController, /verifyAndConsumeSensitiveAction/);
  assert.match(usersController, /verificationMethod: 'administrator_password_email_code'/);
});

test('deactivation invalidates sessions and retains the audit trail for later owner reactivation', () => {
  assert.match(usersController, /SET status = 'inactive'/);
  assert.match(usersController, /auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(usersController, /deactivated_at = NOW\(\)/);
  assert.match(usersController, /deactivated_by_user_id = \?/);
  assert.match(usersController, /deactivation_reason = \?/);
  assert.match(usersController, /reactivatable_by_owner:\s*true/);
  assert.match(usersController, /SET status='active', deactivated_at=NULL, deactivated_by_user_id=NULL, deactivation_reason=NULL/);
  assert.match(sharedAuth, /user\.status !== 'active'/);
  assert.match(sharedAuth, /decoded\.authVersion/);
});

test('inactive system accounts stay frozen until an owner administrator reactivates them', () => {
  assert.match(accessController, /This account is deactivated\. Reactivate it before changing access/);
  assert.match(accessController, /This account is deactivated\. Reactivate it before resetting permissions/);
  assert.match(usersController, /Reactivate it before resetting login credentials/);
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

