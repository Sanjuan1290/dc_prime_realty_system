import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = p => fs.readFileSync(resolve(root, p), 'utf8')
// The staffing service is pure; a data-url import avoids relying on any test installation.
const staffing = await import('data:text/javascript,' + encodeURIComponent(read('server/services/sellerTeamCompleteness.service.js')))
const { buildSellerTeamCompleteness } = staffing
const seller = (id, role, parent = null, active = true, other = {}) => ({
  user_id:id, accredited_seller_id:id+100, role, accredited_seller_reports_under_user_id:parent,
  user_status:active?'active':'inactive', accredited_seller_status:active?'active':'inactive', ...other,
})
const dm=seller(1,'division_manager'), sd=seller(2,'sales_director',1), um=seller(3,'unit_manager',2), sa=seller(4,'sales_agent',3)
const hint = (rows,id,headId=null) => buildSellerTeamCompleteness(rows,{headUserId:headId}).records.find(x=>x.userId===id).canDeactivateWithoutReplacement

test('All three active empty manager roles can be offered deactivation',()=>{
  assert.equal(hint([dm],1),true)
  assert.equal(hint([dm,sd],2),true)
  assert.equal(hint([dm,sd,um],3),true)
})
test('Active direct reports block DM, SD and UM',()=>{
  assert.equal(hint([dm,sd],1),false)
  assert.equal(hint([dm,sd,um],2),false)
  assert.equal(hint([dm,sd,um,sa],3),false)
})
test('Inactive direct reports also block every manager role',()=>{
  assert.equal(hint([dm,seller(2,'sales_director',1,false)],1),false)
  assert.equal(hint([dm,sd,seller(3,'unit_manager',2,false)],2),false)
  assert.equal(hint([dm,sd,um,seller(4,'sales_agent',3,false)],3),false)
})
test('Network Head DM never receives empty-manager deactivation hint',()=>{
  assert.equal(hint([dm],1,1),false)
  assert.equal(hint([dm,sd],2,1),true)
})
test('Inactive managers and ordinary agents cannot use empty-manager deactivation',()=>{
  assert.equal(hint([seller(1,'division_manager',null,false)],1),false)
  assert.equal(hint([dm,sd,um,sa],4),false)
})
test('Staffing status remains advisory: empty UM is still needs_assignment',()=>{
  const report=buildSellerTeamCompleteness([dm,sd,um],{headUserId:1})
  const empty=report.records.find(x=>x.userId===3)
  assert.equal(empty.status,'needs_assignment')
  assert.equal(empty.missingRole,'sales_agent')
  assert.equal(empty.canDeactivateWithoutReplacement,true)
})
test('API passes the actual designated Network Head ID to UI hint',()=>{
  const code=read('server/controllers/System/sellerSetupAudit.controller.js')
  assert.match(code,/SELECT seller_group_type,seller_group_head_user_id FROM seller_groups/)
  assert.match(code,/buildSellerTeamCompleteness\(members, \{ headUserId: group.seller_group_head_user_id \}\)/)
})
test('Endpoint and visible actions require explicit role and permission checks',()=>{
  const route=read('server/routers/System/sellerGroup.routers.js')
  const ui=read('client/src/pages/System/SellerGroupDetails.jsx')
  const modal=read('client/src/components/System/sellerGroupComponents/DeactivateEmptyManagerModal.jsx')
  assert.match(route,/deactivate-empty'[\s\S]*?requireExactRole\('super_admin','system_admin','marketing_staff','marketing_head'\)/)
  assert.match(route,/deactivate-empty'[\s\S]*?requirePermission\(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE\)/)
  assert.match(route,/deactivate-empty'[\s\S]*?requirePermission\(PERMISSIONS.SYSTEM_USERS_EDIT\)/)
  assert.match(ui,/canDeactivateEmptyManager && \['division_manager','sales_director','unit_manager'\]/)
  assert.match(ui,/canEditSeller && canEditNetwork/)
  assert.match(modal,/confirmDeactivation: true/)
})

function harness({role='unit_manager',isHead=false,reports=0,deps=0,links=0,accountRows=1,sellerRows=1,headId=99}={}) {
  const controller=read('server/controllers/System/sellerManagerReplacement.controller.js')
  const source=controller.slice(controller.indexOf('/**\n * Deactivate an empty In-House DM'))
  const queries=[];let committed=false, reviewed=false, audited=false
  const connection={
    beginTransaction:async()=>queries.push('begin'),
    commit:async()=>{committed=true;queries.push('commit')},
    query:async(sql,args)=>{
      queries.push({sql,args})
      if(sql.includes('COUNT(*) AS total FROM accredited_sellers'))return [[{total:deps}]]
      if(sql.includes('COUNT(*) AS total FROM accredited_seller_managed_sellers'))return [[{total:links}]]
      if(sql.includes('SELECT seller_group_head_user_id FROM seller_groups'))return [[{seller_group_head_user_id:headId}]]
      if(sql.includes('UPDATE users'))return [{affectedRows:accountRows}]
      if(sql.includes('UPDATE accredited_sellers'))return [{affectedRows:sellerRows}]
      throw Error('Unexpected SQL '+sql)
    },
  }
  const plan={role,replacesNetworkHead:isHead,directReports:Array.from({length:reports},(_,i)=>({userId:i+99})),totalAffected:reports,
    outgoing:{userId:3,sellerId:103,name:'Example',role},groupId:1,currentHeadUserId:headId}
  const sandbox={
    transaction:async(_req,_res,handler)=>handler(connection),
    parse:req=>({groupId:Number(req.params.groupId),outgoingUserId:Number(req.params.userId)}),
    reason:req=>String(req.body?.reason||'').trim().slice(0,500),
    getManagerReplacementPlan:async(_c,args)=>{assert.equal(args.lock,true);return plan},
    createOperationalReview:async(_c,opts)=>{reviewed=true;assert.equal(opts.actionKey,'seller.status');return {reviewId:123,reviewNumber:'REV-123'}},
    writeAuditLog:async(_c,_r,opts)=>{audited=true;assert.equal(opts.metadata.role,role)},
  }
  vm.runInNewContext(source.replace('export const deactivateEmptyManager =','const deactivateEmptyManager =')+'\nthis.deactivateEmptyManager = deactivateEmptyManager;',sandbox)
  const reply={code:200,data:null,status(n){this.code=n;return this},json(data){this.data=data;return data}}
  const request={params:{groupId:1,userId:3},body:{reason:'Created by mistake',confirmDeactivation:true},authUser:{id:9,role:'marketing_staff'}}
  return {run:()=>sandbox.deactivateEmptyManager(request,reply),reply,queries,connection,get committed(){return committed},get reviewed(){return reviewed},get audited(){return audited}}
}
test('Controller saves deactivation for DM, SD, UM without updating history or other members',async()=>{
  for(const role of ['division_manager','sales_director','unit_manager']){
    const t=harness({role})
    await t.run()
    assert.equal(t.committed,true,role)
    assert.equal(t.reviewed,true,role)
    assert.equal(t.audited,true,role)
    assert.equal(t.reply.data.success,true,role)
    assert.equal(t.queries.filter(x=>typeof x==='object'&&/^UPDATE\s/i.test(x.sql)).length,2)
    assert.ok(t.queries.every(x=>typeof x==='string'||!/(DELETE|UPDATE\s+lot_project|UPDATE\s+commissions)/i.test(x.sql)))
  }
})
test('Backend rejects designated Network Head even when no direct reports',async()=>{
  const t=harness({role:'division_manager',isHead:true})
  await assert.rejects(t.run(),/Network Head/)
  assert.equal(t.committed,false)
})
test('Backend rejects any child, inactive or legacy linked sellers',async()=>{
  for(const opts of [{reports:1},{deps:1},{links:1}]){
    const t=harness(opts)
    await assert.rejects(t.run(),/assigned sellers|linked sellers/)
    assert.equal(t.committed,false)
  }
})
test('Backend rechecks head pointer under lock and aborts if it was changed',async()=>{
  const t=harness({role:'division_manager',headId:3})
  await assert.rejects(t.run(),/Network Head/)
  assert.equal(t.committed,false)
})
test('Backend refuses stale active statuses without writing audit history',async()=>{
  const t=harness({accountRows:0})
  await assert.rejects(t.run(),/status changed/)
  assert.equal(t.committed,false)
  assert.equal(t.reviewed,false)
  assert.equal(t.audited,false)
})
test('Backend never changes historical business records or deletes seller accounts',()=>{
  const src=read('server/controllers/System/sellerManagerReplacement.controller.js')
  const action=src.slice(src.indexOf('/**\n * Deactivate an empty In-House DM'))
  assert.doesNotMatch(action,/DELETE FROM|UPDATE commissions|UPDATE lot_project_client_profiles|UPDATE seller_group_lot_project_rates/)
  assert.match(action,/can_login=0/)
  assert.match(action,/auth_version=COALESCE\(auth_version,0\)\+1/)
  assert.match(action,/createOperationalReview\(connection/)
  assert.match(action,/writeAuditLog\(connection/)
})
