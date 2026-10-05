import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiUpload,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, getDoubleCheckNotice } from '../../../utils/useFetch'
import { NETWORK_MEMBER_EXCEL_HEADERS as HEADERS } from '../../../utils/networkMemberExcel'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 2000
const ALLOWED_EXTENSIONS = new Set(['xlsx'])
const SAMPLE_ROW_MARKER = 'SAMPLE - DELETE THIS ROW'

const ROLE_LABELS = {
  division_manager: 'DM — Division Manager',
  sales_director: 'SD — Sales Director',
  unit_manager: 'UM — Unit Manager',
  sales_agent: 'SA — Sales Agent',
}

const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1D4ED8' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  },
}

const normalizeSheetRow = (row = {}, index = 0) => ({
  source_row: Number.isInteger(row.__rowNum__) ? row.__rowNum__ + 1 : index + 2,
  first_name: row['First Name'],
  middle_name: row['Middle Name'],
  last_name: row['Last Name'],
  email: row.Email,
  contact_number: row['Contact Number'],
  role: row.Role,
  reports_under_email: row['Reports Under Email'],
  tin: row.TIN,
  prc_number: row['PRC Number'],
})

const safeFilePart = (value) => String(value || 'In-House-Network')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '') || 'In-House-Network'

const ResultBadge = ({ row }) => {
  if (row.errors?.length) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100"><FiAlertTriangle /> Error</span>
  }
  if (row.warnings?.length) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100"><FiAlertTriangle /> {row.action}</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"><FiCheckCircle /> {row.action}</span>
}

const SummaryBox = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  }
  return <div className={`rounded-xl border px-3 py-2 ${tones[tone] || tones.slate}`}><p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-lg font-black">{Number(value || 0).toLocaleString()}</p></div>
}

