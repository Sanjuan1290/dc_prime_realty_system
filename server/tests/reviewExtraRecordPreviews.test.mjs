import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getReviewExtraRecord, isExtraRecordPreview } from '../services/reviewExtraRecord.service.js'

const row = (entity_type, entity_id, lot_project_id=55, extra={})=>({ entity_type,entity_id,lot_project_id,...extra })
const mock = (routes) => ({query: async (sql, args) => {
  const found=routes.find(([contains])=>sql.includes(contains))
  return [typeof found?.[1] === 'function' ? found[1](args):found?.[1] || []]
}})

test('buyer-form preview opens matching submission, without returning token and IP fields',async()=>{
  const db=mock([['FROM lot_project_buyer_form_submissions',[{id:3,projectId:55,listingId:80,accountId:21,buyerName:'Example Buyer',savedForm:JSON.stringify({buyerName:'Example Buyer',email:'example@example.test',token:'secret',password:'private'})}]]])
  const r=await getReviewExtraRecord(db,row('lot_project_buyer_form',3,55,{after_snapshot_json:JSON.stringify({listingId:80})}))
  assert.equal(r.available,true)
  assert.equal(r.form.email,'example@example.test')
  assert.equal(Object.hasOwn(r.form,'token'),false)
  assert.equal(Object.hasOwn(r.form,'password'),false)
  assert.equal(Object.hasOwn(r.fields,'savedForm'),false)
})
test('buyer form refuses mismatched listing even with a valid submission ID',async()=>{
  const db=mock([['FROM lot_project_buyer_form_submissions',[{id:3,projectId:55,listingId:81}]]])
  const r=await getReviewExtraRecord(db,row('lot_project_buyer_form',3,55,{after_snapshot_json:{listingId:80}}))
  assert.equal(r.available,false)
})
test('import batch is scoped to project and returns paged rows',async()=>{
  const calls=[];const db={query:async(sql,args)=>{
    calls.push([sql,args]);if(sql.includes('FROM lot_project_listing_import_batches'))return [[{id:9,reference:'IMP-9'}]];
    return [[{row:1,unit:'A-1',status:'imported'}]];
  }}
  const r=await getReviewExtraRecord(db,row('lot_project_listing_import',9),2)
  assert.equal(r.available,true)
  assert.equal(r.entries.page,2)
  assert.deepEqual(calls[0][1],[9,55])
  assert.deepEqual(calls[1][1],[9,26,25])
})
test('missing batch leaves historical review intact',async()=>{
  const r=await getReviewExtraRecord(mock([]),row('lot_project_listing_import',9))
  assert.equal(r.available,false)
})
test('network profit release always checks project association',async()=>{
  let params
  const db={query:async(sql,args)=>{params=args;return [[{id:4,stage:'Release 1',amount:500}]]}}
  const r=await getReviewExtraRecord(db,row('lot_project_network_profit_release',4,55))
  assert.equal(r.available,true)
  assert.deepEqual(params,[4,55])
})
test('seller import resolves batch ID from saved import snapshot, not group ID',async()=>{
  let values
  const db={query:async(sql,args)=>{if(sql.includes('FROM network_member_import_batches')){values=args;return [[{id:92,networkId:8}]]}return [[]]}}
  const review=row('seller_group',8,null,{action_key:'network.members.import',after_snapshot_json:{groupId:8,importBatchId:92}})
  assert.equal(isExtraRecordPreview(review),true)
  const r=await getReviewExtraRecord(db,review)
  assert.equal(r.available,true)
  assert.deepEqual(values,[92,8])
})
test('record preview and secure signed-receipt routes enforce review permissions',()=>{
  const root=new URL('../',import.meta.url)
  const router=fs.readFileSync(new URL('routers/System/workflow.routers.js',root),'utf8')
  const controller=fs.readFileSync(new URL('controllers/System/workflow.controller.js',root),'utf8')
  const ui=fs.readFileSync(new URL('../client/src/pages/System/ReviewCenter.jsx',root),'utf8')
  assert.match(router,/reviews\/:id\/record-preview'.*requireReviewCenterRole.*WORKFLOW_REVIEW_CENTER_VIEW/)
  assert.match(router,/reviews\/:id\/signed-receipts\/:fileId\/content'.*requireReviewCenterRole.*WORKFLOW_REVIEW_CENTER_VIEW/)
  assert.match(controller,/getOperationalReviewRecordPreview[\s\S]*canActorViewReview/)
  assert.match(controller,/getOperationalReviewSignedReceiptContent[\s\S]*allowedIds\.includes\(fileId\)/)
  assert.match(controller,/getOperationalReviewSignedReceiptContent[\s\S]*malware_scan_status/)
  assert.match(ui,/isExtraPreview \? <button/)
  assert.match(ui,/ReviewSignedReceiptFile/)
})
