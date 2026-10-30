/** Batch 11 v1 strict finance transfer parser. No DB calls. */
import { createHash } from 'node:crypto';
import { problem, phpCents, pesos, validDate, dateInManila } from './domain.js';

export const COLUMNS = Object.freeze(['schema_version','source_system','source_transaction_id','source_version','transaction_date','recorded_at','transaction_type','category','description','amount','currency','status','reference_id','source_type','source_revision_sha256']);
export const SOURCES = Object.freeze(['manual','property','salary','commission','commission_archive','network_payout','refund']);
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const fail=(code,message)=>{throw problem(code,message,422);};
const risky=/^[\s\uFEFF\u200B]*[=+@\-\uFF1D\uFF0B\uFF20\uFF0D]/u;
export function encodeCell(value) {
  const s=String(value??'');
  const safe=(risky.test(s)||/^[\t\r\n']/.test(s)?"'":"")+s;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function canonicalCsv(rows) {
  return '\uFEFF'+[COLUMNS.map(encodeCell).join(','),...rows.map(r=>COLUMNS.map(c=>encodeCell(r[c])).join(','))].join('\r\n')+'\r\n';
}
export function decodeCell(value) {
  const s=String(value);
  if(s.startsWith("'") && (risky.test(s.slice(1))||/^[\t\r\n']/.test(s.slice(1))))return s.slice(1);
  return s;
}
export function parseCsv(data,maxRows=500) {
  if(!Buffer.isBuffer(data))fail('INVALID_CSV','CSV must be UTF-8 bytes.');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data);}catch{fail('INVALID_CSV','CSV must be valid UTF-8.');}
  if(!text.startsWith('\uFEFF'))fail('INVALID_CSV','Batch 11 CSV requires UTF-8 BOM.');
  text=text.slice(1);
  let rows=[],line=[],field='',quoted=false,closed=false,start=true;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=c;
    } else if(c==='"'&&start){quoted=true;start=false;}
    else if(c===','||c==='\r'){
      if(c==='\r' && text[i+1]!=='\n')fail('INVALID_CSV','Use CRLF record endings.');
      line.push(field);field='';closed=false;start=true;
      if(c==='\r'){
        rows.push(line);line=[];i++;
        if(rows.length>maxRows+1)fail('TOO_MANY_ROWS','Transfer exceeds the 500-row staging limit.');
      }
    } else if(c==='\n')fail('INVALID_CSV','Unexpected unquoted newline.');
    else if(closed||start)fail('INVALID_CSV','Batch 11 fields must be quoted.');
    else field+=c;
  }
  if(quoted||field||line.length||!text.endsWith('\r\n'))fail('INVALID_CSV','Incomplete CSV record.');
  if(rows.length===0||rows[0].join('\0')!==COLUMNS.join('\0'))fail('INVALID_COLUMNS','Transfer column names/order do not match Batch 11.');
  const result=rows.slice(1).map((values,i)=>{
    if(values.length!==COLUMNS.length)fail('INVALID_COLUMNS',`Row ${i+2} has incorrect field count.`);
    return Object.fromEntries(COLUMNS.map((c,k)=>[c,decodeCell(values[k])]));
  });
  return result;
}
export function revision(row) { return sha256(JSON.stringify([row.source_transaction_id,row.transaction_date,row.recorded_at,row.transaction_type,row.category,row.description,row.amount,row.currency,row.status,row.reference_id,row.source_type])); }
export function summarize(rows) {
  let moneyIn=0n,moneyOut=0n;
  for(const r of rows){const n=phpCents(r.amount);if(r.transaction_type==='income')moneyIn+=n;else moneyOut+=n;}
  const diff=moneyIn-moneyOut;
  return {record_count:rows.length,money_in:pesos(moneyIn),money_out:pesos(moneyOut),net_change:pesos(diff)};
}
function exactFields(object,keys,code='INVALID_METADATA'){
  if(!object||typeof object!=='object'||Array.isArray(object)||keys.some(k=>!(k in object)))fail(code,'Missing required export metadata.');
}
const validAmount=s=>typeof s==='string'&&/^\d{1,13}\.\d{2}$/.test(s)&&s!=='0.00';
export function validateSnapshot({rows,manifest,rawCsv=null},today=dateInManila()) {
  if(!Array.isArray(rows)||rows.length>500)fail('TOO_MANY_ROWS','Too many transaction rows.');
  exactFields(manifest,['schema_version','source_system','generated_at','currency','period','filters','status_scope','salary_source','warnings','reconciled','snapshot','transactions_sha256','checksum_algorithm','data_file']);
  if(typeof manifest.export_id!=='string'||!manifest.export_id||manifest.export_id.length>180)fail('INVALID_METADATA','Missing export ID.');
  if(manifest.schema_version!=='1.0'||manifest.source_system!=='realty'||manifest.currency!=='PHP'||manifest.status_scope!=='posted_only'||manifest.checksum_algorithm!=='sha256'||manifest.data_file!=='transactions.csv')fail('UNSUPPORTED_CONTRACT','Only reconciled Realty transfer v1.0 is supported.');
  if(manifest.reconciled!==true||!Array.isArray(manifest.warnings)||manifest.warnings.length)fail('RECONCILIATION_REQUIRED','Realty export must be reconciled with no warnings.');
  if(!['legacy','external'].includes(manifest.salary_source))fail('INVALID_METADATA','Invalid salary source.');
  if(!/^[0-9a-f]{64}$/.test(manifest.transactions_sha256))fail('INVALID_METADATA','Invalid transfer checksum.');
  if(typeof manifest.generated_at!=='string'||!/Z$/.test(manifest.generated_at)||Number.isNaN(Date.parse(manifest.generated_at)))fail('INVALID_METADATA','Missing UTC generation timestamp.');
  exactFields(manifest.period,['from','to']);const from=validDate(manifest.period.from),to=validDate(manifest.period.to);
  if(from>to||to>today)fail('INVALID_RANGE','Export range must be a historical date range.');
  exactFields(manifest.filters,['kind','source','category']);
  if(!['all','income','expense'].includes(manifest.filters.kind)||!['all',...SOURCES].includes(manifest.filters.source)||typeof manifest.filters.category!=='string'||!manifest.filters.category)fail('INVALID_METADATA','Invalid export filters.');
  exactFields(manifest.snapshot,['record_count','money_in','money_out','net_change']);
  if(typeof manifest.snapshot.record_count!=='number'||!Number.isSafeInteger(manifest.snapshot.record_count))fail('INVALID_METADATA','Invalid export row count.');
  const actualSha=sha256(rawCsv??Buffer.from(canonicalCsv(rows),'utf8'));
  if(actualSha!==manifest.transactions_sha256)fail('CHECKSUM_MISMATCH','Transfer data hash does not match its manifest.');
  const ids=new Set();
  for(const [i,row] of rows.entries()){
    const pos=i+2;
    if(!row||COLUMNS.some(k=>typeof row[k]!=='string'))fail('INVALID_ROW',`Row ${pos} contains a non-text or missing field.`);
    if(row.schema_version!=='1.0'||row.source_system!=='realty'||row.source_version!=='1'||row.currency!=='PHP'||row.status!=='posted')fail('INVALID_ROW',`Row ${pos} has an unsupported source, version, currency or status.`);
    if(!SOURCES.includes(row.source_type)||!['income','expense'].includes(row.transaction_type))fail('INVALID_ROW',`Row ${pos} has an unsupported transaction type.`);
    if(!/^(property|salary|manual|commission|network|refund):[1-9]\d*$/.test(row.source_transaction_id)||ids.has(row.source_transaction_id))fail('DUPLICATE_SOURCE_ID',`Row ${pos} has a missing or repeated source identity.`);
    ids.add(row.source_transaction_id);
    const typePrefix={manual:'manual',property:'property',salary:'salary',commission:'commission',commission_archive:'commission',network_payout:'network',refund:'refund'}[row.source_type];
    if(row.source_transaction_id.split(':')[0]!==typePrefix)fail('INVALID_ROW',`Row ${pos} has mismatched source identity.`);
    validDate(row.transaction_date);
    if(row.transaction_date<from||row.transaction_date>to||row.transaction_date>today)fail('INVALID_ROW',`Row ${pos} is outside the approved period.`);
    if(row.recorded_at&&!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.recorded_at))fail('INVALID_ROW',`Row ${pos} has invalid recorded time.`);
    if(row.description.length<1||row.description.length>1500||row.category.length<1||row.category.length>200||row.reference_id.length>180)fail('INVALID_ROW',`Row ${pos} has invalid text lengths.`);
    if(!validAmount(row.amount))fail('INVALID_AMOUNT',`Row ${pos} has invalid positive amount.`);
    phpCents(row.amount);
    if(!/^[a-f0-9]{64}$/.test(row.source_revision_sha256)||revision(row)!==row.source_revision_sha256)fail('SOURCE_REVISION_MISMATCH',`Row ${pos} has a changed source fingerprint.`);
    if(manifest.filters.kind!=='all'&&manifest.filters.kind!==row.transaction_type)fail('FILTER_MISMATCH',`Row ${pos} violates export type filter.`);
    if(manifest.filters.source!=='all'&&manifest.filters.source!==row.source_type)fail('FILTER_MISMATCH',`Row ${pos} violates export source filter.`);
    if(manifest.filters.category!=='all'&&manifest.filters.category!==row.category)fail('FILTER_MISMATCH',`Row ${pos} violates category filter.`);
  }
  const s=summarize(rows);
  if(Object.keys(s).some(k=>String(s[k])!==String(manifest.snapshot[k])))fail('TOTAL_MISMATCH','Manifest counts or totals do not match transactions.');
  return {rows,manifest,totals:s};
}

export function classifyImportRow(row,existing,mapping){
  if(existing)return existing.source_revision_sha256===row.source_revision_sha256?'duplicate':'conflict';
  if(!mapping||mapping.kind!==row.transaction_type||Number(mapping.is_active)!==1)return 'unmapped';
  return 'new';
}
