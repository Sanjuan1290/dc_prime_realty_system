import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('import history and undo preview lock normal undo exactly 24 hours after commit',()=>{
  const service=read('SERVER/FINANCE/src/importService.js');
  const undo=read('SERVER/FINANCE/src/importUndo.js');
  assert.match(service,/UTC_TIMESTAMP\(\) >= DATE_ADD\(b\.committed_at, INTERVAL 24 HOUR\)/);
  assert.match(undo,/UTC_TIMESTAMP\(\) >= DATE_ADD\(committed_at, INTERVAL 24 HOUR\)/);
  assert.match(undo,/committed_at IS NULL/);
});

test('old-import override is limited to the current active Finance Admin and verifies their password',()=>{
  const undo=read('SERVER/FINANCE/src/importUndo.js');
  assert.match(undo,/actor\?\.role!=='admin'/);
  assert.match(undo,/SELECT id,email,display_name,role,password_hash,is_active FROM finance_users WHERE id=\? FOR UPDATE/);
  assert.match(undo,/Number\(user\.is_active\)!==1\|\|user\.role!=='admin'/);
  assert.match(undo,/verifyPassword\(password,user\.password_hash\)/);
  assert.match(undo,/UNDO_OVERRIDE_NOT_REQUIRED/);
});

test('one-time email code is hashed, import-bound, actor-bound, time-limited and attempt-limited',()=>{
  const undo=read('SERVER/FINANCE/src/importUndo.js');
  const verification=read('SERVER/FINANCE/src/importUndoVerification.js');
  const email=read('SERVER/FINANCE/src/importUndoEmail.js');
  assert.match(undo,/hashUndoVerificationCode\(code\)/);
  assert.match(undo,/hashUndoReviewToken\(reviewToken\)/);
  assert.match(undo,/admin_user_id,review_token_hash,code_salt,code_hash,expires_at,attempts/);
  assert.match(undo,/INTERVAL \$\{UNDO_CODE_TTL_SECONDS\} SECOND/);
  assert.match(undo,/attempts\+1/);
  assert.match(verification,/UNDO_CODE_MAX_ATTEMPTS = 5/);
  assert.match(verification,/UNDO_CODE_TTL_SECONDS = 10 \* 60/);
  assert.match(email,/to: \[email\]/);
  assert.match(email,/Do not share this code/);
});

test('final undo rechecks current Admin access and binds the code to the same batch and reviewed balance',()=>{
  const undo=read('SERVER/FINANCE/src/importUndo.js');
  assert.match(undo,/SELECT id,role,is_active FROM finance_users WHERE id=\? FOR UPDATE/);
  assert.match(undo,/admin_user_id=\? FOR UPDATE/);
  assert.match(undo,/WHERE id=\? AND batch_id=\? AND admin_user_id=\? FOR UPDATE/);
  assert.match(undo,/challenge\.review_token_hash!==hashUndoReviewToken\(token\)/);
  assert.match(undo,/challenge\.consumed_at/);
  assert.match(undo,/SET consumed_at=UTC_TIMESTAMP\(\) WHERE id=\? AND consumed_at IS NULL/);
  assert.match(undo,/finance\.import\.undo_override\.used/);
});

test('Admin override route is protected and password changes invalidate pending override codes',()=>{
  const server=read('SERVER/FINANCE/src/server.js');
  const auth=read('SERVER/FINANCE/src/auth.js');
  assert.match(server,/imports\/:id\/undo-authorization`,requireRole\('admin'\)/);
  assert.match(server,/imports\/:id\/undo`,requireRole\('admin'\)/);
  assert.match(auth,/UPDATE finance_import_undo_authorizations SET consumed_at=UTC_TIMESTAMP\(\) WHERE admin_user_id=\? AND consumed_at IS NULL/);
});

test('Finance creates the override authorization table at startup and includes a manual migration',()=>{
  const schema=read('SERVER/FINANCE/src/liveSchema.js');
  const migration=read('SERVER/FINANCE/migrations/09_import_undo_admin_override.sql');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS finance_import_undo_authorizations/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS finance_import_undo_authorizations/);
  assert.match(migration,/code_hash CHAR\(64\)/);
  assert.doesNotMatch(migration,/verification_code VARCHAR|plain_code/);
});

test('UI requires a reason and uses Admin override only after server-reported expiry',()=>{
  const ui=read('CLIENT/FINANCE/src/FinanceImport.jsx');
  assert.match(ui,/batch\.undo_locked\?'Admin override':'Undo import'/);
  assert.match(ui,/The 24-hour undo window has expired/);
  assert.match(ui,/Current Finance Admin password/);
  assert.match(ui,/Email verification code/);
  assert.match(ui,/reason\.trim\(\)\.length<5/);
  assert.match(ui,/\(canUndo\?\<\><button/);
});
