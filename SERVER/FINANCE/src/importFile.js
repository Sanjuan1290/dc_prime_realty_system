import {problem} from './domain.js';
import {parseCsv,validateSnapshot,COLUMNS,canonicalCsv} from './importContract.js';

export const MAX_FILE_BYTES = 2*1024*1024;
const invalid=(message,code='INVALID_IMPORT_FILE')=>{throw problem(code,message,422);};
const objectFromMetadata = entries => {
  const raw=Object.fromEntries(entries);
  for(const k of ['period','filters','warnings','snapshot','context']){
    try{raw[k]=JSON.parse(raw[k]);}catch{invalid(`Workbook Metadata.${k} is not valid JSON.`);}
  }
  if('reconciled' in raw){if(raw.reconciled!=='true'&&raw.reconciled!=='false')invalid('Invalid reconciled flag.');raw.reconciled=raw.reconciled==='true';}
  return raw;
};
export function decodeUpload({filename,base64}){
  if(typeof filename!=='string'||filename.length<5||filename.length>180||/[\\/\u0000-\u001f]/.test(filename))invalid('Choose a valid file name.');
  const format=filename.toLowerCase().endsWith('.zip')?'zip':filename.toLowerCase().endsWith('.xlsx')?'xlsx':null;
  if(!format)invalid('Upload the Finance transfer .zip or .xlsx from Batch 11.');
  if(typeof base64!=='string'||!base64||base64.length>Math.ceil(MAX_FILE_BYTES/3)*4+4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))invalid('Invalid file encoding or file too large.');
  const buffer=Buffer.from(base64,'base64');
  if(!buffer.length||buffer.length>MAX_FILE_BYTES||buffer.toString('base64')!==base64)invalid('Invalid or oversized upload.');
  return {filename,format,buffer};
}
/** Inject JSZip / ExcelJS for dependency-free tests. Requires installed libs in deployment. */
export async function parseUpload(file,{JSZip,ExcelJS}={}){
  if(file.format==='zip'){
    const Zip=JSZip||(await import('jszip')).default;
    let zip;try{zip=await Zip.loadAsync(file.buffer);}catch{invalid('ZIP archive cannot be read.');}
    const entries=Object.values(zip.files);
    if(entries.length!==2||entries.some(e=>e.dir||!['manifest.json','transactions.csv'].includes(e.name)))invalid('ZIP must contain only manifest.json and transactions.csv.');
    for(const e of entries){
      // JSZip exposes the uncompressed length from its central directory after loading.
      if(!Number.isSafeInteger(e._data?.uncompressedSize)||e._data.uncompressedSize>5*1024*1024)invalid('ZIP member is too large or has no trustworthy size metadata.');
    }
    let csv,manifest;
    try {
      csv=await zip.file('transactions.csv').async('nodebuffer');
      const json=await zip.file('manifest.json').async('string');
      if(Buffer.byteLength(json)>128*1024||csv.length>5*1024*1024)invalid('ZIP contents exceed limits.');
      manifest=JSON.parse(json);
    }catch(e){if(e.code)throw e;invalid('Corrupted finance ZIP contents.');}
    return validateSnapshot({rows:parseCsv(csv),manifest,rawCsv:csv});
  }
  if(file.format==='xlsx'){
    const Zip=JSZip||(await import('jszip')).default;
    let zip;
    try{zip=await Zip.loadAsync(file.buffer);}catch{invalid('Excel archive cannot be read.');}
    const entries=Object.values(zip.files);
    if(entries.length>50||entries.some(e=>/externalLinks|embeddings|vbaProject|connections\.xml/i.test(e.name)))invalid('Workbook contains unsupported external links or embedded content.');
    let total=0;
    for(const entry of entries){
      if(!Number.isSafeInteger(entry._data?.uncompressedSize))invalid('Workbook ZIP contains invalid size metadata.');
      total+=entry._data.uncompressedSize;
      if(entry._data.uncompressedSize>5*1024*1024||total>10*1024*1024)invalid('Workbook ZIP is too large after decompression.');
    }
    const Excel=ExcelJS||(await import('exceljs')).default;
    const wb=new Excel.Workbook();
    try{await wb.xlsx.load(file.buffer);}catch{invalid('Excel workbook cannot be read.');}
    const names=wb.worksheets.map(w=>w.name);
    if(names.length!==3||!['Transactions','Summary','Metadata'].every(n=>names.includes(n)))invalid('Transfer workbook must contain Transactions, Summary and Metadata sheets only.');
    const tx=wb.getWorksheet('Transactions'),meta=wb.getWorksheet('Metadata');
    if(tx.rowCount>502||meta.rowCount>80)invalid('Workbook exceeds maximum row count.');
    const textCell=(cell,label)=>{
      if(cell.type===0 && /Row \d+ (recorded_at|reference_id)$/.test(label))return '';
      if(cell.type!==3 || typeof cell.value!=='string')invalid(`${label} must be plain text, not a formula, number, link or date.`,'NON_TEXT_WORKBOOK_CELL');
      return cell.value;
    };
    for(const [idx,c] of COLUMNS.entries())if(textCell(tx.getRow(1).getCell(idx+1),'Transaction header')!==c)invalid('Workbook transaction headers differ from Batch 11.');
    const rows=[];
    for(let i=2;i<=tx.rowCount;i++){
      const row=tx.getRow(i);
      if(row.cellCount!==COLUMNS.length)invalid(`Workbook row ${i} has an incorrect number of cells.`);
      rows.push(Object.fromEntries(COLUMNS.map((c,j)=>[c,textCell(row.getCell(j+1),`Row ${i} ${c}`)])));
    }
    if(textCell(meta.getRow(1).getCell(1),'Metadata header')!=='Field'||textCell(meta.getRow(1).getCell(2),'Metadata header')!=='Value')invalid('Workbook Metadata headers differ from Batch 11.');
    const metaEntries=[];
    for(let i=2;i<=meta.rowCount;i++){
      const r=meta.getRow(i);
      if(r.cellCount!==2)invalid(`Metadata row ${i} must contain two text cells.`);
      metaEntries.push([textCell(r.getCell(1),'Metadata key'),textCell(r.getCell(2),'Metadata value')]);
    }
    if(new Set(metaEntries.map(e=>e[0])).size!==metaEntries.length)invalid('Duplicate metadata keys.');
    const manifest=objectFromMetadata(metaEntries);
    // Cross-check Summary tab against verified manifest values to prevent misleading display.
    const sum=wb.getWorksheet('Summary');
    const labels=new Map();
    for(let i=2;i<=sum.rowCount;i++){
      const a=sum.getRow(i).getCell(1),b=sum.getRow(i).getCell(2);
      if(a.type!==3||b.type!==3)invalid('Summary cells must be text.');
      if(labels.has(a.value))invalid('Duplicate Summary label.');labels.set(a.value,b.value);
    }
    for(const [name,expected] of [['Export ID',manifest.export_id],['From',manifest.period?.from],['To',manifest.period?.to],['Exported Transactions',String(manifest.snapshot?.record_count)],['Income PHP',manifest.snapshot?.money_in],['Expense PHP',manifest.snapshot?.money_out],['Net Change PHP',manifest.snapshot?.net_change],['Reconciled',String(manifest.reconciled)]]){
      if(labels.get(name)!==String(expected))invalid(`Summary ${name} does not match Metadata.`);
    }
    return validateSnapshot({rows,manifest,rawCsv:Buffer.from(canonicalCsv(rows),'utf8')});
  }
  invalid('Unsupported transfer file.');
}
