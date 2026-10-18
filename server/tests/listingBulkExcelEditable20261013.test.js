import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Run the real client exporter against a minimal workbook recorder. This tests
// the generated sheet structure without requiring browser-only XLSX.downloads.
const clientSource = readFileSync(new URL('../../client/src/utils/listingBulkExcel.js', import.meta.url), 'utf8');
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
      {id: 1, rawStatus: 'available', status: 'Available', unitCode: 'LA-0208', lotAreaSqm: 300, installmentPricePerSqm: 1300},
      {id: 2, rawStatus: 'sold', status: 'Sold / Active', unitCode: 'LA-0401', lotAreaSqm: 300, installmentPricePerSqm: 1800},
    ],
  });
  const { workbook, filename, options } = captured();
  const listingSheet = workbook.Sheets.Listings;
  assert.equal(listingSheet['!protect'], undefined, 'A protected worksheet locks all cells in xlsx-js-style');
  assert.equal(workbook.Sheets['Original Values'] !== undefined, true, 'Original values needed for validation');
  assert.equal(filename, 'Bailen_Bulk_Edit_Listings_all.xlsx');
  assert.equal(options.cellStyles, true);
  const availableIdCell = listingSheet.E2;
  const soldIdCell = listingSheet.E3;
  const availablePriceCell = listingSheet.J2;
  const soldPriceCell = listingSheet.J3;
  assert.equal(availableIdCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(soldIdCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(availablePriceCell.s.fill.fgColor.rgb, 'EFF6FF');
  assert.equal(soldPriceCell.s.fill.fgColor.rgb, 'E5E7EB');
  assert.equal(listingSheet.D3.v.startsWith('Protected'), true);
});

