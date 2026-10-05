import * as XLSX from 'xlsx-js-style'

// One column layout for both Import Members (template) and Export Members, so a
// Network can be exported, edited in Excel, and imported again without remapping.
export const NETWORK_MEMBER_EXCEL_HEADERS = Object.freeze([
  'First Name',
  'Middle Name',
  'Last Name',
  'Email',
  'Contact Number',
  'Role',
  'Reports Under Email',
  'TIN',
  'PRC Number',
])

// Reference-only columns appended after the import columns. The importer ignores them.
const EXPORT_REFERENCE_HEADERS = ['Status', 'Accreditation Date', 'Reports Under Name']

const ROLE_CODES = {
  division_manager: 'DM',
  sales_director: 'SD',
  unit_manager: 'UM',
  sales_agent: 'SA',
}

const ROLE_ORDER = { division_manager: 0, sales_director: 1, unit_manager: 2, sales_agent: 3 }

const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1D4ED8' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

const referenceHeaderStyle = {
  font: { bold: true, color: { rgb: '334155' } },
  fill: { fgColor: { rgb: 'E2E8F0' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

const rate4 = (value) => Number(Number(value || 0).toFixed(4))

const safeFilePart = (value) => String(value || 'Network')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '') || 'Network'

const splitFullName = (member = {}) => {
  if (member.first_name || member.last_name) {
    return [member.first_name || '', member.middle_name || '', member.last_name || '']
  }
  const parts = String(member.full_name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return [parts[0] || '', '', '']
  return [parts[0], parts.slice(1, -1).join(' '), parts[parts.length - 1]]
}

const styleRow = (sheet, rowIndex, from, to, style) => {
  for (let col = from; col < to; col += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: col })
    if (sheet[address]) sheet[address].s = style
  }
}

/**
 * Exports one In-House Network's members in the import-template layout,
 * plus a second sheet with the Network's project rates.
 */
export const exportNetworkMembersWorkbook = ({ network = {}, members = [], projectRates = [] } = {}) => {
  const sellers = members
    .filter((member) => !Number(member.is_system_dummy || 0))
    .filter((member) => ROLE_CODES[member.role])
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
      || String(a.full_name || '').localeCompare(String(b.full_name || '')))

  const memberRows = sellers.map((member) => {
    const [first, middle, last] = splitFullName(member)
    const active = member.accredited_seller_status === 'active' && (member.user_status || 'active') === 'active'
    return [
      first,
      middle,
      last,
      member.email || '',
      member.contact_no || '',
      ROLE_CODES[member.role],
      member.reports_under_email || '',
      member.tin_no || '',
      member.prc_no || '',
      active ? 'Active' : 'Inactive',
      member.accredited_seller_accreditation_date ? String(member.accredited_seller_accreditation_date).slice(0, 10) : '',
      member.reports_under_name || '',
    ]
  })

  const headers = [...NETWORK_MEMBER_EXCEL_HEADERS, ...EXPORT_REFERENCE_HEADERS]
  const membersSheet = XLSX.utils.aoa_to_sheet([headers, ...memberRows])
  membersSheet['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    { wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 18 }, { wch: 28 },
  ]
  membersSheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(memberRows.length + 1, 2)}` }
  styleRow(membersSheet, 0, 0, NETWORK_MEMBER_EXCEL_HEADERS.length, headerStyle)
  styleRow(membersSheet, 0, NETWORK_MEMBER_EXCEL_HEADERS.length, headers.length, referenceHeaderStyle)

  const rateHeaders = [
    'Project', 'Pool Rate %', 'Company Profit %', 'Distributed Pool %',
    'Division Manager %', 'Sales Director %', 'Unit Manager %', 'Sales Agent %',
  ]
  const rateRows = projectRates.map((rate) => [
    rate.lot_project_name || `Project #${rate.lot_project_id}`,
    rate4(rate.seller_group_pool_rate),
    rate4(rate.company_profit_rate),
    rate4(rate.distribution_pool_rate ?? (Number(rate.seller_group_pool_rate || 0) - Number(rate.company_profit_rate || 0))),
    rate4(rate.division_manager_rate),
    rate4(rate.sales_director_rate),
    rate4(rate.unit_manager_rate),
    rate4(rate.sales_agent_rate),
  ])
  const ratesSheet = XLSX.utils.aoa_to_sheet([rateHeaders, ...rateRows])
  ratesSheet['!cols'] = [{ wch: 32 }, ...rateHeaders.slice(1).map(() => ({ wch: 18 }))]
  styleRow(ratesSheet, 0, 0, rateHeaders.length, headerStyle)

  const notes = [
    ['Network', network.seller_group_name || 'In-House Network'],
    ['Exported', new Date().toLocaleString()],
    ['Members', `${memberRows.length} seller${memberRows.length === 1 ? '' : 's'}`],
    ['Re-importing', 'Columns A to I match the Import Members template. The grey columns are for reference only and are ignored on import.'],
    ['Inactive rows', 'Import sets every row Active. Delete Inactive members from the sheet first unless you mean to reactivate them.'],
  ]
  const notesSheet = XLSX.utils.aoa_to_sheet(notes)
  notesSheet['!cols'] = [{ wch: 18 }, { wch: 100 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, membersSheet, 'Members')
  XLSX.utils.book_append_sheet(workbook, ratesSheet, 'Project Rates')
  XLSX.utils.book_append_sheet(workbook, notesSheet, 'Notes')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${safeFilePart(network.seller_group_name)}-Members-${stamp}.xlsx`, { compression: true, cellStyles: true })
  return memberRows.length
}
