// Inspect worksheet headers before validating rows. Exported inventory workbooks
// must never be sent to the "Import New Listings" API.
export const classifyListingWorkbook = (workbook, XLSX) => {
  const sheet = workbook?.Sheets?.Listings || workbook?.Sheets?.[workbook?.SheetNames?.[0]]
  if (!sheet) return 'invalid'
  const header = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || []
  const headers = new Set(header.map((name) => String(name ?? '').trim()))
  if (headers.has('Listing ID') && headers.has('Project ID') && headers.has('Status')) {
    return workbook.Sheets['Original Values'] ? 'bulk-edit' : 'inventory-export'
  }
  const required = [
    ['Unit ID *', 'Unit ID'], ['Lot Type *', 'Lot Type'],
    ['Price / SQM — Installment *', 'Price / SQM — Installment', 'Price / SQM - Installment *', 'Price / SQM - Installment'],
    ['Price / SQM — Cash *', 'Price / SQM — Cash', 'Price / SQM - Cash *', 'Price / SQM - Cash'],
    ['Lot Area SQM *', 'Lot Area SQM'],
  ]
  return required.every((choices) => choices.some((name) => headers.has(name))) ? 'new-listings' : 'invalid'
}


