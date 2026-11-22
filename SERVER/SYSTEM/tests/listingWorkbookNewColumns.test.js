import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {normalizedListing,prepareBulkListingRow,getProtectedFieldErrors} from '../controllers/Lot_Projects/Listings/listingBulkFields.js';
import {mapListingRow} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
const require=createRequire(new URL('../../../CLIENT/SYSTEM/package.json',import.meta.url));
const XLSX=require('xlsx-js-style');
const source=readFileSync(new URL('../../../CLIENT/SYSTEM/src/utils/listingBulkExcel.js',import.meta.url),'utf8')
  .replace("import * as XLSX from 'xlsx-js-style'",`import XLSX from '${pathToFileURL(require.resolve('xlsx-js-style')).href}'`);
const {createListingWorkbook,parseBulkWorkbook,FIELD_HEADERS,NEW_FIELD_HEADERS,FIELDS}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const listing={id:1,unitCode:'LA-0403',oldUnitIds:'LA-0100',cadastralLots:['1306'],lotType:'Inner',lotAreaSqm:300,installmentPricePerSqm:2200,cashPricePerSqm:1900,reservationFee:50000,legalMiscRate:10,annualInterestRate:0,soaAnnualInterestRate:11.5,soaInterestRateSource:'custom',rawStatus:'sold',status:'Sold / Active'};
const workbook=(item=listing)=>createListingWorkbook({listings:[item],project:{id:7,name:'QA'},editable:true});
const headers=book=>XLSX.utils.sheet_to_json(book.Sheets.Listings,{header:1})[0];
const set=(book,header,value)=>{book.Sheets.Listings[XLSX.utils.encode_cell({r:1,c:headers(book).indexOf(header)})]={v:value,t:typeof value==='number'?'n':'s'}};
const parse=book=>{const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});return parseBulkWorkbook({name:'edits.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes},7)};

test('editable XLSX has adjacent current/new columns, blank new values, readable interest sources and a hidden baseline',async()=>{
  const book=workbook(),columns=headers(book),row=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null})[0];
  for(const field of FIELDS){assert.equal(columns.indexOf(NEW_FIELD_HEADERS[field]),columns.indexOf(FIELD_HEADERS[field])+1);assert.equal(row[NEW_FIELD_HEADERS[field]],'')}
  assert.ok(columns.includes('Cadastral Lots'));assert.ok(!columns.includes('Cadastral Lots (comma-separated)'));
  assert.equal(row['Annual Interest Rate (%)'],11.5);assert.equal(row['Listing Default Annual Interest Rate (%)'],0);assert.equal(row['Interest Rate Source'],'Buyer SOA');
  assert.equal(book.Workbook.Sheets[1].Hidden,1);
  const [parsed]=await parse(book);assert.deepEqual(parsed.values,parsed.original);assert.equal(parsed.original.annualInterestRate,0);
});
test('new Unit ID uses the existing automatic alias history; blank new columns preserve all other values',async()=>{
  const book=workbook();set(book,'New Unit ID','LA-0403A');const [parsed]=await parse(book);
  const change=prepareBulkListingRow(normalizedListing(listing),parsed.original,parsed.values);
  assert.equal(change.stale,false);assert.equal(change.after.unitCode,'LA-0403A');assert.equal(change.after.oldUnitIds,'LA-0100, LA-0403');assert.equal(change.after.annualInterestRate,0);assert.deepEqual(getProtectedFieldErrors({unitCode:{before:'LA-0403',after:'LA-0403A'}},'sold'),[]);
});
test('new numeric zero is an edit; new area and explicit cadastral clearing survive a real XLSX round trip',async()=>{
  const book=workbook({...listing,rawStatus:'available',status:'Available'});
  set(book,'New Lot Area SQM',325);set(book,'New Reservation Fee',0);set(book,'New Cadastral Lots','-');
  const [parsed]=await parse(book),change=prepareBulkListingRow(normalizedListing(listing),parsed.original,parsed.values);
  assert.equal(change.after.lotAreaSqm,325);assert.equal(change.after.reservationFee,0);assert.equal(change.after.cadastralLots,'');assert.equal(change.after.cashPricePerSqm,1900);
});
test('editing a reference field, displayed buyer SOA rate or immutable ID is rejected',async()=>{
  for(const [header,value] of [['Unit ID','LA-OOPS'],['Annual Interest Rate (%)',0],['Listing Default Annual Interest Rate (%)',11.5],['Project ID',8],['Status','Available']]){
    const book=workbook();set(book,header,value);await assert.rejects(parse(book),/current\/reference|another project|identity or status/);
  }
});
test('deleting some or all new columns cannot silently turn a new template into a legacy template',async()=>{
  for(const removeAll of [false,true]){
    const book=workbook(),rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null});
    const removed=removeAll?Object.values(NEW_FIELD_HEADERS):['New Unit ID'];for(const row of rows)for(const header of removed)delete row[header];
    book.Sheets.Listings=XLSX.utils.json_to_sheet(rows);await assert.rejects(parse(book),/missing New value columns/);
  }
});
test('legacy workbooks retain direct-edit compatibility, old cadastral headers and original listing interest semantics',async()=>{
  const row={'Listing ID':1,'Project ID':7,'Status':'Sold / Active','Contract Protection':'Protected'};
  for(const field of FIELDS)row[field==='cadastralLots'?'Cadastral Lots (comma-separated)':field==='annualInterestRate'?'Annual Interest Rate (%)':FIELD_HEADERS[field]]=field==='cadastralLots'?'1306':listing[field];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{...row,'Unit ID':'LA-0403A'}]),'Listings');XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([row]),'Original Values');
  const [parsed]=await parse(book);assert.equal(parsed.values.unitCode,'LA-0403A');assert.equal(parsed.original.annualInterestRate,0);assert.equal(parsed.values.cadastralLots,'1306');
});
test('listing mapper keeps the default separate from a buyer-specific 11.5% or explicit 0% SOA rate',()=>{
  for(const rate of [11.5,0]){const row=mapListingRow({annual_interest_rate:4,soa_interest_rate_overridden:1,soa_annual_interest_rate:rate});assert.equal(row.annualInterestRate,4);assert.equal(row.soaAnnualInterestRate,rate);assert.equal(row.soaInterestRateSource,'custom')}
  const inherited=mapListingRow({annual_interest_rate:4,soa_interest_rate_overridden:0,soa_annual_interest_rate:11.5});assert.equal(inherited.soaAnnualInterestRate,4);assert.equal(inherited.soaInterestRateSource,'listing');
});
