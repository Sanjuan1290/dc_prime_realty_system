// Finance transfer v1. Kept local so the HR Render root deploys independently.
import {createHash,randomUUID} from 'node:crypto';
export const FINANCE_TRANSFER_VERSION = '1.0';
export const FINANCE_TRANSFER_COLUMNS = Object.freeze([
  'schema_version', 'source_system', 'source_transaction_id', 'source_version',
  'transaction_date', 'recorded_at', 'transaction_type', 'category', 'description',
  'amount', 'currency', 'status', 'reference_id', 'source_type', 'source_revision_sha256',
]);
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
export const sourceRevisionHash = row => SHA(JSON.stringify([
  row.source_transaction_id,row.transaction_date,row.recorded_at,row.transaction_type,
  row.category,row.description,row.amount,row.currency,row.status,row.reference_id,row.source_type,
]));
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

export function buildSalaryFinanceSnapshot({payrolls=[],events=null,from,to,generatedAt=new Date().toISOString(),exportId=randomUUID()}){
  const immutableEvents=events!==null;
  if(immutableEvents)payrolls=events;
  if(!payrolls.length)throw BAD('No released salary payments in this date range. Drafts and unpaid payroll are excluded.','EMPTY_EXPORT',409);
  if(payrolls.length>500)throw BAD('Choose a smaller date range: at most 500 payments per file.','EXPORT_TOO_LARGE',409);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw BAD('Choose a valid export date range.');
  const rows=payrolls.map(p=>{
    const event=typeof p.payload_json==='string'?JSON.parse(p.payload_json):p.payload_json;
    const reversal=event?.event_type==='salary.cash_reversed.v1',version=Number(event?.source_event_version);
    if(immutableEvents&&(!event||event.schema_version!=='1.0'||event.currency!=='PHP'||!/^\d{4}-\d{2}-\d{2}$/.test(event.cash_date)||!/^[1-9]\d{0,17}$/.test(event.source_payroll_id)||!Number.isSafeInteger(event.source_event_version)||version>100000))throw BAD('An immutable salary event is invalid. Reconcile the salary history before exporting.','SALARY_EVENT_REQUIRED',409);
    if(!event||event.source_system!=='hr'||!['salary.cash_released.v1','salary.cash_reversed.v1'].includes(event.event_type)||!Number.isSafeInteger(version)||version<1||Boolean(version%2===0)!==reversal||event.direction!==(reversal?'in':'out')||event.cash_date<from||event.cash_date>to||(!immutableEvents&&(String(event.source_payroll_id)!==String(p.employee_payroll_id)||event.cash_date!==p.released_date||amountCents(event.amount)!==amountCents(p.net_fund_release)))||Number.isNaN(Date.parse(event.recorded_at)))throw BAD('A released payment has no matching immutable salary event. Review its payroll record before exporting.','SALARY_EVENT_REQUIRED',409);
    const timestamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(event.recorded_at));
    const row={schema_version:'1.0',source_system:'hr',source_transaction_id:'salary:'+event.source_payroll_id+(version===1?'':':'+version),source_version:'1',transaction_date:event.cash_date,recorded_at:timestamp,transaction_type:reversal?'income':'expense',category:'Salary',description:event.display_label||'Salary payment #'+event.source_payroll_id,amount:money(amountCents(event.amount)),currency:'PHP',status:'posted',reference_id:'',source_type:'salary'};
    return {...row,source_revision_sha256:sourceRevisionHash(row)};
  });
  const csv=makeFinanceTransferCsv(rows),totals=summarizeExportRows(rows);
  const manifest={schema_version:'1.0',source_system:'hr',export_id:exportId,generated_at:generatedAt,currency:'PHP',period:{from,to},filters:{kind:immutableEvents?'all':'expense',source:'salary',category:'all'},status_scope:'posted_only',salary_source:'external',warnings:[],reconciled:true,snapshot:{record_count:totals.count,money_in:totals.money_in,money_out:totals.money_out,net_change:totals.net_change},context:{unfiltered_period_income:totals.money_in,unfiltered_period_expense:totals.money_out,unfiltered_balance_as_of_to:totals.net_change},transactions_sha256:SHA(Buffer.from(csv,'utf8')),checksum_algorithm:'sha256',data_file:'transactions.csv'};
  return {rows,csv,manifest};
}
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
  book.creator='D&C Prime Realty';book.subject='Released HR salary payments';book.created=new Date(snapshot.manifest.generated_at);
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
