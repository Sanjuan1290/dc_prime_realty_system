import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSellerSetupAudit} from '../services/sellerSetupAudit.service.js';
import {validateSellerReportingChain} from '../controllers/System/sellerHierarchyRules.js';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=(relative)=>fs.readFileSync(path.join(base,relative),'utf8');
const group={seller_group_id:99,seller_group_name:'Example Network',seller_group_type:'in_house',seller_group_status:'active',seller_group_head_user_id:1};
const activeProjects=[{seller_group_lot_project_rate_status:'active',lot_project_status:'active'}];
const people=[
  {accredited_seller_id:10,user_id:1,role:'division_manager',full_name:'DM',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:null},
  {accredited_seller_id:11,user_id:2,role:'sales_director',full_name:'SD',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:1},
  {accredited_seller_id:12,user_id:3,role:'unit_manager',full_name:'UM',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:2},
  {accredited_seller_id:13,user_id:4,role:'sales_agent',full_name:'SA',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:3},
];
const links=[{managed_user_id:2,manager_user_id:1},{managed_user_id:3,manager_user_id:2},{managed_user_id:4,manager_user_id:3}];
const run=(o={})=>buildSellerSetupAudit({group,members:people,managerLinks:links,projects:activeProjects,...o});

test('ready chain has no issues and never changes input data',()=>{
 const copy=JSON.stringify(people); const result=run();
 assert.deepEqual(result.summary,{total:4,ready:4,attention:0,blocked:0,inactive:0});
 assert.equal(JSON.stringify(people),copy);
});

test('detects inactive manager through the full chain',()=>{
 const data=people.map(row=>row.user_id===2?{...row,accredited_seller_status:'inactive',user_status:'inactive'}:row);
 const result=run({members:data});
 assert.equal(result.records.find(x=>x.userId===4).readiness,'blocked');
 assert.ok(result.records.find(x=>x.userId===4).issues.some(x=>x.code==='INACTIVE_PARENT'));
});

test('detects status mismatch, orphan manager and inconsistent links',()=>{
 const data=people.map(row=>row.user_id===4?{...row,accredited_seller_status:'inactive'}:row);
 assert.ok(run({members:data}).records.find(x=>x.userId===4).issues.some(x=>x.code==='STATUS_MISMATCH'));
 const missing=people.map(row=>row.user_id===4?{...row,accredited_seller_reports_under_user_id:555}:row);
 assert.ok(run({members:missing}).records.find(x=>x.userId===4).issues.some(x=>x.code==='PARENT_NOT_IN_NETWORK'));
 assert.ok(run({managerLinks:links.filter(l=>l.managed_user_id!==4)}).records.find(x=>x.userId===4).issues.some(x=>x.code==='MANAGER_LINK'));
});

test('flags missing project setup and wrong Network Head role',()=>{
 assert.ok(run({projects:[]}).networkWarnings.some(s=>s.includes('project')));
 assert.ok(run({group:{...group,seller_group_head_user_id:2}}).records.find(x=>x.userId===4).issues.some(x=>x.code==='HEAD_WRONG_ROLE'));
});

test('a live reservation rejects an inactive parent and missing explicit parent link',()=>{
 const live=people.slice().reverse().map((row,i)=>({...row,seller_group_id:99,is_group_head:i===3}));
 assert.equal(validateSellerReportingChain(live,{requireGroupHead:true}),true);
 const inactive=live.map(row=>row.user_id===2?{...row,user_status:'inactive'}:row);
 assert.throws(()=>validateSellerReportingChain(inactive,{requireGroupHead:true}),/inactive/i);
 const disconnected=live.map(row=>row.user_id===2?{...row,accredited_seller_reports_under_user_id:null}:row);
 assert.throws(()=>validateSellerReportingChain(disconnected,{requireGroupHead:true}),/not assigned to the expected manager/i);
});

test('authorization and protected status changes enforced by code',()=>{
 const users=source('server/controllers/System/users.controllers.js');
 const routes=source('server/routers/System/users.routers.js');
 const network=source('server/routers/System/sellerGroup.routers.js');
 assert.match(users,/assertNoManagerDeactivation\(user\)/);
 assert.match(users,/SELLER_SETUP_INCOMPLETE|checkSellerCanReactivate/);
 assert.match(users,/UPDATE accredited_sellers SET accredited_seller_status='active'/);
 assert.match(users,/USE_PROTECTED_ACCOUNT_ACTION/);
 assert.match(routes,/reactivate\/:id\/code/);
 assert.match(network,/getSellerSetupAudit/);
 assert.match(network,/requireExactRole\('super_admin','system_admin'\)/);
 const importer=source('server/controllers/System/sellerGroup.controller.js');
 assert.match(importer,/Use Activate Seller before importing/);
});


test('multiple independent DMs are valid while exactly one is designated Head', () => {
 const anotherDM = {accredited_seller_id:19,user_id:9,role:'division_manager',full_name:'DM B',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:null};
 const otherSD = {accredited_seller_id:20,user_id:10,role:'sales_director',full_name:'SD B',user_status:'active',accredited_seller_status:'active',accredited_seller_reports_under_user_id:9};
 const report = run({members:[...people,anotherDM,otherSD],managerLinks:[...links,{managed_user_id:10,manager_user_id:9}]});
 assert.equal(report.summary.blocked,0);
 assert.equal(report.summary.ready,6);
 assert(!report.records.some(r => r.issues.some(i => i.code==='DM_NOT_HEAD')));
});
