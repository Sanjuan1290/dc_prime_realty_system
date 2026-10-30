import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateExactBulkRecipients,isLiveBulkStageEligible,countPendingBulkRecipients} from '../services/inHouseBulkReleasePolicy.js'
import {getNetworkProfitReleaseCalendar} from '../services/networkProfitReleaseCalendar.js'
import {validateReleaseReceiptDetails} from '../services/releaseReceiptDetails.js'
const read = (p)=>readFileSync(new URL(`../../${p}`,import.meta.url),'utf8')
const controller=read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/InHouseBulkRelease.controller.js')
const releaseController=read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/Commissions.controller.js')
const panel=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx')
const form=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseAllCommissionsModal.jsx')
const print=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/BulkAcknowledgmentPreview.jsx')
const routes=read('SERVER/SYSTEM/routers/System/projects.routers.js')
const commissionPage=read('CLIENT/SYSTEM/src/pages/Lot_Projects/Commission.jsx')
const recipients={profitId:2,sellers:[{commissionId:4},{commissionId:7}], entries:[{type:'company'},{type:'seller',commissionId:4},{type:'seller',commissionId:7}]}
test('only the exact saved account + network recipients are allowed',()=>{
  assert.equal(validateExactBulkRecipients(recipients).incoming.size,3)
  assert.throws(()=>validateExactBulkRecipients({...recipients,entries:recipients.entries.slice(1)}),/Recipients changed/)
  assert.throws(()=>validateExactBulkRecipients({...recipients,entries:[...recipients.entries,recipients.entries[1]]}),/duplicate/)
  assert.throws(()=>validateExactBulkRecipients({...recipients,entries:[{type:'company'},{type:'seller',commissionId:4},{type:'seller',commissionId:888}]}),/Recipients changed/)
})
test('released stages are skipped, on-hold stages are not eligible',()=>{
  assert.equal(isLiveBulkStageEligible('Eligible'),true)
  assert.equal(isLiveBulkStageEligible('Released'),true)
  for(const value of ['Pending','On Hold','Cancelled','Earned on Cancellation']) assert.equal(isLiveBulkStageEligible(value),false)
  assert.equal(countPendingBulkRecipients('Pending',['Released','Eligible','Released','Eligible']),3)
  assert.equal(countPendingBulkRecipients('Released',['Released','Released']),0)
})
test('calendar uses configured Philippine release days for entire batch',()=>{
  assert.equal(getNetworkProfitReleaseCalendar('2026-10-25',{release_day_one:7,release_day_two:22}).isReleaseDate,false)
  assert.equal(getNetworkProfitReleaseCalendar('2026-10-25',{release_day_one:7,release_day_two:22}).nextReleaseDateISO,'2026-11-07')
  assert.equal(getNetworkProfitReleaseCalendar('2026-11-07',{}).isReleaseDate,true)
  assert.match(controller,/if \(!calendar\.isReleaseDate\)/)
})
test('each pending payee needs valid receipt details before writing',()=>{
  const details={bankName:'BDO',accountNumber:'1234',receiptDate:'2026-11-07',referenceNumber:'PAY-123',witnessName:'Witness'}
  assert.deepEqual(validateReleaseReceiptDetails(details,'2026-11-07','2026-11-07'),details)
  assert.throws(()=>validateReleaseReceiptDetails({...details,referenceNumber:''},'2026-11-07','2026-11-07'),/required/)
  assert.match(controller,/validReceipt\(row,today\)/)
})
test('batch endpoint locks, rolls back on errors and creates separate review/audit records',()=>{
  assert.match(routes,/release-all', requirePermission\(PERMISSIONS.LOT_COMMISSIONS_RELEASE\), releaseAllInHouseMilestone/)
  for(const match of [/beginTransaction\(\)/,/FOR UPDATE/,/connection\.rollback\(\)/,/connection\.commit\(\)/,/randomUUID\(\)/,/writeAuditLog/,/createOperationalReview/,/finishBatchSellerRelease/]) assert.match(controller,match)
  assert.match(releaseController,/loadLiveSellerReleaseForBatch/)
  assert.match(controller,/alreadyApplied:true/)
  assert.match(controller,/account_status/)
})
test('existing seller and Company Profit single releases remain in place',()=>{
  assert.match(routes,/releaseNetworkCompanyProfit\)/)
  assert.match(routes,/updateLotProjectCommission\)/)
  assert.match(panel,/Release All/)
  assert.match(panel,/Print All Acknowledgments/)
  assert.match(form,/ReleaseReceiptFields/)
  assert.match(form,/confirmationHandled:'compact'/)
  assert.match(print,/CommissionReceiptPrint/)
  assert.match(print,/openElementInPdfPrintWindow/)
})

test('open Commission Details is refreshed when all seller rows are updated',()=>{
  assert.match(commissionPage,/setSelected\(current => \{/);
  assert.match(commissionPage,/groupedRecords\.find\(group => group\.id === current\.id\)/);
})
test('live seller milestone labels follow the Company Profit schedule without changing stored status',()=>{
  assert.match(releaseController,/displayStatus: status === 'Eligible' && releaseDateInfo\.isReleaseDate === false/);
  assert.match(releaseController,/awaitingReleaseDate:/);
  assert.match(read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx'),/stage\.displayStatus/);
})

test('frontend filters to the selected profit Network ID and server enforces membership',()=>{
  assert.match(read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx'),/Number\(seller\.sellerGroupId\) === Number\(selectedProfit\.networkId\)/)
  assert.match(releaseController,/acs\.seller_group_id AS current_seller_group_id/)
  assert.match(controller,/s\.seller_group_id=\?/)
})

