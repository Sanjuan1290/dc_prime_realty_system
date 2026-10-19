import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveAuditRecordDestination, supportedAuditRecordTypes } from '../services/auditRecordDestination.service.js'
import { getAuditEvidenceCoverage } from '../../client/src/utils/auditReportEvidence.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => fs.readFileSync(path.join(root,p),'utf8')
const allow = () => true
const fake = (...answers) => {
  let index=0
  return {queries:[],async query(sql,args){this.queries.push({sql,args});return [answers[index++] || []]}}
}
const lookup = (type, id, ...answers) => resolveAuditRecordDestination(fake(...answers), {entity_type:type,entity_id:String(id),action:'update'},'auditor',allow)

test('supported Audit Logs entity types are an explicit read-only allowlist',()=>{
  assert.ok(supportedAuditRecordTypes.includes('lot_project_listing'))
  assert.ok(supportedAuditRecordTypes.includes('lot_project_payment'))
  assert.ok(supportedAuditRecordTypes.includes('accredited_seller'))
  assert.ok(!supportedAuditRecordTypes.includes('user'))
  const service=read('server/services/auditRecordDestination.service.js')
  assert.doesNotMatch(service,/\b(?:INSERT INTO|DELETE FROM|UPDATE [a-z_]+ SET)\b/i)
  assert.ok(!read('server/routers/System/auditLogs.router.js').includes('req.body.entityId'))
})

test('exact listing ID resolves using the verified project slug, not label or metadata', async()=>{
  const result=await lookup('lot_project_listing', 30063, [{lot_project_listing_id:30063,lot_project_slug:'luntiang-aguinaldo'}])
  assert.equal(result.destination.path,'/portal/lot-projects/luntiang-aguinaldo/listings/30063')
})

test('deletion and unsupported or missing records never invent a destination',async()=>{
  assert.equal((await resolveAuditRecordDestination(fake(),{entity_type:'lot_project_payment',entity_id:7,action:'delete'},'auditor',allow)).status,'historical')
  assert.equal((await lookup('user',150010)).status,'historical')
  assert.equal((await lookup('lot_project_listing',9,[])).status,'historical')
  assert.equal((await lookup('lot_project_listing','seller row')).status,'historical')
  assert.equal((await lookup('document',30009)).destination,null)
})

test('in-house seller navigates to exact member profile, external seller to read-only seller page',async()=>{
  const inHouse=await lookup('accredited_seller',90001,[{user_id:150010,seller_group_id:90001,seller_group_type:'in_house'}])
  assert.equal(inHouse.destination.path,'/portal/auditor/accredited/groups/in-house/90001/members/150010')
  const external=await lookup('accredited_seller',90013,[{user_id:150052,seller_group_id:90015,seller_group_type:'external'}])
  assert.equal(external.destination.path,'/portal/auditor/accredited/sellers/90013')
})

test('network project links require valid group/type and exact existing rate row',async()=>{
  assert.equal((await lookup('seller_group_project_rates','90001',[{seller_group_type:'in_house'}])).status,'historical')
  const result=await lookup('seller_group_project_rates','90001:30003',[{seller_group_type:'in_house'}],[{exists:1}])
  assert.equal(result.destination.path,'/portal/auditor/accredited/groups/in-house/90001?project=30003')
  assert.equal((await lookup('seller_group_project_rates','90001:30003',[{seller_group_type:'in_house'}],[])).status,'historical')
})

test('payment opens the exact historical account instead of the current unit buyer',async()=>{
  const result=await lookup('lot_project_payment',50001,[{lot_project_account_id:60001,lot_project_listing_id:30063}],[{lot_project_account_id:60001,lot_project_listing_id:30063,lot_project_slug:'luntiang-aguinaldo'}])
  assert.equal(result.destination.path,'/portal/lot-projects/luntiang-aguinaldo/listings/30063/accounts/60001')
  const conflict=await lookup('lot_project_payment',50001,[{lot_project_account_id:60001,lot_project_listing_id:9}],[{lot_project_account_id:60001,lot_project_listing_id:30063,lot_project_slug:'luntiang-aguinaldo'}])
  assert.equal(conflict.status,'historical')
  const noAccount=await lookup('lot_project_payment',50001,[{lot_project_listing_id:30063}])
  assert.equal(noAccount.status,'historical')
})

test('ambiguous buyer profile is never assigned to first matching account',async()=>{
  assert.equal((await lookup('lot_project_client_profile',22,[{lot_project_client_profile_id:22}],[{lot_project_account_id:1},{lot_project_account_id:2}])).status,'historical')
})

test('destination permission is checked separately from audit viewing',async()=>{
  const result=await resolveAuditRecordDestination(fake([{lot_project_listing_id:30063,lot_project_slug:'test'}]), {entity_type:'lot_project_listing',entity_id:'30063'},'auditor',()=>false)
  assert.equal(result.status,'historical')
})

test('read endpoint and Audit Logs UI are permission-gated; unrelated business pages are not changed',()=>{
  const routes=read('server/routers/System/auditLogs.router.js')
  assert.match(routes,/\/records\/:auditLogId\/location.*AUDIT_LOGS_VIEW/)
  const controller=read('server/controllers/System/auditLogs.controller.js')
  assert.match(controller,/getAuditLogRecordDestination/)
  assert.match(controller,/resolveAuditRecordDestination/)
  assert.match(read('client/src/pages/System/AuditLogs.jsx'),/\/audit-logs\/records\/\$\{id\}\/location/)
  assert.match(read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx'),/Find Original Record/)
})

test('evidence availability distinguishes saved partial snapshots and missing evidence without guessing',()=>{
  assert.equal(getAuditEvidenceCoverage({metadata:{before:null,after:{unit:'LA-1'}}}),'Before and After recorded')
  assert.equal(getAuditEvidenceCoverage({metadata:{after:{unit:'LA-1'}}}),'After only recorded')
  assert.equal(getAuditEvidenceCoverage({metadata:{before:{unit:'LA-1'}}}),'Before only recorded')
  assert.equal(getAuditEvidenceCoverage({metadata:{changes:[{field:'unitId',before:1,after:2}]}}),'Changed fields recorded')
  assert.equal(getAuditEvidenceCoverage({metadata:{requestId:'ok'}}),'No Before/After recorded')
  const excel=read('client/src/utils/auditReportExcel.js')
  assert.match(excel,/Saved Evidence Coverage/)
  assert.match(excel,/getAuditEvidenceCoverage\(r\)/)
})
