/** Pure checks: only cross-check Finance's OWN receipts and ledger.
 * A pass is NOT source-authoritative reconciliation or production approval.
 */
import {validDate, pesos} from './domain.js';
export const MAX_RECON_ROWS=20000;
const exactCents=v=>{
  const s=String(v??'');
  if(!/^-?\d+\.\d{2}$/.test(s))throw new Error('Invalid two-decimal money in reconciliation evidence');
  const neg=s.startsWith('-');const [whole,frac]=s.replace('-','').split('.');
  const amount=BigInt(whole)*100n+BigInt(frac);return neg?-amount:amount;
};
export function validateReconciliationRange(query={},today='2099-12-31'){
  const from=validDate(query.from),to=validDate(query.to);
  if(from>to||to>today)throw Object.assign(new Error('Select a valid completed date range.'),{code:'INVALID_RANGE',status:400});
  const days=(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000;
  if(days>366)throw Object.assign(new Error('Select at most 367 calendar days.'),{code:'RANGE_TOO_LARGE',status:400});
  return {from,to};
}
const rec=(r)=>typeof r.source_row_json==='string'?JSON.parse(r.source_row_json):r.source_row_json;
const ref=(x)=>String(x??'');
export function evaluateReconciliation({from,to,ledgerRows=[],receiptRows=[],aggregateRows=[],activeConflicts=0,truncated=false}){
  const issues=[];
  const issue=(code,reference)=>{if(issues.length<100)issues.push({code,reference:String(reference||'').slice(0,180)});};
  const ledger=new Map();let imported=0,receiptCount=0,sourceIncome=0n,sourceExpense=0n;
  for(const t of ledgerRows){
    const key=`${t.source_system}:${t.source_transaction_id}`;
    if(ledger.has(key))issue('DUPLICATE_SOURCE_ID',key);
    ledger.set(key,t);
    if(t.source_system!=='realty')issue('UNEXPECTED_LEDGER_SOURCE',key);
    if(t.status!=='posted')issue('IMPORTED_TRANSACTION_NOT_POSTED',key);
    if(t.status==='posted'){
      imported++;const cents=exactCents(t.amount);
      if(t.kind==='income')sourceIncome+=cents;
      else if(t.kind==='expense')sourceExpense+=cents;
      else issue('INVALID_LEDGER_KIND',key);
    }
  }
  const seen=new Map(), batches=new Map(), linked=new Set();
  for(const i of receiptRows){
    receiptCount++;const batchId=ref(i.batch_id);
    let b=batches.get(batchId);
    if(!b)batches.set(batchId,b={count:0,income:0n,expense:0n,expectedCount:Number(i.total_rows),expectedIncome:ref(i.selected_money_in),expectedExpense:ref(i.selected_money_out)});
    b.count++;
    let r;
    try {r=rec(i);if(!r||typeof r!=='object')throw Error('invalid');}
    catch{issue('CORRUPT_SOURCE_RECEIPT',batchId);continue;}
    const key=`${i.source_system}:${i.source_transaction_id}`;
    if(i.decision!=='imported'&&i.decision!=='duplicate')issue('INVALID_COMMITTED_DECISION',key);
    try{const cents=exactCents(r.amount);if(r.transaction_type==='income')b.income+=cents;else if(r.transaction_type==='expense')b.expense+=cents;else issue('INVALID_RECEIPT_KIND',key);}catch{issue('INVALID_RECEIPT_MONEY',key);}
    if(r.transaction_date<from||r.transaction_date>to)continue;
    linked.add(key);
    const prior=seen.get(key);
    if(prior&&prior!==ref(i.source_revision_sha256))issue('CONFLICTING_SOURCE_REVISIONS',key);
    seen.set(key,ref(i.source_revision_sha256));
    const t=ledger.get(key);
    if(!t){issue('MISSING_FINANCE_LEDGER_ENTRY',key);continue;}
    if(ref(t.id)!==ref(i.transaction_id))issue('INCORRECT_RECEIPT_LINK',key);
    if(ref(t.source_revision_sha256)!==ref(i.source_revision_sha256)||ref(r.source_revision_sha256)!==ref(i.source_revision_sha256))issue('SOURCE_REVISION_MISMATCH',key);
    if(ref(t.amount)!==ref(r.amount))issue('AMOUNT_MISMATCH',key);
    if(ref(t.kind)!==ref(r.transaction_type))issue('TYPE_MISMATCH',key);
    if(ref(t.transaction_date)!==ref(r.transaction_date))issue('DATE_MISMATCH',key);
    if(i.decision==='imported'&&ref(t.category_id)!==ref(i.category_id))issue('CATEGORY_MAPPING_MISMATCH',key);
  }
  for(const [id,b] of batches){
    if(b.count!==b.expectedCount)issue('BATCH_COUNT_MISMATCH',id);
    if(pesos(b.income)!==b.expectedIncome||pesos(b.expense)!==b.expectedExpense)issue('BATCH_TOTALS_MISMATCH',id);
  }
  for(const key of ledger.keys())if(!linked.has(key))issue('MISSING_COMMITTED_IMPORT_RECEIPT',key);
  if(Number(activeConflicts)>0)issue('OPEN_IMPORT_CONFLICTS',String(activeConflicts));
  if(truncated)issue('RECONCILIATION_RESULT_TRUNCATED','Increase review capacity or narrow date range');
  if(!batches.size)issue('NO_COMMITTED_TRANSFER_BATCH','No committed Realty transfer overlaps the date range');
  const groups={};
  for(const a of aggregateRows){
    const group=a.source_system==='manual'?'manual':a.source_system==='realty'?'realty':'other';
    if(group==='other')issue('UNKNOWN_CASH_SOURCE',ref(a.source_system));
    const bucket=groups[group]??={opening:0n,income:0n,expense:0n};
    const opening=exactCents(a.opening_amount),period=exactCents(a.period_amount);
    const sign=a.kind==='income'?1n:a.kind==='expense'?-1n:0n;
    if(sign===0n)issue('UNKNOWN_CASH_KIND',ref(a.kind));
    bucket.opening+=sign*opening;
    if(a.kind==='income')bucket.income+=period;
    if(a.kind==='expense')bucket.expense+=period;
  }
  const formatBucket=b=>({opening_balance:pesos(b?.opening??0n),money_in:pesos(b?.income??0n),money_out:pesos(b?.expense??0n),closing_balance:pesos((b?.opening??0n)+(b?.income??0n)-(b?.expense??0n))});
  const realty=groups.realty||{opening:0n,income:0n,expense:0n};
  if(realty.income!==sourceIncome||realty.expense!==sourceExpense)issue('SOURCE_AGGREGATE_MISMATCH','realty');
  return {
    period:{from,to},source_system:'realty',currency:'PHP',
    reconciliation_passed:issues.length===0,
    launch_approved:false,
    issues,
    counts:{posted_realties:imported,committed_receipts:receiptCount,committed_batches:batches.size,open_conflicts:Number(activeConflicts)},
    source_totals:{money_in:pesos(sourceIncome),money_out:pesos(sourceExpense),net_change:pesos(sourceIncome-sourceExpense)},
    cash_breakdown:{manual:formatBucket(groups.manual),realty:formatBucket(groups.realty),other:formatBucket(groups.other)},
    limitations:[
      'Finance-side receipts only; authoritative Realty source parity requires a separately signed-off staging comparison.',
      'Manual Finance entries are excluded from Realty transfer parity but included in the Finance ledger.',
      'The v1 transfer format cannot resolve source edits, cancellations or reversals.',
      'Passing reconciliation never authorizes production cutover.'
    ]
  };
}
