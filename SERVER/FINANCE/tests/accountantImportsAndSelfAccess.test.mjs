import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {assertNotSelfAccessChange} from '../src/userAccessPolicy.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('Finance blocks a user from changing their own role or account status',()=>{
  assert.throws(()=>assertNotSelfAccessChange(12,'12'),{code:'SELF_ACCESS_CHANGE',status:403});
  assert.doesNotThrow(()=>assertNotSelfAccessChange(13,'12'));
  assert.match(read('SERVER/FINANCE/src/users.js'),/assertNotSelfAccessChange\(user\.id,actor\.id\)/);
});

test('Finance UI does not offer Edit access for the signed-in account',()=>{
  const users=read('CLIENT/FINANCE/src/FinanceUsers.jsx');
  assert.match(users,/String\(user\.id\)===String\(currentUserId\)/);
  assert.match(users,/Your account/);
});

test('Accountants can open Imports from the sidebar and Dashboard, but not Admin tools',()=>{
  const app=read('CLIENT/FINANCE/src/App.jsx');
  const dashboard=read('CLIENT/FINANCE/src/FinanceDashboard.jsx');
  assert.match(app,/const canImport=canWrite/);
  assert.match(app,/\.\.\.\(canImport\?\[\{id:'imports'/);
  assert.match(app,/tab==='imports'&&canImport&&<FinanceImport canUndo=\{canAdmin\}/);
  assert.match(dashboard,/\.\.\.\(canImport \?/);
  assert.match(dashboard,/\.\.\.\(canAdmin \?/);
});

test('Accountants can read and commit imports; only Admins can undo them',()=>{
  const server=read('SERVER/FINANCE/src/server.js');
  assert.match(server,/imports`,requireRole\('admin','accountant'\)/);
  assert.match(server,/imports\/preview`,requireRole\('admin','accountant'\),requireImportEnabled/);
  assert.match(server,/imports\/:id\/commit`,requireRole\('admin','accountant'\),requireImportEnabled/);
  assert.match(server,/imports\/:id\/undo-preview`,requireRole\('admin'\)/);
  assert.match(server,/imports\/:id\/undo`,requireRole\('admin'\)/);
  assert.match(server,/includeImport:\['admin','accountant'\]\.includes/);
});
