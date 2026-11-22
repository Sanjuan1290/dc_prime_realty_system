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
const {createListingWorkbook,parseBulkWorkbook,FIELD_HEADERS,NEW_FIELD_HEADERS,FIELDS,INVENTORY_RATE_BASELINE_HEADER}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const listing={id:1,unitCode:'LA-0403',oldUnitIds:'LA-0100',cadastralLots:['1306'],lotType:'Inner',lotAreaSqm:300,installmentPricePerSqm:2200,cashPricePerSqm:1900,reservationFee:50000,legalMiscRate:10,annualInterestRate:0,soaAnnualInterestRate:11.5,soaInterestRateSource:'custom',rawStatus:'sold',status:'Sold / Active'};
const workbook=(item=listing)=>createListingWorkbook({listings:[item],project:{id:7,name:'QA'},editable:true});
const headers=book=>XLSX.utils.sheet_to_json(book.Sheets.Listings,{header:1})[0];
const set=(book,header,value)=>{const column=headers(book).indexOf(header);assert.ok(column>=0,`Missing workbook column: ${header}`);book.Sheets.Listings[XLSX.utils.encode_cell({r:1,c:column})]={v:value,t:typeof value==='number'?'n':'s'}};
const parse=book=>{const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});return parseBulkWorkbook({name:'edits.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes},7)};

test('editable XLSX shows one effective Annual Interest Rate column and a paired New column',async()=>{
  const book=workbook(),columns=headers(book),row=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null})[0];
  for(const field of FIELDS){assert.equal(columns.indexOf(NEW_FIELD_HEADERS[field]),columns.indexOf(FIELD_HEADERS[field])+1);assert.equal(row[NEW_FIELD_HEADERS[field]],'')}
  assert.ok(columns.includes('Cadastral Lots'));assert.ok(!columns.includes('Cadastral Lots (comma-separated)'));
  assert.equal(row['Annual Interest Rate (%)'],11.5);
  assert.equal(columns.includes('Listing Default Annual Interest Rate (%)'),false);
  assert.equal(columns.includes('New Listing Default Annual Interest Rate (%)'),false);
  assert.equal(columns.includes('Interest Rate Source'),false);
  assert.equal(book.Workbook.Sheets[1].Hidden,1);
  assert.equal(book.Custprops.ListingBulkTemplateVersion,3);
  const baseline=XLSX.utils.sheet_to_json(book.Sheets['Original Values'],{defval:null})[0];
  assert.equal(baseline['Annual Interest Rate (%)'],11.5);
  assert.equal(baseline[INVENTORY_RATE_BASELINE_HEADER],0);
  const [parsed]=await parse(book);assert.equal(parsed.original.annualInterestRate,0);assert.equal(parsed.values.annualInterestRate,0);
  const metadataStripped=workbook();delete metadataStripped.Custprops;const [withoutCustomProperties]=await parse(metadataStripped);assert.equal(withoutCustomProperties.original.annualInterestRate,0);
});

test('new Unit ID uses automatic alias history and preserves the contracted buyer SOA rate',async()=>{
  const book=workbook();set(book,'New Unit ID','LA-0403A');const [parsed]=await parse(book);
  const change=prepareBulkListingRow(normalizedListing(listing),parsed.original,parsed.values);
  assert.equal(change.stale,false);assert.equal(change.after.unitCode,'LA-0403A');assert.equal(change.after.oldUnitIds,'LA-0100, LA-0403');assert.equal(change.after.annualInterestRate,0);assert.deepEqual(getProtectedFieldErrors({unitCode:{before:'LA-0403',after:'LA-0403A'}},'sold'),[]);
});

test('New Annual Interest Rate updates the inventory default for Available/Hold listings',async()=>{
  const available={...listing,annualInterestRate:4,soaAnnualInterestRate:4,rawStatus:'available',status:'Available'};
  const book=workbook(available);set(book,'New Annual Interest Rate (%)',5.5);
  const [parsed]=await parse(book),change=prepareBulkListingRow(normalizedListing(available),parsed.original,parsed.values);
  assert.equal(parsed.original.annualInterestRate,4);assert.equal(parsed.values.annualInterestRate,5.5);assert.equal(change.after.annualInterestRate,5.5);
});

test('new numeric zero, area updates and explicit cadastral clearing survive a real XLSX round trip',async()=>{
  const available={...listing,rawStatus:'available',status:'Available'};
  const book=workbook(available);
  set(book,'New Lot Area SQM',325);set(book,'New Reservation Fee',0);set(book,'New Cadastral Lots','-');
  const [parsed]=await parse(book),change=prepareBulkListingRow(normalizedListing(available),parsed.original,parsed.values);
  assert.equal(change.after.lotAreaSqm,325);assert.equal(change.after.reservationFee,0);assert.equal(change.after.cadastralLots,'');assert.equal(change.after.cashPricePerSqm,1900);
});

