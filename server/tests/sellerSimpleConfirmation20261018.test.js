import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSellerStatusRole, usesSellerStatusConfirmation, managerReplacementAuthMode } from '../services/sellerConfirmationPolicy.js';
import { requiresDistinctReview } from '../services/reviewActionPolicy.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Seller status actions always have their own Review Center history',()=>{
  assert.equal(requiresDistinctReview('seller.status'),true);
  assert.equal(requiresDistinctReview('seller.manager_replace'),true);
});
test('Only accredited seller roles get direct status confirmation, not administrator accounts',()=>{
  for(const role of ['sales_agent','unit_manager','sales_director','division_manager']){
    assert.equal(isSellerStatusRole(role),true);
    assert.equal(usesSellerStatusConfirmation(role),true);
  }
  for(const role of ['super_admin','system_admin','auditor','sales_staff','external_group','']){
    assert.equal(usesSellerStatusConfirmation(role),false);
  }
});
test('Manager replacement requires email only for Division Manager Network Head',()=>{
  assert.equal(managerReplacementAuthMode('unit_manager'),'confirmation');
  assert.equal(managerReplacementAuthMode('sales_director'),'confirmation');
  assert.equal(managerReplacementAuthMode('division_manager'),'email_code');
  assert.throws(()=>managerReplacementAuthMode('sales_agent'),/Choose a Unit Manager/);
});
test('Seller confirmation cannot bypass locked role/status validation or reason requirement',()=>{
  const code=read('server/controllers/System/users.controllers.js');
  assert.match(code,/assertDeactivationTarget\(req, user, userId\)/);
  assert.match(code,/assertNoManagerDeactivation\(user\)/);
  assert.match(code,/req\.body\?\.confirmDeactivation !== true/);
  assert.match(code,/req\.body\?\.confirmActivation !== true/);
  assert.match(code,/if \(!sellerConfirmation\) \{[\s\S]*verifyAndConsumeSensitiveAction/);
  assert.match(code,/if \(sellerRoles\.has\(user\.role\)\) await checkSellerCanReactivate/);
  assert.match(code,/auth_version=COALESCE\(auth_version,0\)\+1/);
  assert.match(code,/sellerStatusRestored/);
  assert.match(code,/actionKey: 'seller\.status'/);
  assert.match(code,/actionKey:'seller\.status'/);
  assert.match(code,/verificationMethod: sellerConfirmation \? 'administrator_confirmation'/);
});
test('Manager confirmation is single transaction, binds approval to live reviewed state',()=>{
  const c=read('server/controllers/System/sellerManagerReplacement.controller.js');
  const routes=read('server/routers/System/sellerGroup.routers.js');
  assert.match(c,/managerReplacementAuthMode\(plan\.role\)/);
  assert.match(c,/expectedStateHash/);
  assert.match(c,/expectedHeadUserId/);
  assert.match(c,/req\.body\?\.confirmReplacement !== true/);
  assert.match(c,/verifyAndConsumeSensitiveAction/);
  assert.match(c,/authMode==='email_code'\?verificationId:null/);
  assert.match(c,/await assertReplacementApplied\(connection,plan\)/);
  assert.match(c,/await assertGroupCurrentPathsWithinPools\(connection,plan\.groupId\)/);
  assert.match(c,/await connection\.rollback\(\)/);
  assert.match(c,/await connection\.commit\(\)/);
  assert.match(routes,/SYSTEM_USERS_DEACTIVATE/);
  assert.doesNotMatch(routes,/replace\/code'[^\n]*requireCurrentPassword/);
});
test('UI has warnings, reasons and role-specific confirmations',()=>{
  const manager=read('client/src/components/System/sellerGroupComponents/ReplaceManagerModal.jsx');
  const deact=read('client/src/components/System/userComponents/DeactivateSystemUserModal.jsx');
  const act=read('client/src/components/System/userComponents/ReactivateSystemUserModal.jsx');
  assert.match(manager,/requiresEmail = manager\.role === 'division_manager'/);
  assert.match(manager,/expectedStateHash: plan\.stateHash/);
  assert.match(manager,/previous sales and commissions remain unchanged/i);
  assert.doesNotMatch(manager,/Administrator Password/);
  assert.match(manager,/Confirm Replacement/);
  assert.match(deact,/confirmDeactivation: true/);
  assert.match(deact,/Confirm Deactivation/);
  assert.match(act,/confirmActivation: true/);
  assert.match(act,/Confirm Activation/);
  assert.match(act,/Seller and manager assignments must be complete/);
});
test('Migration permits nullable verification for direct UM and SD confirmation',()=>{
  const sql=read('server/migrations/20261018_seller_confirmation_only_tidb.sql');
  assert.match(sql,/ALTER TABLE `seller_manager_replacements`/);
  assert.match(sql,/`verification_id` BIGINT UNSIGNED NULL/);
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});
