import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyReceiptDateAndWitness } from '../../client/src/components/Lot_Projects/CommissionComponents/receiptCopyFeedback.js';
import { makeCommissionCashReference } from '../services/commissionCashReference.js';
import { validateReleaseReceiptDetails } from '../services/releaseReceiptDetails.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(root,p), 'utf8');
const fixed = {receiptDate:'2026-10-25', witnessName:'Witness'};
test('Cash reference follows SOA ID-based pattern and distinguishes cash source types',()=>{
  assert.equal(makeCommissionCashReference({date:'2026-10-25',unitCode:'LA-1806',id:9,kind:'seller'}),'CASH-20261025-LA1806-SR000009');
  assert.equal(makeCommissionCashReference({date:'2026-10-25',unitCode:'LA-1806',id:9,kind:'company'}),'CASH-20261025-LA1806-NP000009');
  assert.equal(makeCommissionCashReference({date:'2026-10-25',unitCode:'LA-1806',id:9,kind:'proof'}),'CASH-20261025-LA1806-PR000009');
  assert.throws(()=>makeCommissionCashReference({date:'2026-10-25',unitCode:'LA-1806',id:0,kind:'seller'}));
  assert.throws(()=>makeCommissionCashReference({date:'2026-10-25',unitCode:'LA-1806',id:9,kind:'invalid'}));
});
test('Cash ignores fake/stale bank and supplied reference; witness and valid date remain mandatory',()=>{
  const input={...fixed, bankName:'OLD BANK', accountNumber:'OLD ACCOUNT', referenceNumber:'CLIENT-FAKE'};
  assert.deepEqual(validateReleaseReceiptDetails(input,fixed.receiptDate,fixed.receiptDate,'cash'),{
    bankName:'Not applicable (Cash)', accountNumber:'Not applicable', referenceNumber:'',
    receiptDate:fixed.receiptDate,witnessName:fixed.witnessName,
  });
  assert.throws(()=>validateReleaseReceiptDetails({...fixed,witnessName:''},fixed.receiptDate,fixed.receiptDate,'cash'),/witnessName/);
  assert.throws(()=>validateReleaseReceiptDetails({...fixed,receiptDate:'2026-10-26'},fixed.receiptDate,fixed.receiptDate,'cash'),/Receipt date/);
  assert.throws(()=>validateReleaseReceiptDetails(fixed,fixed.receiptDate,fixed.receiptDate,'check'),/bankName/);
});
test('seller single and batch releases derive references from locked persisted stage, not browser',()=>{
  const individual=read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  const bulk=read('server/controllers/Lot_Projects/Commissions/InHouseBulkRelease.controller.js');
  assert.match(individual,/releasePaymentMethod === 'cash'[^]*makeCommissionCashReference/);
  assert.match(individual,/unitCode: commissionContext\.lot_project_listing_unit_id, id: releaseId, kind: 'seller'/);
  assert.match(bulk,/id: releaseId, kind: 'seller'/);
  assert.match(bulk,/id: company\.id, kind: 'company'/);
  assert.match(bulk,/await connection\.rollback\(\)/);
  assert.match(bulk,/if \(method !== 'cash' && clean\(row\?\.paymentReference\)/);
});
test('individual Network Profit requires real reference for transfer, generates on Cash after stage lock',()=>{
  const src=read('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js');
  assert.match(src,/const suppliedReference = clean\(req\.body\?\.paymentReference\)/);
  assert.match(src,/const reference = method === 'cash'[^]*kind: 'company'/);
  assert.match(src,/payment_method = \?, payment_reference = \?/);
  assert.match(src,/if \(method !== 'cash' && suppliedReference !== receiptDetails\.referenceNumber\)/);
});
test('Proof of Income Cash receipt gets its permanent reference after INSERT, within transaction',()=>{
  const src=read('server/controllers/System/accredited.controller.js');
  const insert=src.indexOf('const [receiptResult] = await connection.query(',src.indexOf('export const createAccreditedSellerProofOfIncomeReceipt'));
  const generate=src.indexOf('referenceNumber = makeCommissionCashReference(',insert);
  const update=src.indexOf('UPDATE lot_project_commission_receipts SET reference_number=?',generate);
  const commit=src.indexOf('await connection.commit()', update);
  assert.ok(insert>0 && generate>insert && update>generate && commit>update);
  assert.match(src,/kind: 'proof'/);
  assert.match(src,/paymentMethod === 'cash' \? 'Not applicable \(Cash\)'/);
});
test('dropdown defaults to Company Profit after asynchronous data load without overriding manual selection',()=>{
  const src=read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
  assert.match(src,/manualBeneficiary \|\| \(isProfitLoading/);
  assert.match(src,/companyProfits\.length \? `company:\$\{companyProfits\[0\]\.id\}`/);
  assert.match(src,/setManualBeneficiary\(event\.target\.value\)/);
  assert.match(src,/Loading Company Profit\.\.\./);
});
test('Proof of Income and individual/batch forms use the same method-aware receipt inputs',()=>{
  const src=read('client/src/pages/System/Accredited.jsx');
  const fields=read('client/src/components/Lot_Projects/CommissionComponents/ReleaseReceiptFields.jsx');
  const seller=read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
  assert.match(src,/<ReleaseReceiptFields value=\{form\}/);
  assert.match(src,/paymentMethod,\s*commissionId:/);
  assert.match(seller,/paymentMethod=\{paymentMethod\}/);
  assert.match(fields,/cash \? <div/);
  assert.match(fields,/Generated automatically after saving/);
  assert.doesNotMatch(fields,/Cash Receipt \/ Voucher No\./);
});
test('Release All shows readiness, copy feedback with precise recipient count; copying keeps payment identities intact',()=>{
  const src=read('client/src/components/Lot_Projects/CommissionComponents/ReleaseAllCommissionsModal.jsx');
  assert.match(src,/readyCount\} of \{pending\.length\} receipt forms ready/);
  assert.match(src,/Ready':'Needs details'/);
  assert.match(src,/aria-live="polite"/);
  assert.match(src,/copyReceiptDateAndWitness\(forms, selected\)/);
  assert.match(src,/if \(result\.copied\) setForms\(result\.forms\)/);
  assert.match(src,/Payment details were not changed/);
});


test('Acknowledgment uses saved auto Cash reference on the printable document, not only the hidden screen footer',()=>{
  const src=read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx');
  const amountLine=src.indexOf('TOTAL AMOUNT: {amountInWords(totalAmount)}');
  const printable=src.indexOf("? 'Cash Reference' : 'Payment Reference'",amountLine);
  const hiddenFooter=src.indexOf('print:hidden',amountLine);
  assert.ok(printable > amountLine && hiddenFooter > printable);
});


test('Copy Date and Witness updates only other recipients and reports the correct count',()=>{
  const forms={
    company: {paymentMethod:'cash',receiptDetails:{receiptDate:'2026-10-25',witnessName:'Head',referenceNumber:'',bankName:'',accountNumber:''}},
    agent: {paymentMethod:'check',receiptDetails:{receiptDate:'2026-10-24',witnessName:'Old',referenceNumber:'CHK-11',bankName:'BDO',accountNumber:'456'}},
    manager: {paymentMethod:'bank_transfer',receiptDetails:{receiptDate:'2026-10-25',witnessName:'Head',referenceNumber:'BANK-22',bankName:'BPI',accountNumber:'123'}},
  };
  const result=copyReceiptDateAndWitness(forms,'company');
  assert.equal(result.copied,1);
  assert.equal(result.reason,'copied');
  assert.equal(result.forms.agent.receiptDetails.witnessName,'Head');
  assert.equal(result.forms.agent.receiptDetails.receiptDate,'2026-10-25');
  assert.equal(result.forms.agent.receiptDetails.referenceNumber,'CHK-11');
  assert.equal(result.forms.agent.receiptDetails.bankName,'BDO');
  assert.equal(result.forms.agent.receiptDetails.accountNumber,'456');
  assert.equal(result.forms.agent.paymentMethod,'check');
  assert.equal(result.forms.manager,forms.manager);
  assert.equal(copyReceiptDateAndWitness(result.forms,'company').reason,'unchanged');
  assert.equal(copyReceiptDateAndWitness({company:{receiptDetails:{receiptDate:'2026-10-25',witnessName:''}}},'company').reason,'missing_source');
});
