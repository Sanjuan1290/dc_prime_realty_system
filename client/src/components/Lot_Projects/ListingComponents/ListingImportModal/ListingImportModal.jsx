import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { FiDownload, FiFileText, FiUpload, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost } from '../../../../utils/useFetch'

const HEADERS = [
  'Cadastral Lot No. *',
  'Unit ID *',
  'Old Unit IDs',
  'Lot Type *',
  'Reservation Fee',
  'Price / SQM — Installment *',
  'Price / SQM — Cash *',
  'Lot Area SQM *',
  'Legal / Misc Rate (%)',
  'Annual Interest Rate (%)',
]

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_FILE_EXTENSIONS = new Set(['xlsx'])

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

const bufferToHex = (buffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')

const fileSha256 = async (file) => {
  if (!window.crypto?.subtle) return ''
  const digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return bufferToHex(digest)
}

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null)

const normalizeSheetRow = (row = {}, index = 0) => ({
  excelRowNumber: index + 2,
  cadastralLotNo: firstDefined(row['Cadastral Lot No. *'], row['Cadastral Lot No.']),
  unitNumber: firstDefined(row['Unit ID *'], row['Unit ID']),
  oldUnitIds: row['Old Unit IDs'],
  lotType: firstDefined(row['Lot Type *'], row['Lot Type']),
  reservationFee: row['Reservation Fee'],
  installmentPricePerSqm: firstDefined(
    row['Price / SQM — Installment *'],
    row['Price / SQM — Installment'],
    row['Price / SQM - Installment *'],
    row['Price / SQM - Installment']
  ),
  cashPricePerSqm: firstDefined(
    row['Price / SQM — Cash *'],
    row['Price / SQM — Cash'],
    row['Price / SQM - Cash *'],
    row['Price / SQM - Cash']
  ),
  lotAreaSqm: firstDefined(row['Lot Area SQM *'], row['Lot Area SQM']),
  legalMiscRate: row['Legal / Misc Rate (%)'],
  annualInterestRate: row['Annual Interest Rate (%)'],
})

