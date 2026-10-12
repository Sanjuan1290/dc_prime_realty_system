import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import { groupNetworkProfitReceiptRows, profitReceiptProperties } from '../../client/src/utils/networkProfitReceiptGroups.js'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const read=(name)=>readFileSync(path.join(root,name),'utf8')
const record=(profitId,accountId,groupId,releaseId,amount,payee='R.Cortez Realty',unit='LA-1805')=>({
  profit:{id:profitId,accountId,sellerGroupId:groupId,network:'North Star Network',payee,unit,project:'Bailen Project',buyer:`Buyer ${accountId}`},
  stage:{id:releaseId,status:'Released',stage:'1st Release',amount,paymentReference:`R-${releaseId}`}
})
test('one Network Realty row groups all its released stages without duplicating amounts',()=>{
  const records=[record(1,100,5,10,1560),record(1,100,5,11,1560),record(2,101,5,12,1170),record(2,101,5,12,1170)]
  const result=groupNetworkProfitReceiptRows(records)
  assert.equal(result.length,1)
  assert.equal(result[0].releaseCount,3)
  assert.equal(result[0].propertyCount,2)
  assert.equal(result[0].releasedAmount,4290)
})
test('different Networks, payees, and unspecified identity are not accidentally merged',()=>{
  const groups=groupNetworkProfitReceiptRows([
    record(1,100,5,10,1),record(2,101,6,11,2),record(3,102,5,12,3,'Other Payee'),
    record(4,103,undefined,13,4),record(5,104,undefined,14,5),
  ])
  assert.equal(groups.length,5)
})
test('property selection uses immutable buyer account id, never just the unit or buyer name',()=>{
  const properties=profitReceiptProperties([record(1,100,5,10,1560),record(2,101,5,11,1560)])
  assert.deepEqual(properties.map((x)=>x.accountId),[100,101])
  assert.deepEqual(properties.map((x)=>x.records.length),[1,1])
})
test('seller and Network have matching Proof of Income actions with separate financial sources',()=>{
  const accredited=read('client/src/pages/System/Accredited.jsx')
  const library=read('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitAcknowledgementLibrary.jsx')
  const modal=read('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitProofOfIncomeModal.jsx')
  const controller=read('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js')
  assert.match(accredited, /Print Proof of Income<\/button>/)
  assert.match(accredited, /canPrint=\{canPrint\}/)
  assert.match(library, /pageGroups\.map/)
  assert.match(library, /Print Proof of Income/)
  assert.match(modal, /profitReceiptProperties/)
  assert.match(modal, /Selected Releases/)
  assert.match(modal, /Generated receipt history/)
  assert.match(modal, /<CommissionReceiptPreview/)
  assert.match(modal, /<SignedCopyUploadModal/)
  assert.doesNotMatch(modal, /useFetchPost|postApi|mutation\.mutate/)
  assert.match(controller, /p\.seller_group_id/)
  assert.match(controller, /sellerGroupId: Number\(row\.seller_group_id\)/)
})
test('a consolidated summary is visibly not a newly-issued or signed receipt',()=>{
  const modal=read('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitProofOfIncomeModal.jsx')
  const receipt=read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx')
  assert.match(modal, /isConsolidatedSummary: true/)
  assert.match(modal, /selected.length === 1/)
  assert.match(receipt, /receipt\.isConsolidatedSummary/)
  assert.match(receipt, /Consolidated summary of existing Company Profit releases/)
  assert.match(receipt, /receipt\.isConsolidatedSummary \? releases\.map/)
  assert.match(receipt, /!receipt\.isConsolidatedSummary \? <div/)
})
