import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeSellerChangeRows, changedSellerRows } from '../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/sellerChangePresentation.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read=(file)=>readFileSync(path.join(root,file),'utf8')
const modal=read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/ChangeAssignedSellerModal.jsx')
const controller=read('server/controllers/Lot_Projects/ListingProfile/AssignedSellerChange.controller.js')
const page=read('client/src/pages/Lot_Projects/ListingProfile.jsx')
const adjustment=read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/RecalculateCommissionModal.jsx')

test('backend search retains eligible seller and project boundaries and escapes LIKE wildcards',()=>{
  for(const column of ['s.accredited_seller_status','u.status','g.seller_group_status','s.is_system_dummy', 'gr.lot_project_id'])
    assert.ok(controller.includes(column), column)
  assert.match(controller, /req\.query\?\.q/)
  assert.match(controller, /query\.replace\(/)
  assert.match(controller, /LIMIT 101/)
  assert.match(controller, /candidates:matches\.slice\(0,100\)/)
  assert.match(page, /encodeURIComponent\(String\(payload\.query/)
})

test('picker searches the backend, previews selected seller, and prevents stale results',()=>{
  assert.match(modal, /loadOptionsRef\.current\(\{ accountId, query: search \}\)/)
  assert.match(modal, /onPreview\(\{ accountId, newSellerId: Number\(seller\.id\) \}\)/)
  assert.match(modal, /requestId === previewSequence\.current/)
  assert.match(modal, /previewBusy/)
  assert.match(modal, /aria-autocomplete="list"/)
  assert.match(modal, /ArrowDown/)
  assert.match(modal, /ArrowUp/)
  assert.match(modal, /Escape/)
  assert.match(modal, /Showing the first 100 matches/)
})

test('before / after only identifies a changed agent when downstream commission recipients are unchanged',()=>{
  const before=[
    {role:'sales_agent',accreditedSellerId:1,rate:4,grossCommission:31200},
    {role:'unit_manager',accreditedSellerId:2,rate:1.6,grossCommission:12480},
    {role:'sales_director',accreditedSellerId:3,rate:1.2656,grossCommission:9871.68},
    {role:'division_manager',accreditedSellerId:4,rate:1.1344,grossCommission:8848.32},
  ]
  const after=before.map(row=>({...row}))
  after[0].accreditedSellerId=5
  assert.deepEqual(changedSellerRows(after,before).map(r=>r.changed),[true,false,false,false])
  assert.equal(summarizeSellerChangeRows(after).recipients,4)
  assert.equal(summarizeSellerChangeRows(after).allocatedRate,8)
  assert.equal(summarizeSellerChangeRows(after).gross,62400)
})

test('changed commission rates and missing roles are highlighted without recomputing backend monetary values',()=>{
  const old=[{role:'sales_agent',accreditedSellerId:1,rate:4,grossCommission:31200}]
  const next=[{role:'sales_agent',accreditedSellerId:1,rate:4.5,grossCommission:35000},{role:'unit_manager',accreditedSellerId:2,rate:1.5,grossCommission:11700}]
  assert.deepEqual(changedSellerRows(next,old).map(r=>r.changed),[true,true])
  assert.equal(summarizeSellerChangeRows(next).gross,46700)
})

test('new seller preview includes current reporting chain only, while protected authorization uses the unchanged fingerprint',()=>{
  assert.match(controller, /reportsUnder:result\.preview\.hierarchy\[index\+1\]/)
  assert.match(controller, /fingerprint:result\.fingerprint/)
  assert.match(modal, /fingerprint: preview\.fingerprint/)
  assert.match(modal, /Email Verification Code/)
  assert.match(controller, /getEvidence\(connection,listing/)
  assert.match(controller, /createProtectedChangeRequest/)
  assert.match(controller, /bcrypt\.compare/)
})

test('commission rate adjustment keeps its governed workflow while improving readability',()=>{
  assert.match(adjustment, /CommissionDistribution/)
  assert.match(adjustment, /compact/)
  assert.match(adjustment, /Changed/)
  assert.match(adjustment, /onRequestCode/)
  assert.match(adjustment, /onConfirm/)
  assert.match(adjustment, /adjustmentPayload/)
})
