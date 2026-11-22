import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Run the real client exporter against a minimal workbook recorder. This tests
// the generated sheet structure without requiring browser-only XLSX.downloads.
const clientSource = readFileSync(new URL('../../../CLIENT/SYSTEM/src/utils/listingBulkExcel.js', import.meta.url), 'utf8');
const stub = String.raw`
let capturedWorkbook;
const encodeCol = (column) => {
  let result = '';
  for (let n = column + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
};
const encodeCell = ({r, c}) => encodeCol(c) + (r + 1);
const makeSheet = (rowArray) => {
  const sheet = {};
  rowArray.forEach((row, r) => row.forEach((value, c) => {
    sheet[encodeCell({r, c})] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  }));
  if (rowArray.length) sheet['!ref'] = 'A1:' + encodeCell({r: rowArray.length - 1, c: rowArray[0].length - 1});
  return sheet;
};
const XLSX = {
  utils: {
    encode_cell: encodeCell,
    book_new: () => ({SheetNames: [], Sheets: {}}),
    book_append_sheet: (book, sheet, name) => {book.SheetNames.push(name); book.Sheets[name] = sheet},
    json_to_sheet: (items, options = {}) => {
      const headers = options.header ?? Object.keys(items[0] ?? {});
      return makeSheet([headers, ...items.map(item => headers.map(h => item[h]))]);
    },
    aoa_to_sheet: makeSheet,
  },
  writeFile: (workbook, filename, options) => {
    capturedWorkbook = {workbook, filename, options};
  },
};
export const captured = () => capturedWorkbook;
`;
const moduleSource = clientSource.replace("import * as XLSX from 'xlsx-js-style'", stub);

const exporterPromise = import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);

test('editable Excel export has no sheet-level lock and keeps protected fields visually distinct', async () => {
  const { exportListingWorkbook, captured } = await exporterPromise;
  exportListingWorkbook({
    editable: true,
    status: 'all',
    project: {id: 1, name: 'Bailen'},
    listings: [
      {id: 1, rawStatus: 'available', status: 'Available', unitCode: 'LA-0208', lotAreaSqm: 300, installmentPricePerSqm: 1300, annualInterestRate: 4, soaAnnualInterestRate: 4},
      {id: 2, rawStatus: 'sold', status: 'Sold / Active', unitCode: 'LA-0401', lotAreaSqm: 300, installmentPricePerSqm: 1800, annualInterestRate: 0, soaAnnualInterestRate: 11.5, soaInterestRateSource: 'custom'},
    ],
  });
  const { workbook, filename, options } = captured();
  const listingSheet = workbook.Sheets.Listings;
  assert.equal(listingSheet['!protect'], undefined, 'A protected worksheet locks all cells in xlsx-js-style');
  assert.equal(workbook.Sheets['Original Values'] !== undefined, true, 'Original values needed for validation');
  assert.equal(filename, 'Bailen_Bulk_Edit_Listings_all.xlsx');
  assert.equal(options.cellStyles, true);
  const cellFor = (header, row) => {
    const column = Object.values(listingSheet).find(cell => cell?.v === header);
    const address = Object.keys(listingSheet).find(key => listingSheet[key] === column).replace(/1$/, String(row));
    return listingSheet[address];
  };
  const availableIdCell = cellFor('New Unit ID', 2);
  const soldIdCell = cellFor('New Unit ID', 3);
  const availablePriceCell = cellFor('New Installment Price / SQM', 2);
  const soldPriceCell = cellFor('New Installment Price / SQM', 3);
  assert.equal(cellFor('Unit ID', 2).s.fill.fgColor.rgb, 'E5E7EB', 'Current values are references');
  assert.equal(availableIdCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(soldIdCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(availablePriceCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(soldPriceCell.s.fill.fgColor.rgb, 'E5E7EB');
  assert.equal(listingSheet.D3.v.startsWith('Protected'), true);
  const editableHeaders = Object.values(listingSheet).filter(cell => cell?.t === 's').map(cell => cell.v);
  assert.ok(editableHeaders.includes('Annual Interest Rate (%)'));
  assert.ok(editableHeaders.includes('New Annual Interest Rate (%)'));
  assert.ok(!editableHeaders.includes('Listing Default Annual Interest Rate (%)'));
  assert.ok(!editableHeaders.includes('New Listing Default Annual Interest Rate (%)'));
  assert.ok(!editableHeaders.includes('Interest Rate Source'));
  assert.equal(cellFor('Annual Interest Rate (%)', 2).v, 4);
  assert.equal(cellFor('Annual Interest Rate (%)', 3).v, 11.5);
  assert.equal(cellFor('New Annual Interest Rate (%)', 2).s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(cellFor('New Annual Interest Rate (%)', 3).s.fill.fgColor.rgb, 'E5E7EB');
});

test('Bailen complete inventory export keeps one effective rate column and no New columns', async () => {
  const { exportListingWorkbook, captured } = await exporterPromise;
  exportListingWorkbook({
    editable: false, status: 'all', project: {id: 1, name: 'Bailen Project'},
    listings: [{id: 2, rawStatus: 'sold', status: 'Sold / Active', unitCode: 'LA-0401', annualInterestRate: 0, soaAnnualInterestRate: 11.5, soaInterestRateSource: 'custom'}],
  });
  const { workbook, filename } = captured();
  const listingSheet = workbook.Sheets.Listings;
  const headers = Object.values(listingSheet).filter(cell => cell?.t === 's' && cell.v).map(cell => cell.v);
  assert.equal(filename, 'Bailen_Project_Listings_all.xlsx');
  assert.ok(headers.includes('Annual Interest Rate (%)'));
  assert.ok(!headers.includes('Listing Default Annual Interest Rate (%)'));
  assert.ok(!headers.includes('Interest Rate Source'));
  assert.ok(!headers.some(header => String(header).startsWith('New ')));
});