const ListingImportModal = ({ project = {}, projectSlug, onClose, onImported }) => {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [fileHash, setFileHash] = useState('')
  const [validation, setValidation] = useState(null)
  const [alert, setAlert] = useState(null)
  const [isWorking, setIsWorking] = useState(false)

  const projectName = project.name || project.lot_project_name || 'Lot Project'
  const projectCode = String(project.locationCode || project.lot_project_location_code || '').trim().toUpperCase()
  const cadastralLots = useMemo(
    () => (project.cadastralLots || [])
      .map((lot) => lot?.lotNumber || lot?.lot_project_cadastral_lot_number || lot)
      .map((lot) => String(lot || '').trim())
      .filter(Boolean),
    [project.cadastralLots]
  )

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new()
    const listingSheet = XLSX.utils.aoa_to_sheet([HEADERS])
    listingSheet['!cols'] = [
      { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 },
      { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 24 },
    ]
    listingSheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    listingSheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(HEADERS.length - 1)}1` }
    for (let index = 0; index < HEADERS.length; index += 1) {
      const address = XLSX.utils.encode_cell({ r: 0, c: index })
      if (listingSheet[address]) listingSheet[address].s = headerStyle
    }

    const instructions = [
      ['D&C Prime Realty — Lot Listing Import Template'],
      ['Project', projectName],
      ['Locked Project Code', `${projectCode || 'PROJECT'}-`],
      ['Important', `In Unit ID, type only the number after the prefix. Example: if the final unit is ${projectCode || 'LA'}-1306, enter 1306.`],
      ['Status', 'All imported listings are automatically created as Available.'],
      ['Documents', 'Project default document requirements are automatically applied.'],
      ['Cadastral Lot', 'Required. Use one cadastral lot number from the Project Reference sheet. Only lots belonging to this project are accepted.'],
      ['Unit ID', `Required. Enter only the unit number after ${projectCode || 'PROJECT'}-. Do not type the project prefix.`],
      ['Lot Type', 'Required. Inner, Corner, or End'],
      ['Rates', 'Enter percentage values only. Example: 10 means 10%.'],
    ]
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions)
    instructionSheet['!cols'] = [{ wch: 22 }, { wch: 90 }]
    if (instructionSheet.A1) instructionSheet.A1.s = { font: { bold: true, sz: 15, color: { rgb: '1E3A8A' } } }

    const referenceRows = [['Valid Cadastral Lot No.'], ...cadastralLots.map((lot) => [String(lot)])]
    const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows)
    referenceSheet['!cols'] = [{ wch: 28 }]
    if (referenceSheet.A1) referenceSheet.A1.s = headerStyle

    XLSX.utils.book_append_sheet(workbook, listingSheet, 'Listings')
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions')
    XLSX.utils.book_append_sheet(workbook, referenceSheet, 'Project Reference')
    const safeName = projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Lot-Project'
    XLSX.writeFile(workbook, `${safeName}-Listing-Import-Template.xlsx`, { compression: true, cellStyles: true })
  }

  const parseExcel = async (selectedFile) => {
    setAlert({ type: 'loading', message: 'Reading and validating the Excel file...' })
    setIsWorking(true)
    setValidation(null)
    try {
      const extension = String(selectedFile.name || '').split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_FILE_EXTENSIONS.has(extension)) throw new Error('Please select an Excel .xlsx file.')
      if (Number(selectedFile.size || 0) > MAX_FILE_SIZE_BYTES) throw new Error('The Excel file is too large. Maximum file size is 10 MB.')
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array', cellDates: false })
      const sheetName = workbook.SheetNames.includes('Listings') ? 'Listings' : workbook.SheetNames[0]
      if (!sheetName) throw new Error('The workbook does not contain a worksheet.')
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
        .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''))
        .map(normalizeSheetRow)
      if (!rows.length) throw new Error('No listing rows were found in the workbook.')
      const hash = await fileSha256(selectedFile)
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-imports/validate`, { rows }, {
        confirmationHandled: 'technical',
        redirectOnUnavailable: false,
        timeoutMs: 120_000,
      })
      setFile(selectedFile)
      setParsedRows(rows)
      setFileHash(hash)
      setValidation(result?.data || null)
      const invalidRows = Number(result?.data?.invalidRows || 0)
      setAlert(invalidRows
        ? { type: 'error', message: `${invalidRows} row(s) need correction before this file can be imported.` }
        : { type: 'success', message: `${rows.length} row(s) validated successfully. Review the preview, then confirm the import.` })
    } catch (error) {
      setFile(null)
      setParsedRows([])
      setValidation(null)
      const suffix = error?.code ? ` (${error.code})` : ''
      setAlert({ type: 'error', message: `${error?.message || 'Could not read or validate the Excel file.'}${suffix}` })
    } finally {
      setIsWorking(false)
    }
  }

  const importRows = async () => {
    if (!file || !parsedRows.length || Number(validation?.invalidRows || 0) > 0) return
    setIsWorking(true)
    setAlert({ type: 'loading', message: `Importing ${parsedRows.length} validated listing(s)...` })
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-imports`, {
        filename: file.name,
        fileSha256: fileHash,
        rows: parsedRows,
      }, {
        redirectOnUnavailable: false,
        timeoutMs: 180_000,
        doubleCheck: {
          type: 'listing-import',
          title: 'Review Listing Import',
          confirmLabel: `Confirm & Import ${parsedRows.length} Listings`,
          data: {
            project: projectName,
            filename: file.name,
            rowCount: parsedRows.length,
            status: 'Available',
            documents: 'Project Defaults',
          },
        },
      })
      setAlert({ type: 'success', message: result?.message || 'Listings imported successfully.' })
      await onImported?.(result?.data)
    } catch (error) {
      const errors = error?.data?.errors || error?.errors || []
      const detail = errors.length
        ? `${error.message} ${errors.slice(0, 3).map((item) => `Row ${item.row}: ${item.message}`).join(' ')}`
        : (error?.message || 'Import failed.')
      const suffix = error?.code ? ` (${error.code})` : ''
      setAlert({ type: 'error', message: `${detail}${suffix}` })
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Import Listings from Excel</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{projectName} · Prefix {projectCode || '-'}- · New rows are always Available and use project-default documents.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isWorking} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close import modal"><FiX className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <button type="button" onClick={downloadTemplate} className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:bg-blue-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><FiDownload /></span>
              <span><span className="block font-black text-slate-950">Download Project Template</span><span className="text-xs font-semibold text-slate-600">Contains the exact columns, instructions, and this project's cadastral lot reference.</span></span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isWorking} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 disabled:opacity-50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FiUpload /></span>
              <span><span className="block font-black text-slate-950">Choose Excel File</span><span className="text-xs font-semibold text-slate-600">.xlsx only · The file is previewed and validated before anything is saved.</span></span>
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void parseExcel(selected); event.target.value = '' }} />
          </div>

          {file ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="flex items-center gap-2 font-black text-slate-900"><FiFileText />{file.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{parsedRows.length} detected row(s){fileHash ? ` · SHA-256 ${fileHash.slice(0, 16)}…` : ''}</p></div> : null}

          {validation ? (
            <>
              <section className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase text-slate-500">Detected</p><p className="mt-2 text-2xl font-black">{validation.totalRows || 0}</p></div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Valid</p><p className="mt-2 text-2xl font-black text-emerald-950">{validation.validRows || 0}</p></div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Invalid</p><p className="mt-2 text-2xl font-black text-red-950">{validation.invalidRows || 0}</p></div>
              </section>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="max-h-[360px] overflow-auto">
                  <table className="min-w-[1250px] w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100"><tr>{['Row','Cadastral','Final Unit ID','Old IDs','Lot Type','Reservation Fee','Installment / SQM','Cash / SQM','Area','LMF %','Interest %','Validation'].map((head) => <th key={head} className="px-3 py-3 text-left text-xs font-black uppercase text-slate-600">{head}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {(validation.rows || []).map((row) => <tr key={`${row.excelRowNumber}-${row.unitCode}`} className={row.errors?.length ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-3 font-bold">{row.excelRowNumber}</td>
                        <td className="px-3 py-3">{row.cadastralLots?.join(', ') || '-'}</td>
                        <td className="px-3 py-3 font-black">{row.unitCode || '-'}</td>
                        <td className="px-3 py-3">{row.oldUnitIds || '-'}</td>
                        <td className="px-3 py-3">{row.lotType || '-'}</td>
                        <td className="px-3 py-3">{row.reservationFee}</td>
                        <td className="px-3 py-3">{row.installmentPricePerSqm}</td>
                        <td className="px-3 py-3">{row.cashPricePerSqm}</td>
                        <td className="px-3 py-3">{row.lotAreaSqm}</td>
                        <td className="px-3 py-3">{row.legalMiscRate}</td>
                        <td className="px-3 py-3">{row.annualInterestRate}</td>
                        <td className="px-3 py-3">{row.errors?.length ? <div className="max-w-sm text-xs font-semibold text-red-700">{row.errors.join(' ')}</div> : <span className="font-black text-emerald-700">Ready</span>}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isWorking} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Close</button>
          <button type="button" onClick={importRows} disabled={isWorking || !validation || Number(validation.invalidRows || 0) > 0} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">Import {validation?.validRows || 0} Listings</button>
        </footer>
      </div>
    </div>
  )
}

export default ListingImportModal
