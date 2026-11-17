// Identical protocol implementation is kept in each independent deployment root.
import {createHmac,timingSafeEqual} from 'node:crypto';
const columns=['schema_version','source_system','source_transaction_id','source_version','transaction_date','recorded_at','transaction_type','category','description','amount','currency','status','reference_id','source_type','source_revision_sha256'];
const headers=[...columns,'transfer_manifest','transfer_signature'];
const fail=(message,code='INVALID_IMPORT_FILE',status=422)=>{throw Object.assign(new Error(message),{code,status,statusCode:status})};
const key=value=>{
  if(typeof value!=='string'||value.trim().length<32||value.length>512)fail('Finance CSV verification is not configured. Please contact your administrator.','TRANSFER_KEY_REQUIRED',503);
  return value;
};
const risky=/^[\s\uFEFF\u200B]*[=+@\-\uFF1D\uFF0B\uFF20\uFF0D]/u;
const cell=value=>{const s=String(value??''),safe=(risky.test(s)||/^[\t\r\n']/.test(s)?"'":"")+s;return '"'+safe.replaceAll('"','""')+'"'};
const unescape=value=>value.startsWith("'")&&(risky.test(value.slice(1))||/^[\t\r\n']/.test(value.slice(1)))?value.slice(1):value;
const csv=(fields,rows)=>'\uFEFF'+[fields.map(cell).join(','),...rows.map(row=>fields.map(name=>cell(row[name])).join(','))].join('\r\n')+'\r\n';
const signature=(secret,manifest,data)=>createHmac('sha256',secret).update('dc-prime-finance-csv-v2\0').update(manifest).update('\0').update(data).digest('hex');
const signedBytes=(rows,manifest,sig)=>Buffer.from(csv(headers,rows.map(row=>({...row,transfer_manifest:manifest,transfer_signature:sig}))),'utf8');

export function buildSignedFinanceCsv(snapshot,{secret=process.env.FINANCE_TRANSFER_SIGNING_SECRET}={}){
  key(secret);
  if(!snapshot.rows?.length)fail('No posted payments match these export filters.','EMPTY_EXPORT',409);
  if(snapshot.rows.length>500)fail('Choose a smaller date range: at most 500 payments per file.','EXPORT_TOO_LARGE',409);
  const data=csv(columns,snapshot.rows);
  if(data!==String(snapshot.csv))fail('The export data is inconsistent. Refresh and export again.','EXPORT_DATA_MISMATCH',409);
  const manifest=Buffer.from(JSON.stringify(snapshot.manifest),'utf8').toString('base64url');
  const result=signedBytes(snapshot.rows,manifest,signature(secret,manifest,data));
  if(result.length>2*1024*1024)fail('Choose a smaller date range: the Finance CSV exceeds 2 MB.','EXPORT_TOO_LARGE',413);
  return result;
}

function parse(buffer){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>2*1024*1024)fail('Choose a Finance CSV no larger than 2 MB.');
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(buffer)}catch{fail('Choose the original CSV downloaded from Company Finances or HR & Payroll.')}
  if(!text.startsWith('\uFEFF'))fail('Choose the original Finance CSV without resaving it.');
  text=text.slice(1);const records=[];let row=[],field='',quoted=false,closed=false,start=true;
  for(let index=0;index<text.length;index++){
    const c=text[index];
    if(quoted){if(c==='"'){if(text[index+1]==='"'){field+='"';index++}else{quoted=false;closed=true}}else field+=c}
    else if(c==='"'&&start){quoted=true;start=false}
    else if(c===','||c==='\r'){
      if(c==='\r'&&text[index+1]!=='\n')fail('The Finance CSV has been changed. Export a fresh file.');
      row.push(field);if(row.length>headers.length)fail('The Finance CSV has extra columns.');field='';closed=false;start=true;
      if(c==='\r'){records.push(row);row=[];index++;if(records.length>501)fail('Finance CSV files are limited to 500 payments.','TOO_MANY_ROWS')}
    }else if(c==='\n'||closed||start)fail('Choose the original Finance CSV without editing it.');else field+=c;
  }
  if(quoted||field||row.length||!text.endsWith('\r\n'))fail('The Finance CSV is incomplete.');
  if(records[0]?.join('\0')!==headers.join('\0'))fail('This is not a verified Finance CSV. Export a fresh file from Company Finances or HR & Payroll.');
  return records.slice(1).map(values=>{if(values.length!==headers.length)fail('The Finance CSV has missing columns.');return Object.fromEntries(headers.map((name,index)=>[name,unescape(values[index])]))});
}

export function readSignedFinanceCsv(buffer,{secret=process.env.FINANCE_TRANSFER_SIGNING_SECRET}={}){
  const signed=parse(buffer);key(secret);
  if(!signed.length)fail('The Finance CSV contains no payments.','EMPTY_TRANSFER');
  const packed=signed[0].transfer_manifest,sig=signed[0].transfer_signature;
  if(!/^[A-Za-z0-9_-]{1,16384}$/.test(packed)||!/^[a-f0-9]{64}$/.test(sig)||signed.some(row=>row.transfer_manifest!==packed||row.transfer_signature!==sig))fail('This Finance CSV has been changed or could not be verified. Export a fresh file.','TRANSFER_SIGNATURE_INVALID');
  const rows=signed.map(row=>Object.fromEntries(columns.map(name=>[name,row[name]]))),data=csv(columns,rows);
  const expected=signature(secret,packed,data);
  if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex'))||!buffer.equals(signedBytes(rows,packed,sig)))fail('This Finance CSV has been changed or could not be verified. Export a fresh file.','TRANSFER_SIGNATURE_INVALID');
  let manifest;try{manifest=JSON.parse(Buffer.from(packed,'base64url').toString('utf8'))}catch{fail('The Finance CSV metadata is invalid.')}
  return {rows,manifest,rawCsv:Buffer.from(data,'utf8')};
}
