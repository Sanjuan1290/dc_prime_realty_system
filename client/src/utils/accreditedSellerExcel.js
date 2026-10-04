import * as XLSX from 'xlsx-js-style'

const ROLE_LABELS = {
  division_manager: 'Division Manager',
  sales_director: 'Sales Director',
  unit_manager: 'Unit Manager',
  sales_agent: 'Sales Agent',
  external_group: 'External Network',
}

const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1D4ED8' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

const styleHeader = (sheet, columnCount) => {
  for (let col = 0; col < columnCount; col += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: col })
    if (sheet[address]) sheet[address].s = headerStyle
  }
}

export const exportAccreditedSellersWorkbook = (rows = []) => {
  const headers = [
    'Seller ID',
    'Full Name',
    'First Name',
    'Middle Name',
    'Last Name',
    'Email',
    'Contact Number',
    'Role',
    'Network',
    'Network Type',
    'Reports Under',
    'Reports Under Email',
    'Status',
    'TIN',
    'PRC Number',
    'Accreditation Date',
    'Created Date',
    'Updated Date',
  ]

  const data = rows.map((row) => [
    row.accredited_seller_id ?? '',
    row.full_name || '',
    row.first_name || '',
    row.middle_name || '',
    row.last_name || '',
    row.email || '',
    row.contact_no || '',
    ROLE_LABELS[row.role] || row.role || '',
    row.seller_group_name || '',
    row.seller_group_type === 'external' ? 'External' : row.seller_group_type === 'in_house' ? 'In-House' : '',
    row.reports_under_name || 'Direct to Developer',
    row.reports_under_email || '',
    row.accredited_seller_status || '',
    row.tin_no || '',
    row.prc_no || '',
    row.accredited_seller_accreditation_date || '',
    row.accredited_seller_created_at || '',
    row.accredited_seller_updated_at || '',
  ])

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data])
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(data.length + 1, 1)}` }
  sheet['!cols'] = [
    { wch: 12 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 28 },
    { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 26 }, { wch: 28 },
    { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
  ]
  styleHeader(sheet, headers.length)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Accredited Sellers')
  return workbook
}

export const downloadAccreditedSellersExcel = (rows = []) => {
  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(
    exportAccreditedSellersWorkbook(rows),
    `Accredited-Sellers-${date}.xlsx`,
    { compression: true, cellStyles: true }
  )
}
