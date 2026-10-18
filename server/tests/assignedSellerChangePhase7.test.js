import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isSellerChangeStageUntouched, isNetworkProfitStageUntouched, sellerChangePayload, safeJsonHash, sellerChangeSnapshot } from '../services/assignedSellerChangeGuard.service.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>readFileSync(path.join(root,rel),'utf8');

test('default pending and retention release stages are untouched',()=>{
 assert.equal(isSellerChangeStageUntouched({release_stage:'1st Release',release_status:'Pending'}),true);
 assert.equal(isSellerChangeStageUntouched({release_stage:'Retention',release_status:'On Hold'}),true);
 assert.equal(isSellerChangeStageUntouched({release_stage:'1st Release',release_status:'On Hold'}),false);
 assert.equal(isSellerChangeStageUntouched({release_stage:'1st Release',release_status:'Eligible'}),false);
});
test('commission financial activity always blocks',()=>{
 for(const entry of [{release_status:'Released'},{release_status:'Pending',deduction_amount:100},{release_status:'Pending',actual_release_date:'2026-10-18'},
 {release_status:'Pending',release_recorded_at:'2026-10-18'},{release_status:'Pending',external_agent_receipt_status:'submitted'},
 {release_status:'Pending',historical_release_note:'paid by bank'},
 {release_status:'Pending',released_by_user_id:51}]){
   assert.equal(isSellerChangeStageUntouched(entry),false,JSON.stringify(entry));
 }
});
test('Network Company Profit holds and releases block changes',()=>{
 assert.equal(isNetworkProfitStageUntouched({release_status:'Pending'}),true);
 for(const entry of [{release_status:'On Hold'},{release_status:'Released'},{release_status:'Pending',payment_reference:'R1'},{release_status:'Pending',receipt_date:'2026-10-18'}])
 assert.equal(isNetworkProfitStageUntouched(entry),false);
});
test('approval payload binds old and new sellers, account, reason and fingerprint',()=>{
 const a=sellerChangePayload({accountId:2,listingId:5,currentSellerId:11,newSellerId:12,fingerprint:'v1',reason:'Seller assigned incorrectly'});
 assert.equal(a.accountId,2);assert.equal(a.newSellerId,12);
 assert.notEqual(safeJsonHash(a),safeJsonHash({...a,newSellerId:13}));
 assert.notEqual(safeJsonHash(a),safeJsonHash({...a,reason:'Different reason'}));
 assert.notEqual(safeJsonHash(a),safeJsonHash({...a,fingerprint:'v2'}));
});
test('historical snapshot stores monetary values without recomputing them',()=>{
 const snapshot=sellerChangeSnapshot([{lot_project_commission_id:1,accredited_seller_id:10,commission_rate:'1.1234',gross_commission_amount:'1234.56',commission_base_amount:'109884.00',seller_display_name_snapshot:'Old Seller',commission_role:'sales_agent'}]);
 assert.deepEqual(snapshot,[{commissionId:1,accreditedSellerId:10,sellerName:'Old Seller',role:'sales_agent',rate:1.1234,grossCommission:1234.56,commissionBase:109884}]);
});
test('new endpoints are independently protected and do not alter old commission adjustment routes',()=>{
 const router=read('server/routers/System/projects.routers.js');
 for(const action of ['options','preview','request','confirm'])assert.match(router,new RegExp(`change-seller/${action}[^\\n]*PERMISSIONS\\.LOT_ASSIGNED_SELLER_EDIT`));
 assert.match(router,/commission-adjustment-code/);assert.match(router,/adjust-commission/);
 const controller=read('server/controllers/Lot_Projects/ListingProfile/AssignedSellerChange.controller.js');
 assert.match(controller,/await connection\.beginTransaction\(\)/);assert.match(controller,/await connection\.commit\(\)/);
 assert.match(controller,/await connection\.rollback\(\)/);
 assert.match(controller,/consumeProtectedChange/);assert.match(controller,/createProtectedChangeRequest/);
 assert.match(controller,/bcrypt\.compare/);assert.match(controller,/crypto\.timingSafeEqual/);
 assert.match(controller,/createOperationalReview/);assert.match(controller,/writeAuditLog/);
});
test('payment, commission, receipt, profit and buyer-account checks precede replacement',()=>{
 const c=read('server/controllers/Lot_Projects/ListingProfile/AssignedSellerChange.controller.js');
 for(const term of ['lot_project_payments','lot_project_payment_schedules','lot_project_commission_receipts','lot_project_commission_releases','lot_project_network_profit_accounts','lot_project_network_profit_releases','lot_project_network_profit_signed_files'])assert.ok(c.includes(term),term);
 assert.match(c,/lot_project_account_id=l\.current_account_id/);
 assert.match(c,/replaceReservationCommissions/);
 assert.match(c,/UPDATE lot_project_client_profiles SET assigned_accredited_seller_id/);
});
test('migration is additive and TiDB compatible',()=>{
 const sql=read('server/migrations/20261018_phase7_assigned_seller_change_tidb.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS lot_project_assigned_seller_changes/);
 assert.doesNotMatch(sql,/^\s*(CREATE TRIGGER|DROP TRIGGER|DELIMITER|DELETE FROM|UPDATE lot_project_commissions)/im);
});
test('UI presents both actions and read-only before/after comparison',()=>{
 const unit=read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
 const modal=read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/ChangeAssignedSellerModal.jsx');
 assert.match(unit,/Edit Seller \/ Commission/);assert.match(unit,/Change Assigned Seller/);assert.match(unit,/Adjust Commission/);
 assert.match(modal,/Before/);assert.match(modal,/After/);assert.match(modal,/Email Verification Code/);assert.match(modal,/Review Changes/);
});

test('Review Center opens seller-change correction rather than commission-rate edit, while View Record stays read-only',()=>{
 const review=read('client/src/pages/System/ReviewCenter.jsx');
 const profile=read('client/src/pages/Lot_Projects/ListingProfile.jsx');
 const unit=read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
 assert.match(review,/reviewActionKey === 'commission\.assigned_seller_change' \? 'seller_change_review' : 'commission_adjustment'/);
 assert.match(review,/Open Seller \/ Commission/);
 assert.match(profile,/autoOpenSellerChange=\{workflowAction === 'seller_change_review' && !reviewView\}/);
 assert.match(unit,/autoOpenSellerChange && canChangeAssignedSeller && !readOnly/);
});