test('editing a current/reference value or protected buyer interest rate is rejected',async()=>{
  for(const [header,value] of [['Unit ID','LA-OOPS'],['Annual Interest Rate (%)',0],['Project ID',8],['Status','Available']]){
    const book=workbook();set(book,header,value);await assert.rejects(parse(book),/current\/reference|another project|identity or status/);
  }
  const book=workbook();set(book,'New Annual Interest Rate (%)',11.5);const [parsed]=await parse(book);
  const change=prepareBulkListingRow(normalizedListing(listing),parsed.original,parsed.values);
  const protectedErrors=getProtectedFieldErrors({annualInterestRate:{before:parsed.original.annualInterestRate,after:change.after.annualInterestRate}},'sold');
  assert.match(protectedErrors.join(' '),/Annual Interest Rate cannot be changed/);
});

test('deleting some or all current New columns cannot silently turn a v3 template into a legacy template',async()=>{
  for(const removeAll of [false,true]){
    const book=workbook(),rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null});
    const removed=removeAll?Object.values(NEW_FIELD_HEADERS):['New Unit ID'];for(const row of rows)for(const header of removed)delete row[header];
    book.Sheets.Listings=XLSX.utils.json_to_sheet(rows);await assert.rejects(parse(book),/missing New value columns/);
  }
});

test('v3 templates still require every New column when Excel strips custom workbook properties',async()=>{
  const book=workbook();delete book.Custprops;
  const rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null});
  for(const row of rows)for(const header of Object.values(NEW_FIELD_HEADERS))delete row[header];
  book.Sheets.Listings=XLSX.utils.json_to_sheet(rows);
  await assert.rejects(parse(book),/missing New value columns/);
});

test('older v2 editable workbooks still parse with their legacy listing-default interest columns',async()=>{
  const oldHeaders={...FIELD_HEADERS,annualInterestRate:'Listing Default Annual Interest Rate (%)'};
  const oldNewHeaders={...NEW_FIELD_HEADERS,annualInterestRate:'New Listing Default Annual Interest Rate (%)'};
  const original={'Listing ID':1,'Project ID':7,'Status':'Sold / Active','Contract Protection':'Protected'};
  for(const field of FIELDS){original[oldHeaders[field]]=field==='cadastralLots'?'1306':listing[field]}
  original['Annual Interest Rate (%)']=11.5;original['Interest Rate Source']='Buyer SOA';
  const current={...original};
  for(const field of FIELDS)current[oldNewHeaders[field]]='';
  current['New Unit ID']='LA-0403A';
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([current]),'Listings');XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([original]),'Original Values');book.Custprops={ListingBulkTemplateVersion:2};
  const [parsed]=await parse(book);assert.equal(parsed.values.unitCode,'LA-0403A');assert.equal(parsed.original.annualInterestRate,0);assert.equal(parsed.values.annualInterestRate,0);
});

test('legacy direct-edit workbooks remain readable',async()=>{
  const row={'Listing ID':1,'Project ID':7,'Status':'Sold / Active','Contract Protection':'Protected'};
  for(const field of FIELDS)row[field==='cadastralLots'?'Cadastral Lots (comma-separated)':FIELD_HEADERS[field]]=field==='cadastralLots'?'1306':listing[field];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{...row,'Unit ID':'LA-0403A'}]),'Listings');XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([row]),'Original Values');
  const [parsed]=await parse(book);assert.equal(parsed.values.unitCode,'LA-0403A');assert.equal(parsed.original.annualInterestRate,0);assert.equal(parsed.values.cadastralLots,'1306');
});

test('listing mapper keeps the inventory default separate from a buyer-specific 11.5% or explicit 0% SOA rate',()=>{
  for(const rate of [11.5,0]){const row=mapListingRow({annual_interest_rate:4,soa_interest_rate_overridden:1,soa_annual_interest_rate:rate});assert.equal(row.annualInterestRate,4);assert.equal(row.soaAnnualInterestRate,rate);assert.equal(row.soaInterestRateSource,'custom')}
  const inherited=mapListingRow({annual_interest_rate:4,soa_interest_rate_overridden:0,soa_annual_interest_rate:11.5});assert.equal(inherited.soaAnnualInterestRate,4);assert.equal(inherited.soaInterestRateSource,'listing');
});