const NetworkMemberImportModal = ({
  groupId,
  networkName,
  hierarchyHead = null,
  onClose,
  onImported,
}) => {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [alert, setAlert] = useState(null)
  const [isWorking, setIsWorking] = useState(false)

  const headName = hierarchyHead?.full_name || hierarchyHead?.display_name || hierarchyHead?.name || ''
  const headEmail = hierarchyHead?.email || ''
  const visibleRows = useMemo(() => (preview?.rows || []).slice(0, 200), [preview])

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new()
    const exampleHeadEmail = headEmail || 'division.manager@example.com'
    const sampleMemberRow = [
      SAMPLE_ROW_MARKER,
      '',
      'Example',
      'sample.sales.director@example.com',
      '09171234567',
      'SD',
      exampleHeadEmail,
      '123-456-789',
      'PRC-0001',
    ]
    const membersSheet = XLSX.utils.aoa_to_sheet([HEADERS, sampleMemberRow])
    membersSheet['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
      { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 18 },
    ]
    membersSheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    membersSheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(HEADERS.length - 1)}2` }
    // Role codes are intentionally short for bulk entry. Spreadsheet readers that
    // support SheetJS validation metadata can render this as a dropdown.
    membersSheet['!dataValidation'] = [{
      sqref: 'F2:F2001',
      type: 'list',
      formula1: '"DM,SD,UM,SA"',
      allowBlank: false,
    }]
    HEADERS.forEach((_, col) => {
      const address = XLSX.utils.encode_cell({ r: 0, c: col })
      if (membersSheet[address]) membersSheet[address].s = headerStyle
    })
    HEADERS.forEach((_, col) => {
      const address = XLSX.utils.encode_cell({ r: 1, c: col })
      if (membersSheet[address]) {
        membersSheet[address].s = {
          fill: { fgColor: { rgb: 'FEF3C7' } },
          font: { bold: col === 0, color: { rgb: '92400E' } },
          alignment: { vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'FDE68A' } },
            bottom: { style: 'thin', color: { rgb: 'FDE68A' } },
            left: { style: 'thin', color: { rgb: 'FDE68A' } },
            right: { style: 'thin', color: { rgb: 'FDE68A' } },
          },
        }
      }
    })

    const instructions = [
      ['D&C Prime Realty — In-House Network Member Import'],
      ['Import Network', networkName || 'In-House Network'],
      ['Network Assignment', 'The Network is taken from the page where you import. Do not add a Network Name column.'],
      ['Status', 'Every successfully imported member is Active by default.'],
      ['Role Codes', 'Use DM, SD, UM, or SA in the Role column. Capitalization and surrounding spaces do not matter. Full role names are also accepted for backward compatibility.'],
      ['Row Order', 'Rows may be in any order. The system resolves hierarchy as DM → SD → UM → SA.'],
      ['Hierarchy Head', headName ? `${headName}${headEmail ? ` (${headEmail})` : ''}` : 'No hierarchy head detected. Assign the Network head before bulk importing members.'],
      ['DM', 'Division Manager. This is the existing Network hierarchy head/root. The Examples sheet includes the DM so the full DM → SD → UM → SA chain is visible. Bulk import cannot replace the Network hierarchy head.'],
      ['SD', 'Sales Director. Reports Under Email must be the active DM / Network hierarchy head email.'],
      ['UM', 'Unit Manager. Reports Under Email must be an active SD in this Network or another valid SD in the same import file.'],
      ['SA', 'Sales Agent. Reports Under Email must be an active UM in this Network or another valid UM in the same import file.'],
      ['Existing Seller', 'An Active seller in another Network is blocked. Set the seller Inactive first. Seller role changes are not allowed through bulk import.'],
      ['PRC Number', 'Required for every new member. PRC Number and TIN cannot belong to another Active seller, even one registered with a different email. Set that seller Inactive first.'],
      ['Optional Fields', 'For an existing member, blank Contact Number, TIN, and PRC Number preserve the existing values.'],
      ['Round Trip', 'Export Members on the Network page produces this same layout, so you can export, edit, and import again.'],
      ['Sample Row', 'The Members sheet starts with one highlighted sample row. Delete it before entering your sellers. If left unchanged, the importer ignores it automatically.'],
      ['Maximum Rows', `${MAX_IMPORT_ROWS.toLocaleString()} members per Excel file.`],
    ]
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions)
    instructionsSheet['!cols'] = [{ wch: 24 }, { wch: 110 }]
    if (instructionsSheet.A1) instructionsSheet.A1.s = { font: { bold: true, sz: 15, color: { rgb: '1E3A8A' } } }

    const examples = [
      HEADERS,
      ['Existing', '', 'Division Manager', exampleHeadEmail, '', 'DM', '', '', ''],
      ['Juan', '', 'Santos', 'sales.director@example.com', '09171234567', 'SD', exampleHeadEmail, '', 'PRC-0002'],
      ['Maria', '', 'Reyes', 'unit.manager@example.com', '09181234567', 'UM', 'sales.director@example.com', '', 'PRC-0003'],
      ['Pedro', '', 'Cruz', 'sales.agent@example.com', '09191234567', 'SA', 'unit.manager@example.com', '', 'PRC-0004'],
    ]
    const exampleSheet = XLSX.utils.aoa_to_sheet(examples)
    exampleSheet['!cols'] = membersSheet['!cols']
    HEADERS.forEach((_, col) => {
      const address = XLSX.utils.encode_cell({ r: 0, c: col })
      if (exampleSheet[address]) exampleSheet[address].s = headerStyle
    })

    XLSX.utils.book_append_sheet(workbook, membersSheet, 'Members')
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')
    XLSX.utils.book_append_sheet(workbook, exampleSheet, 'Examples')
    XLSX.writeFile(
      workbook,
      `${safeFilePart(networkName)}-Member-Import-Template.xlsx`,
      { compression: true, cellStyles: true }
    )
  }

  const parseAndPreview = async (selectedFile) => {
    setIsWorking(true)
    setAlert({ type: 'loading', message: 'Reading the Excel file and validating the Network hierarchy...' })
    setPreview(null)
    try {
      const extension = String(selectedFile?.name || '').split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Please select an Excel .xlsx file.')
      if (Number(selectedFile?.size || 0) > MAX_FILE_SIZE_BYTES) throw new Error('Maximum Excel file size is 10 MB.')

      const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array', cellDates: false })
      const sheetName = workbook.SheetNames.includes('Members') ? 'Members' : workbook.SheetNames[0]
      if (!sheetName) throw new Error('The workbook does not contain a worksheet.')
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
        .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''))
        .filter((row) => String(row['First Name'] || '').trim().toUpperCase() !== SAMPLE_ROW_MARKER)
      if (!rawRows.length) throw new Error('No member rows were found. Add sellers to the Members sheet first.')
      if (rawRows.length > MAX_IMPORT_ROWS) throw new Error(`Import is limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows per Excel file.`)

      const parsedRows = rawRows.map(normalizeSheetRow)
      const result = await useFetchPost(`/seller-groups/${groupId}/members/import/preview`, { rows: parsedRows }, {
        redirectOnUnavailable: false,
        timeoutMs: 120_000,
        confirmationHandled: 'technical',
      })
      setFile(selectedFile)
      setRows(parsedRows)
      setPreview(result?.data || null)
      const errors = Number(result?.data?.summary?.errors || 0)
      const invalidRows = (result?.data?.rows || []).filter((row) => row.errors?.length)
      const errorDetails = invalidRows.slice(0, 3).map((row) =>
        `Row ${row.sourceRow}: ${row.errors.join(' ')}`
      ).join(' ')
      const remainingErrors = Math.max(0, invalidRows.length - 3)
      setAlert(errors
        ? {
            type: 'error',
            message: `${errors} row${errors === 1 ? '' : 's'} need correction. ${errorDetails}${remainingErrors ? ` Plus ${remainingErrors} more row${remainingErrors === 1 ? '' : 's'} shown in the preview below.` : ''} Nothing has been imported.`,
          }
        : { type: 'success', message: `${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'} validated. Review the hierarchy preview, then Confirm Import.` })
    } catch (error) {
      setFile(null)
      setRows([])
      setPreview(null)
      setAlert({ type: 'error', message: error?.message || 'Could not read or validate this Excel file.' })
    } finally {
      setIsWorking(false)
    }
  }

  const confirmImport = async () => {
    if (!preview?.canCommit || !rows.length) return
    setIsWorking(true)
    setAlert({ type: 'loading', message: `Importing ${rows.length} member${rows.length === 1 ? '' : 's'} into ${networkName}...` })
    try {
      const result = await useFetchPost(`/seller-groups/${groupId}/members/import/commit`, { rows }, {
        redirectOnUnavailable: false,
        timeoutMs: 180_000,
        doubleCheck: {
          type: 'network-member-import',
          title: 'Review Network Member Import',
          confirmLabel: `Confirm & Import ${preview.summary?.ready || rows.length} Members`,
          data: {
            network: preview.network?.name || networkName,
            filename: file?.name || 'Excel import',
            rowCount: preview.summary?.ready || rows.length,
            createCount: preview.summary?.create || 0,
            updateCount: preview.summary?.update || 0,
            transferCount: preview.summary?.transfer || 0,
          },
        },
      })
      await onImported?.(result)
    } catch (error) {
      if (error?.data?.data) setPreview(error.data.data)
      else if (error?.data?.rows) setPreview(error.data)
      setAlert(getDoubleCheckNotice(error, 'Member import failed. No partial import was saved.'))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiUsers /><p className="text-xs font-black uppercase tracking-wider">In-House Network Bulk Import</p></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Import Members — {networkName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Excel rows may be in any order; the server resolves the hierarchy before anything is saved.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isWorking} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label="Close import modal"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
              <div className="flex items-start gap-3"><FiDownload className="mt-1 h-5 w-5 text-blue-700" /><div><h3 className="font-black text-slate-950">1. Download the template</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">A highlighted sample row is included on the Members sheet. Delete it, then enter or paste your sellers.</p></div></div>
              <button type="button" onClick={downloadTemplate} disabled={isWorking} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"><FiDownload />Download Template (.xlsx)</button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3"><FiUpload className="mt-1 h-5 w-5 text-slate-700" /><div><h3 className="font-black text-slate-950">2. Upload and validate</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">No database changes happen during Preview. Missing or wrong reporting parents are blocked before Confirm Import.</p></div></div>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) parseAndPreview(selected); event.target.value = '' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isWorking} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiFileText />{file ? 'Choose Another Excel File' : 'Choose Excel File'}</button>
              {file ? <p className="mt-2 text-xs font-bold text-slate-500">Selected: {file.name}</p> : null}
            </div>
          </section>

          {preview ? (
            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div><h3 className="font-black text-slate-950">Import Preview</h3><p className="text-sm font-semibold text-slate-500">Target: {preview.network?.name || networkName} · All successful rows become Active</p></div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    <SummaryBox label="Total" value={preview.summary?.total} />
                    <SummaryBox label="Ready" value={preview.summary?.ready} tone="emerald" />
                    <SummaryBox label="Warnings" value={preview.summary?.warnings} tone="amber" />
                    <SummaryBox label="Errors" value={preview.summary?.errors} tone="rose" />
                    <SummaryBox label="Create" value={preview.summary?.create} tone="blue" />
                    <SummaryBox label="Update" value={preview.summary?.update} />
                    <SummaryBox label="Transfer" value={preview.summary?.transfer} tone="amber" />
                  </div>
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[70px_1.35fr_1.2fr_1fr_1.2fr_2fr] bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                    <p>Row</p><p>Member</p><p>Email</p><p>Role</p><p>Reports Under</p><p>Result</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <div key={`${row.sourceRow}-${row.email}`} className="grid grid-cols-[70px_1.35fr_1.2fr_1fr_1.2fr_2fr] items-start gap-3 px-4 py-3 text-sm">
                        <p className="font-black text-slate-500">{row.sourceRow}</p>
                        <p className="font-bold text-slate-950">{row.displayName || '-'}</p>
                        <p className="break-all font-semibold text-slate-600">{row.email || '-'}</p>
                        <p className="font-semibold text-slate-700">{ROLE_LABELS[row.role] || row.roleRaw || '-'}</p>
                        <div><p className="font-semibold text-slate-700">{row.parentDisplayName || row.reportsUnderEmail || 'Direct to Developer'}</p>{row.reportsUnderEmail ? <p className="text-xs text-slate-500">{row.reportsUnderEmail}</p> : null}</div>
                        <div><ResultBadge row={row} />{row.errors?.map((message, index) => <p key={`e-${index}`} className="mt-1 text-xs font-semibold leading-5 text-rose-700">{message}</p>)}{row.warnings?.map((message, index) => <p key={`w-${index}`} className="mt-1 text-xs font-semibold leading-5 text-amber-700">{message}</p>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {(preview.rows?.length || 0) > visibleRows.length ? <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">Showing the first {visibleRows.length.toLocaleString()} of {preview.rows.length.toLocaleString()} rows. All rows were validated by the server.</p> : null}
            </section>
          ) : null}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500">Confirm Import is disabled until every row passes validation. Import is transactional: a failure rolls back the entire file.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isWorking} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
            <button type="button" onClick={confirmImport} disabled={isWorking || !preview?.canCommit} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><FiUpload />{isWorking ? 'Working...' : `Confirm Import${preview?.summary?.ready ? ` (${preview.summary.ready})` : ''}`}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default NetworkMemberImportModal
