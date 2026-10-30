import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getReviewRecordLink } from '../../../CLIENT/SYSTEM/src/utils/reviewRecordLinks.js'
import { getSavedReviewRevisions } from '../../../CLIENT/SYSTEM/src/utils/reviewRevisionHistory.js'
import { resolveReviewRecordLocation } from '../services/reviewRecordLocation.service.js'

const review = (type,id,recordLocation,extra={}) => ({entity_type:type,entity_id:id,lot_project_slug:'sample',lot_project_id:77,recordLocation,...extra})
const payDb = {query:async (sql,params)=>{
  if(sql.includes('FROM lot_project_payments')) return [[{lot_project_id:77,lot_project_listing_id:12,lot_project_account_id:90,lot_project_client_profile_id:22,lot_project_payment_id:15}]]
  return [[]]
}}
const accountDb={query:async(sql,params)=>{
  if(sql.includes('FROM lot_project_accounts')) return [[{lot_project_account_id:90,lot_project_id:77,lot_project_listing_id:12,lot_project_client_profile_id:22}]]
  return [[]]
}}

test('payment review deep-links to exact historical account and payment in view mode',async()=>{
  const loc=await resolveReviewRecordLocation(payDb,review('lot_project_payment',15,null))
  assert.equal(loc.recordLocation.accountId,90)
  assert.equal(loc.recordLocation.listingId,12)
  assert.equal(loc.recordLocation.paymentId,15)
  const url=getReviewRecordLink({review:review('lot_project_payment',15,loc.recordLocation),actorRole:'auditor',reviewId:25,mode:'view'})
  assert.match(url,/\/listings\/12\/accounts\/90\?/)
  assert.match(url,/reviewView=1/)
  assert.match(url,/paymentId=15/)
  assert.doesNotMatch(url,/workflowAction=payment_correction/)
})
test('payment proof and signed receipt are keyed to payment ID, never proof ID',async()=>{
  for(const type of ['lot_project_payment_proof','lot_project_signed_receipt']) {
    const loc=await resolveReviewRecordLocation(payDb,review(type,15,null))
    assert.equal(loc.recordLocation.paymentId,15)
  }
})
test('reservation account link includes correct account ID',async()=>{
  const loc=await resolveReviewRecordLocation(accountDb,review('lot_project_reservation',90,null))
  const url=getReviewRecordLink({review:review('lot_project_reservation',90,loc.recordLocation),reviewId:32,mode:'view'})
  assert.match(url,/\/accounts\/90\?/)
})
test('another project never reuses a matching ID',async()=>{
  const loc=await resolveReviewRecordLocation(payDb,review('lot_project_payment',15,null,{lot_project_id:999}))
  assert.equal(loc.entityExists,false)
  assert.equal(getReviewRecordLink({review:{...review('lot_project_payment',15,null),...loc},reviewId:1,mode:'view'}),null)
})
test('missing record never redirects to current account',async()=>{
  const loc=await resolveReviewRecordLocation({query:async()=>[[]]},review('lot_project_payment',15,null))
  assert.equal(loc.entityExists,false)
})
test('view and correction links have different modes',()=>{
  const item=review('accredited_seller',5,{kind:'seller',sellerGroupId:4,groupType:'in_house',sellerUserId:9,sellerId:5})
  const view=getReviewRecordLink({review:item,reviewId:13,actorRole:'auditor',mode:'view'})
  const edit=getReviewRecordLink({review:item,reviewId:13,actorRole:'accounting_head',mode:'correct',workflowAction:'seller_edit_review'})
  assert.match(view,/reviewView=1/)
  assert.doesNotMatch(view,/workflowAction=/)
  assert.match(edit,/workflowAction=seller_edit_review/)
  assert.doesNotMatch(edit,/reviewView=/)
})
test('saved prior revisions are built from evidence only',()=>{
  const records=getSavedReviewRevisions({before:{price:1},after:{price:3},latestRevision:3,events:[
    {metadata_json:JSON.stringify({reviewRevision:2,previousAfterSnapshot:{price:1.5}})},
    {metadata_json:JSON.stringify({previousRevision:2,previousBeforeSnapshot:{price:1},previousAfterSnapshot:{price:2}})},
  ]})
  assert.equal(records[0].revision,3)
  assert.equal(records.find(r=>r.revision===2).after.price,2)
  assert.equal(records.length,3)
  assert.equal(records.find(r=>r.revision===1).after.price,1.5)
})
test('view-only surface never opens protected edit controls',()=>{
  const base=new URL('../../../CLIENT/SYSTEM/src/',import.meta.url)
  const ui=fs.readFileSync(new URL('pages/System/ReviewCenter.jsx',base),'utf8')
  const listing=fs.readFileSync(new URL('pages/Lot_Projects/ListingProfile.jsx',base),'utf8')
  const panel=fs.readFileSync(new URL('components/Shared/ReviewLiveRecordPanel.jsx',base),'utf8')
  assert.match(ui,/mode: 'view'/)
  assert.match(ui,/mode: 'correct'/)
  assert.match(listing,/reviewView \? <ReviewLiveRecordPanel/)
  assert.doesNotMatch(panel,/onSave=|onSubmit=|useFetchPost|mutation\.mutate/)
})

