import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { validateReleaseReceiptDetails } from '../services/releaseReceiptDetails.js'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read=(file)=>readFileSync(path.join(root,file),'utf8')
const date='2026-10-25'
const example={bankName:'BPI',accountNumber:'0123456789',receiptDate:date,referenceNumber:'OR-2026-10-25-001',witnessName:'Office Staff'}

test('Cash requires witness but reference is server-generated, not user-supplied',()=>{
 const cash=validateReleaseReceiptDetails({...example,bankName:'',accountNumber:''},date,date,'cash')
 assert.equal(cash.bankName,'Not applicable (Cash)')
 assert.equal(cash.accountNumber,'Not applicable')
 assert.equal(cash.referenceNumber,'')
 assert.equal(validateReleaseReceiptDetails({...example,bankName:'',accountNumber:'',referenceNumber:''},date,date,'cash').referenceNumber,'')
 assert.throws(()=>validateReleaseReceiptDetails({...example,bankName:'',accountNumber:'',witnessName:''},date,date,'cash'),/witnessName/)
})

test('Switching to Cash cannot save stale bank details supplied by browser',()=>{
 const result=validateReleaseReceiptDetails(example,date,date,'cash')
 assert.equal(result.bankName,'Not applicable (Cash)')
 assert.equal(result.accountNumber,'Not applicable')
 assert.notEqual(result.bankName,example.bankName)
 assert.notEqual(result.accountNumber,example.accountNumber)
})

test('Non-cash methods still require bank / provider and account information',()=>{
 for(const method of ['bank_transfer','check','other']){
  assert.deepEqual(validateReleaseReceiptDetails(example,date,date,method),example)
  assert.throws(()=>validateReleaseReceiptDetails({...example,bankName:''},date,date,method),/bankName/)
  assert.throws(()=>validateReleaseReceiptDetails({...example,accountNumber:''},date,date,method),/accountNumber/)
 }
})

test('Shared receipt component adapts labels and hides non-applicable Cash inputs',()=>{
 const field=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseReceiptFields.jsx')
 assert.match(field,/!cash && field\(bankLabel/)
 assert.match(field,/!cash && field\(accountLabel/)
 assert.match(field,/Generated automatically after saving/)
 assert.doesNotMatch(field,/Cash Receipt \/ Voucher No\./)
 assert.match(field,/Issuing Bank/)
 assert.match(field,/Account No\. \/ Wallet No\./)
})

test('Both Release All and individual Company Profit forward payment method to shared fields and validation',()=>{
 const bulk=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseAllCommissionsModal.jsx')
 const company=read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx')
 assert.match(bulk,/paymentMethod=\{currentForm\.paymentMethod\}/)
 assert.match(bulk,/validateReleaseReceipt\(forms\[r\.key\]\?\.receiptDetails, undefined, forms\[r\.key\]\?\.paymentMethod\)/)
 assert.match(company,/paymentMethod=\{method\}/)
 assert.match(company,/validateReleaseReceipt\(receiptDetails, undefined, method\)/)
})

test('Both backend release paths canonicalize Cash receipt fields under database NOT NULL constraints',()=>{
 const bulk=read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/InHouseBulkRelease.controller.js')
 const company=read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js')
 assert.match(bulk,/validateReleaseReceiptDetails\(row\?\.receiptDetails, today, today, method\)/)
 assert.match(company,/validateReleaseReceiptDetails\(req\.body\?\.receiptDetails, date, date, method\)/)
 assert.match(read('SERVER/SYSTEM/migrations/20261012_release_receipt_at_payout.sql'),/bank_name VARCHAR\(150\) NOT NULL/)
})

