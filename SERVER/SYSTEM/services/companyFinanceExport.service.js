/** Batch 11: versioned Finance export snapshots, without changing the legacy human-readable CSV.
 * Producers: Realty only. Independent Finance must validate this contract before importing.
 * Do not create correction/void events here; v1 exports currently-visible posted transactions.
 */
import { createHash, randomUUID } from 'node:crypto';
import { dateOnly } from './companyFinances.service.js';

export const FINANCE_TRANSFER_VERSION = '1.0';
export const FINANCE_TRANSFER_COLUMNS = Object.freeze([
  'schema_version', 'source_system', 'source_transaction_id', 'source_version',
  'transaction_date', 'recorded_at', 'transaction_type', 'category', 'description',
  'amount', 'currency', 'status', 'reference_id', 'source_type', 'source_revision_sha256',
]);
export const FINANCE_SOURCES = Object.freeze(['manual', 'property', 'salary', 'commission', 'commission_archive', 'network_payout', 'refund']);
const BAD = (message, code='FINANCE_EXPORT_INVALID', statusCode=400)=>Object.assign(new Error(message), {code,statusCode});
const SHA = x => createHash('sha256').update(x).digest('hex');
const amountCents = value => {
  const s=String(value ?? '').trim();
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(s)) throw BAD('Export contains an invalid amount.', 'FINANCE_EXPORT_DATA_INVALID',409);
  const [whole,fraction='']=s.split('.');
  const pennies=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if (pennies<=0n || pennies>99999999999999n) throw BAD('Export contains an invalid amount.', 'FINANCE_EXPORT_DATA_INVALID',409);
  return pennies;
};
const money = x => `${x / 100n}.${String(x % 100n).padStart(2,'0')}`;
const onlyString=(value,name,max=150) => {
  if (typeof value !== 'string' || value.length>max) throw BAD(`Invalid ${name}.`);
  return value;
};
export const parseFinanceExportFilters = (query={}) => {
  const kind=onlyString(query.kind ?? 'all','type',10);
  const source=onlyString(query.source ?? 'all','source',40);
  const category=onlyString(query.category ?? 'all','category',90);
  if(!['all','income','expense'].includes(kind)) throw BAD('Unsupported transaction type.');
  if(source!=='all'&&!FINANCE_SOURCES.includes(source)) throw BAD('Unsupported transaction source.');
  if(!category.trim()) throw BAD('Category cannot be empty.');
  // Server does exact category matching; no unchecked SQL is constructed from these values.
  return {kind,source,category};
};
export const selectFinanceExportRows = (transactions, filters) => {
  const f=parseFinanceExportFilters(filters);
  return transactions.filter(r => (f.kind==='all'||r.kind===f.kind) &&
    (f.source==='all'||r.source===f.source) && (f.category==='all'||r.category===f.category));
};
export const sourceRevisionHash = row => SHA(JSON.stringify([
  row.source_transaction_id,row.transaction_date,row.recorded_at,row.transaction_type,
  row.category,row.description,row.amount,row.currency,row.status,row.reference_id,row.source_type,
]));
export const asFinanceTransferRows = transactions => {
  const seen=new Set();
  return transactions.map(tx=>{
    const reference=String(tx.reference ?? '');
    if (!/^[a-z_]+:[1-9]\d*$/.test(reference) || seen.has(reference)) {
      throw BAD('Missing or repeated stable source transaction ID.', 'FINANCE_EXPORT_ID_CONFLICT',409);
    }
    seen.add(reference);
    if(!FINANCE_SOURCES.includes(tx.source) || !['income','expense'].includes(tx.kind))
      throw BAD('Unsupported activity type in export.', 'FINANCE_EXPORT_DATA_INVALID',409);
    const d=dateOnly(tx.txn_date);
    const description=String(tx.title ?? '');
    const category=String(tx.category ?? '');
    if (!description || !category || description.length>1500 || category.length>200)
      throw BAD('Export has missing or oversized text fields.', 'FINANCE_EXPORT_DATA_INVALID',409);
    const timestamp=String(tx.recorded_at ?? '');
    if(timestamp && !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(timestamp))
      throw BAD('Invalid source recording timestamp.', 'FINANCE_EXPORT_DATA_INVALID',409);
    const row = {
      schema_version:FINANCE_TRANSFER_VERSION,source_system:'realty',source_transaction_id:reference,
      source_version:'1',transaction_date:d,recorded_at:timestamp,transaction_type:tx.kind,
      category,description,amount:money(amountCents(tx.amount)),currency:'PHP',status:'posted',
      // The consolidated view currently exposes a stable source identifier, NOT its receipt reference.
      reference_id:'',source_type:String(tx.source),
    };
    return {...row,source_revision_sha256:sourceRevisionHash(row)};
  });
};
const csvCell=(value) => {
  const original=String(value ?? '');
  // Quoted RFC4180, with reversible text encoding for spreadsheet-formula prefixes.
  // Batch 13 must decode one leading apostrophe ONLY when the remaining value starts
  // with a risky spreadsheet character, or when it originally started with apostrophe.
  const safe=/^[\s\uFEFF\u200B]*[=+@\-\uFF1D\uFF0B\uFF20\uFF0D]/u.test(original) || /^[\t\r\n']/.test(original)
    ? `'${original}` : original;
  return `"${safe.replaceAll('"','""')}"`;
};
export const makeFinanceTransferCsv = rows => {
  const lines = [FINANCE_TRANSFER_COLUMNS.map(csvCell).join(',')];
  for(const row of rows) lines.push(FINANCE_TRANSFER_COLUMNS.map(name=>csvCell(row[name])).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
};
export const summarizeExportRows = rows => {
  let income=0n,expense=0n;
  for(const row of rows){const a=amountCents(row.amount);if(row.transaction_type==='income')income+=a;else if(row.transaction_type==='expense')expense+=a;else throw BAD('Invalid export type.');}
  return {count:rows.length,money_in:money(income),money_out:money(expense),net_change:income>=expense?money(income-expense):`-${money(expense-income)}`};
};
export const buildFinanceExportSnapshot = ({transactions,from,to,filters={},overview,generatedAt=new Date().toISOString(),exportId=randomUUID()}) => {
  const start=dateOnly(from),end=dateOnly(to);
  if(start>end)throw BAD('From date cannot be after To date.');
  const applied=parseFinanceExportFilters(filters);
  const selected=selectFinanceExportRows(transactions,applied);
  const rows=asFinanceTransferRows(selected);
  if(rows.some(r=>r.transaction_date<start||r.transaction_date>end))throw BAD('Export contains out-of-range activity.','FINANCE_EXPORT_DATA_INVALID',409);
  const csv=makeFinanceTransferCsv(rows);
  const totals=summarizeExportRows(rows);
  const manifest={
    schema_version:FINANCE_TRANSFER_VERSION,source_system:'realty',export_id:exportId,
    generated_at:generatedAt,currency:'PHP',period:{from:start,to:end},filters:applied,
    status_scope:'posted_only',salary_source:overview?.hr_salary_sync?'external':'legacy',
    warnings:[...(overview?.warnings||[])],reconciled:overview?.balance_verified===true,
    snapshot:{record_count:totals.count,money_in:totals.money_in,money_out:totals.money_out,net_change:totals.net_change},
    context:{unfiltered_period_income:String(Number(overview?.money_in ?? 0).toFixed(2)),unfiltered_period_expense:String(Number(overview?.money_out ?? 0).toFixed(2)),unfiltered_balance_as_of_to:String(Number(overview?.available_balance ?? 0).toFixed(2))},
    transactions_sha256:SHA(Buffer.from(csv,'utf8')),
    checksum_algorithm:'sha256',data_file:'transactions.csv',
    import_policy:'new-source-rows-only; reject changed source IDs for manual correction review',
  };
  return {rows,csv,manifest};
};
export const buildFinanceTransferZip = async(snapshot,{ZIP}={}) => {
  // Lazy import: existing report CSV works even when export-only dependencies are absent.
  const JsZip = ZIP || (await import('jszip')).default;
  const zip = new JsZip();
  zip.file('transactions.csv',snapshot.csv);
  zip.file('manifest.json',JSON.stringify(snapshot.manifest,null,2)+'\n');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
};
export const buildFinanceExcel = async(snapshot,{Excel}={}) => {
  const ExcelJS=Excel || (await import('exceljs')).default;
  const book=new ExcelJS.Workbook();
  book.creator='D&C Prime Realty';book.subject='Company Finance export';book.created=new Date(snapshot.manifest.generated_at);
  const data=book.addWorksheet('Transactions',{views:[{state:'frozen',ySplit:1}]});
  data.columns=FINANCE_TRANSFER_COLUMNS.map(name=>({header:name,key:name,width:name==='description'?42:name==='source_transaction_id'?25:name==='source_revision_sha256'?66:Math.max(16,name.length+2)}));
  data.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  data.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}};
  data.autoFilter={from:'A1',to:`O${Math.max(1,snapshot.rows.length+1)}`};
  for(const row of snapshot.rows){
    // Explicit text values: no formula objects and no number coercion for identifiers.
    data.addRow(Object.fromEntries(FINANCE_TRANSFER_COLUMNS.map(k=>[k,String(row[k]??'')])));
  }
  data.getColumn('source_transaction_id').numFmt='@';
  data.getColumn('source_revision_sha256').numFmt='@';
  const sum=book.addWorksheet('Summary');
  sum.columns=[{header:'Metric',key:'name',width:38},{header:'Value',key:'value',width:42}];
  const info=[
    ['Export ID',snapshot.manifest.export_id],['Generated UTC',snapshot.manifest.generated_at],
    ['From',snapshot.manifest.period.from],['To',snapshot.manifest.period.to],
    ['Kind Filter',snapshot.manifest.filters.kind],['Source Filter',snapshot.manifest.filters.source],
    ['Category Filter',snapshot.manifest.filters.category],['Exported Transactions',snapshot.manifest.snapshot.record_count],
    ['Income PHP',snapshot.manifest.snapshot.money_in],['Expense PHP',snapshot.manifest.snapshot.money_out],
    ['Net Change PHP',snapshot.manifest.snapshot.net_change],['Reconciled',String(snapshot.manifest.reconciled)],
    ['Unfiltered Period Income PHP',snapshot.manifest.context.unfiltered_period_income],
    ['Unfiltered Period Expense PHP',snapshot.manifest.context.unfiltered_period_expense],
    ['Unfiltered Balance to Date PHP',snapshot.manifest.context.unfiltered_balance_as_of_to],
    ['Warnings',snapshot.manifest.warnings.join(' | ') || 'None'],
  ];
  for(const [name,value] of info)sum.addRow({name:String(name),value:String(value)});
  sum.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sum.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}};
  const meta=book.addWorksheet('Metadata');
  meta.columns=[{header:'Field',key:'key',width:30},{header:'Value',key:'value',width:100}];
  for(const [key,value] of Object.entries(snapshot.manifest)){
    meta.addRow({key,value:typeof value==='object'?JSON.stringify(value):String(value)});
  }
  meta.getRow(1).font={bold:true};
  return Buffer.from(await book.xlsx.writeBuffer());
};
