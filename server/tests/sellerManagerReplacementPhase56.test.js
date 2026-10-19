import test from 'node:test';
import assert from 'node:assert/strict';
import { getManagerReplacementPlan, replacementFingerprint } from '../services/sellerManagerReplacement.service.js';
import { validateSellerReportingChain } from '../controllers/System/sellerHierarchyRules.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dm = (user_id=100) => ({user_id,accredited_seller_id:user_id,seller_group_id:5,role:'division_manager',user_status:'active',accredited_seller_status:'active',is_system_dummy:0,accredited_seller_reports_under_user_id:null,first_name:'DM',last_name:String(user_id)});
const sd=(user_id,parent=100)=>({...dm(user_id),role:'sales_director',first_name:'SD',accredited_seller_reports_under_user_id:parent});
const um=(user_id,parent=200)=>({...dm(user_id),role:'unit_manager',first_name:'UM',accredited_seller_reports_under_user_id:parent});
const sa=(user_id,parent=300)=>({...dm(user_id),role:'sales_agent',first_name:'SA',accredited_seller_reports_under_user_id:parent});
const group={seller_group_id:5,seller_group_name:'Sample Network',seller_group_type:'in_house',seller_group_status:'active',seller_group_head_user_id:100};
const conn=(members,groupData=group)=>({query:async (sql)=>{
 if(sql.includes('FROM seller_groups')) return [[groupData]];
 if(sql.includes('FROM accredited_sellers s INNER JOIN users')) return [members];
 throw new Error('Unexpected SQL: '+sql);
}});

test('Unit Manager replacement transfers direct SAs and counts downstream exactly', async()=>{
 const plan=await getManagerReplacementPlan(conn([dm(),sd(200),um(300),um(301),sa(400),sa(401)]),{groupId:5,outgoingUserId:300,replacementUserId:301});
 assert.equal(plan.role,'unit_manager');
 assert.equal(plan.totalAffected,2);
 assert.deepEqual(plan.directReports.map(x=>x.userId),[400,401]);
 assert(plan.directReports.every(x=>x.nextManagerUserId===301));
 assert.equal(plan.replacement.name,'UM 301');
});

test('Sales Director replacement moves UMs, not their Sales Agents',async()=>{
 const plan=await getManagerReplacementPlan(conn([dm(),sd(200),sd(201),um(300),sa(400)]),{groupId:5,outgoingUserId:200,replacementUserId:201});
 assert.deepEqual(plan.directReports.map(x=>x.userId),[300]);
 assert.equal(plan.totalAffected,2);
});

test('Division Manager replacement distinguishes a designated Head from ordinary DMs',async()=>{
 const members=[dm(),dm(101),dm(102),sd(200),sd(201,101),um(300),sa(400)];
 const headPlan=await getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:100,replacementUserId:101});
 assert.equal(headPlan.replacesNetworkHead,true);
 assert.equal(headPlan.directReports.length,1);
 assert.equal(headPlan.existingDirectReports.length,1);
 assert.equal(headPlan.mergeRequired,true);
 const regularPlan=await getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:101,replacementUserId:102});
 assert.equal(regularPlan.replacesNetworkHead,false);
 assert.equal(regularPlan.currentHeadUserId,100);
 assert.equal(regularPlan.directReports.length,1);
 assert.equal(regularPlan.mergeRequired,false);
});

test('UM and SD replacements cannot silently cross reporting branches',async()=>{
 const members=[dm(),dm(101),sd(200,100),sd(201,101),um(300,200),um(301,201),sa(400,300)];
 await assert.rejects(()=>getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:300,replacementUserId:301}),/Replacement is unavailable/);
 await assert.rejects(()=>getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:200,replacementUserId:201}),/Replacement is unavailable/);
});

test('Inactive direct reports retain their status in transfer plan',async()=>{
 const member={...sa(400),user_status:'inactive',accredited_seller_status:'inactive'};
 const plan=await getManagerReplacementPlan(conn([dm(),sd(200),um(300),um(301),member]),{groupId:5,outgoingUserId:300,replacementUserId:301});
 assert.equal(plan.directReports[0].userStatus,'inactive');
});

test('Invalid replacement: different role, missing chain, wrong group or cycle',async()=>{
 const members=[dm(),sd(200),um(300),sa(400),um(301,999)];
 await assert.rejects(()=>getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:300,replacementUserId:200}),/Replacement is unavailable/);
 await assert.rejects(()=>getManagerReplacementPlan(conn(members),{groupId:5,outgoingUserId:300,replacementUserId:301}),/Replacement is unavailable/);
 await assert.rejects(()=>getManagerReplacementPlan(conn(members,{...group,seller_group_status:'inactive'}),{groupId:5,outgoingUserId:300,replacementUserId:301}),/Activate this Network/);
});

test('Verification fingerprint changes when team or manager status changes',async()=>{
 const initial=[dm(),sd(200),um(300),um(301),sa(400)];
 const p1=await getManagerReplacementPlan(conn(initial),{groupId:5,outgoingUserId:300,replacementUserId:301});
 const p2=await getManagerReplacementPlan(conn([...initial,{...sa(401)}]),{groupId:5,outgoingUserId:300,replacementUserId:301});
 assert.notEqual(replacementFingerprint(p1,'Transfer requested'), replacementFingerprint(p2,'Transfer requested'));
 assert.notEqual(replacementFingerprint(p1,'Transfer requested'), replacementFingerprint(p1,'Different reason'));
});

test('New reservations reject incomplete chain and inactive ancestor',()=>{
 const chain=[{...sa(400),user_id:400},{...um(300),user_id:300},{...sd(200),user_id:200},{...dm(100),user_id:100,is_group_head:true}];
 assert.equal(validateSellerReportingChain(chain,{requireGroupHead:true}),true);
 assert.throws(()=>validateSellerReportingChain(chain.slice(0,3),{requireGroupHead:true}),/Complete the Sales Agent/i);
 assert.throws(()=>validateSellerReportingChain(chain.map(x=>x.role==='sales_director'?{...x,user_status:'inactive'}:x),{requireGroupHead:true}),/inactive/i);
});

test('Migration and API safeguards exist without modifying historical commissions',()=>{
 const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
 const controller=fs.readFileSync(path.join(root,'controllers/System/sellerManagerReplacement.controller.js'),'utf8');
 const migration=fs.readFileSync(path.join(root,'migrations/20261018_seller_manager_replacement_tidb.sql'),'utf8');
 assert.match(controller,/verifyAndConsumeSensitiveAction/);
 assert.match(controller,/await connection\.beginTransaction/);
 assert.match(controller,/await connection\.commit/);
 assert.match(controller,/await assertReplacementApplied/);
 assert.match(controller,/createOperationalReview/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS seller_manager_replacement_items/);
 assert.doesNotMatch(migration,/CREATE TRIGGER|DROP TRIGGER|DELIMITER/);
 assert.doesNotMatch(controller,/UPDATE\s+lot_project_commissions/i);
});

