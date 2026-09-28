import * as XLSX from 'xlsx-js-style'

const money = (value) => Number(value || 0)
const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

const exportColumns = [
  ['Employee', 'employee_name'],
  ['Position', 'position'],
  ['Basic', 'basic'],
  ['Deduction', 'deduction'],
  ['OT', 'overtime'],
  ['Rest Day OT', 'rest_day_overtime'],
  ['Allowances', 'allowances'],
  ['Adjustments', 'adjustments'],
  ['Net', 'net'],
]

const safeName = (value) => String(value || 'payroll-summary')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 120) || 'payroll-summary'

const periodFileBase = (summary) => safeName(
  `D&C_Prime_Payroll_Summary_${summary?.period?.periodStart || 'period'}_to_${summary?.period?.periodEnd || ''}`
)

const statusText = (summary) => summary?.official ? 'OFFICIAL PERIOD SUMMARY' : 'DRAFT / MIXED STATUS - NOT OFFICIAL'

export const payrollSummaryExportColumns = exportColumns

export const buildPayrollSummaryCsv = (summary) => {
  const rows = summary?.rows || []
  const lines = [
    ['D&C Prime Realty - Employee Payroll Summary'],
    [`Pay Period: ${summary?.period?.periodLabel || ''}`],
    [`Status: ${statusText(summary)}`],
    [],
    exportColumns.map(([label]) => label),
    ...rows.map((row) => exportColumns.map(([, key]) => ['employee_name', 'position'].includes(key) ? row[key] : money(row[key]))),
    [],
    ['TOTALS'],
    ['Employee Count', summary?.totals?.employee_count || 0],
    ['Total Basic', money(summary?.totals?.total_basic)],
    ['Total Attendance Deduction', money(summary?.totals?.total_attendance_deduction)],
    ['Total Overtime', money(summary?.totals?.total_overtime)],
    ['Total Rest Day OT', money(summary?.totals?.total_rest_day_overtime)],
    ['Total Holiday Pay', money(summary?.totals?.total_holiday_pay)],
    ['Total Night Differential', money(summary?.totals?.total_night_differential)],
    ['Total Allowances', money(summary?.totals?.total_allowances)],
    ['Total Manual Adjustments', money(summary?.totals?.total_manual_adjustments)],
    ['Total Adjustments', money(summary?.totals?.total_adjustments)],
    ['TOTAL FUND RELEASE', money(summary?.totals?.total_fund_release)],
  ]
  return `\uFEFF${lines.map((row) => row.map(csvValue).join(',')).join('\r\n')}`
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const downloadPayrollSummaryCsv = (summary) => {
  const filename = `${periodFileBase(summary)}.csv`
  downloadBlob(new Blob([buildPayrollSummaryCsv(summary)], { type: 'text/csv;charset=utf-8' }), filename)
  return filename
}

const border = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
}

const applyRangeStyle = (sheet, range, style) => {
  const decoded = XLSX.utils.decode_range(range)
  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
    for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col })
      if (!sheet[ref]) sheet[ref] = { t: 's', v: '' }
      sheet[ref].s = { ...(sheet[ref].s || {}), ...style }
    }
  }
}

export const buildPayrollSummaryWorkbook = (summary) => {
  const rows = summary?.rows || []
  const dataStart = 5
  const aoa = [
    ['D&C PRIME REALTY - EMPLOYEE PAYROLL SUMMARY'],
    [`Pay Period: ${summary?.period?.periodLabel || ''}`],
    [`Status: ${statusText(summary)}`],
    [],
    exportColumns.map(([label]) => label),
    ...rows.map((row) => exportColumns.map(([, key]) => ['employee_name', 'position'].includes(key) ? row[key] : money(row[key]))),
  ]

  const totalsStart = aoa.length + 2
  aoa.push([])
  aoa.push(['TOTALS'])
  const totalRows = [
    ['Employee Count', summary?.totals?.employee_count || 0],
    ['Total Basic', money(summary?.totals?.total_basic)],
    ['Total Attendance Deduction', money(summary?.totals?.total_attendance_deduction)],
    ['Total Overtime', money(summary?.totals?.total_overtime)],
    ['Total Rest Day OT', money(summary?.totals?.total_rest_day_overtime)],
    ['Total Holiday Pay', money(summary?.totals?.total_holiday_pay)],
    ['Total Night Differential', money(summary?.totals?.total_night_differential)],
    ['Total Allowances', money(summary?.totals?.total_allowances)],
    ['Total Manual Adjustments', money(summary?.totals?.total_manual_adjustments)],
    ['Total Adjustments', money(summary?.totals?.total_adjustments)],
    ['TOTAL FUND RELEASE', money(summary?.totals?.total_fund_release)],
  ]
  aoa.push(...totalRows)

  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  sheet['!merges'] = [
    XLSX.utils.decode_range('A1:I1'),
    XLSX.utils.decode_range('A2:I2'),
    XLSX.utils.decode_range('A3:I3'),
    XLSX.utils.decode_range(`A${totalsStart}:I${totalsStart}`),
  ]
  sheet['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ]
  sheet['!freeze'] = { xSplit: 0, ySplit: dataStart }

  applyRangeStyle(sheet, 'A1:I1', { font: { name: 'Arial', sz: 16, bold: true }, alignment: { horizontal: 'center' } })
  applyRangeStyle(sheet, 'A2:I3', { font: { name: 'Arial', sz: 11, bold: true }, alignment: { horizontal: 'center' } })
  applyRangeStyle(sheet, `A${dataStart}:I${dataStart}`, {
    font: { name: 'Arial', sz: 10, bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border,
  })

  if (rows.length) {
    applyRangeStyle(sheet, `A${dataStart + 1}:I${dataStart + rows.length}`, {
      font: { name: 'Arial', sz: 10 },
      alignment: { vertical: 'center', wrapText: true },
      border,
    })
    for (let row = dataStart + 1; row <= dataStart + rows.length; row += 1) {
      for (let col = 2; col <= 8; col += 1) {
        const ref = XLSX.utils.encode_cell({ r: row - 1, c: col })
        if (sheet[ref]) sheet[ref].z = '#,##0.00'
      }
    }
  }

  applyRangeStyle(sheet, `A${totalsStart}:I${totalsStart}`, {
    font: { name: 'Arial', sz: 11, bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    border,
  })
  const totalsEnd = totalsStart + totalRows.length
  applyRangeStyle(sheet, `A${totalsStart + 1}:B${totalsEnd}`, {
    font: { name: 'Arial', sz: 10, bold: true },
    border,
  })
  for (let row = totalsStart + 2; row <= totalsEnd; row += 1) {
    const ref = `B${row}`
    if (sheet[ref]) sheet[ref].z = '#,##0.00'
  }
  const totalFundRef = `B${totalsEnd}`
  if (sheet[totalFundRef]) sheet[totalFundRef].s = {
    ...(sheet[totalFundRef].s || {}),
    font: { name: 'Arial', sz: 11, bold: true, underline: true },
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Payroll Summary')
  return workbook
}

export const downloadPayrollSummaryExcel = (summary) => {
  const filename = `${periodFileBase(summary)}.xlsx`
  XLSX.writeFile(buildPayrollSummaryWorkbook(summary), filename, { compression: true, cellStyles: true })
  return filename
}
