import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = file => readFileSync(resolve(root, file), 'utf8')
const key = 'system.seller_groups.members.deactivate_empty_manager'

test('frontend and backend register the identical independent permission', () => {
  for (const path of ['client/src/config/permissions.js','server/config/permissions.js']) {
    assert.match(read(path), /SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER: 'system\.seller_groups\.members\.deactivate_empty_manager'/)
  }
})
test('permission catalog is combined and contains every existing seller and network permission',()=>{
  const source = read('server/controllers/System/accessControl.controller.js')
  assert.match(source, /group: 'Accredited Sellers & Networks'/)
  assert.doesNotMatch(source, /group: 'Accredited Sellers',/)
  assert.doesNotMatch(source, /group: 'Seller Groups',/)
  for (const id of ['SYSTEM_ACCREDITED_VIEW','SYSTEM_ACCREDITED_PRINT','SYSTEM_ACCREDITED_UPLOAD_PROOF','SYSTEM_SELLER_GROUPS_VIEW','SYSTEM_SELLER_GROUPS_MANAGE','SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER']) assert.match(source, new RegExp('PERMISSIONS\.' + id))
})
test('marketing role recommendations contain the specific permission, other staff do not inherit it',()=>{
  const source=read('server/config/recommendedRolePermissions.js')
  const section=source.split('marketing_staff: Object.freeze([')[1].split(']),')[0]
  assert.match(section,/PERMISSIONS.SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER/)
  for(const sectionName of ['sales_staff','accounting_staff','operations_staff']){
    const section=source.split(sectionName+': Object.freeze([')[1].split(']),')[0]
    assert.doesNotMatch(section,/SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER/)
  }
})
test('route requires the new permission but does not require broad user editing',()=>{
  const src=read('server/routers/System/sellerGroup.routers.js')
  const block=src.split("router.post('/:groupId/managers/:userId/deactivate-empty',")[1].split('deactivateEmptyManager);')[0]
  assert.match(block,/requirePermission\(PERMISSIONS.SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER\)/)
  assert.doesNotMatch(block,/SYSTEM_USERS_EDIT|SYSTEM_SELLER_GROUPS_MANAGE|requireExactRole/)
})
test('UI uses new permission and explicit confirmation instead of technical bypass',()=>{
  const page=read('client/src/pages/System/SellerGroupDetails.jsx')
  const modal=read('client/src/components/System/sellerGroupComponents/DeactivateEmptyManagerModal.jsx')
  assert.match(page,/hasPermission\(actor, PERMISSIONS.SYSTEM_SELLER_GROUPS_DEACTIVATE_EMPTY_MANAGER\)/)
  assert.match(modal,/confirmationHandled: 'compact'/)
  assert.doesNotMatch(modal,/confirmationHandled: 'technical'/)
  assert.match(modal,/confirmDeactivation: true/)
})
test('server keeps role/head/reports, audit and review guards',()=>{
  const code=read('server/controllers/System/sellerManagerReplacement.controller.js')
  for(const k of ['plan.replacesNetworkHead','plan.directReports.length','plan.totalAffected', 'accredited_seller_managed_sellers', 'createOperationalReview', 'writeAuditLog', 'confirmDeactivation !== true']) assert.ok(code.includes(k),k)
})
test('migration is idempotent and does not widen previously missing permissions',()=>{
  const sql=read('server/migrations/20261025_unified_seller_network_empty_manager_access.sql')
  assert.match(sql,/INSERT IGNORE INTO role_permission_defaults/)
  assert.match(sql,/NOT EXISTS \(/)
  assert.match(sql,/m\.allowed = 1/)
  assert.match(sql,/e\.allowed = 1/)
  assert.doesNotMatch(sql,/DELETE FROM|UPDATE users|UPDATE accredited_sellers/)
  assert.ok(sql.includes(key))
})
