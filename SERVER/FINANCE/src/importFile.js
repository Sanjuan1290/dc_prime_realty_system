import {problem} from './domain.js';
import {validateSnapshot} from './importContract.js';
import {readSignedFinanceCsv} from './financeTransferCsv.js';
export const MAX_FILE_BYTES=2*1024*1024;
const invalid=message=>{throw problem('INVALID_IMPORT_FILE',message,422)};
export function decodeUpload({filename,base64}){
  if(typeof filename!=='string'||filename.length<5||filename.length>180||/[\\/\u0000-\u001f]/.test(filename))invalid('Choose a valid file name.');
  if(!filename.toLowerCase().endsWith('.csv'))invalid('Only Export to Finance CSV files from Company Finances or HR & Payroll are accepted.');
  if(typeof base64!=='string'||!base64||base64.length>Math.ceil(MAX_FILE_BYTES/3)*4+4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))invalid('Invalid file encoding or file too large.');
  const buffer=Buffer.from(base64,'base64');
  if(!buffer.length||buffer.length>MAX_FILE_BYTES||buffer.toString('base64')!==base64)invalid('Invalid or oversized upload.');
  return {filename,format:'csv',buffer};
}
export async function parseUpload(file,options={}){
  if(file.format!=='csv')invalid('Only Export to Finance CSV files are accepted.');
  return validateSnapshot(readSignedFinanceCsv(file.buffer,options));
}
