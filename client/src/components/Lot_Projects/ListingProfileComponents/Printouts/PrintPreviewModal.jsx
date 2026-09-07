import { useRef, useState } from 'react'
import { FiDownload, FiLoader, FiPrinter, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { downloadElementAsPdf, printWithTemporaryBlankTitle, sanitizePdfFileName } from './pdfExportUtils'
import OfferToBuyForm from './OfferToBuyForm'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getValue = (source, keys, fallback = '-') => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return source[key]
    }
  }

  return fallback
}

const CheckBox = ({ label, checked = false }) => (
  <span className="mr-2 inline-flex items-center gap-1">
    <span className="text-[10px]">{checked ? '☑' : '☐'}</span>
    {label}
  </span>
)

const PrintHeaderCell = ({ children, className = '' }) => (
  <div className={`border border-black bg-[#d9d9d9] px-2 py-1 text-center text-[11px] font-black ${className}`}>
    {children}
  </div>
)

const PrintCell = ({ children, className = '' }) => (
  <div className={`border border-black px-2 py-1 text-[10px] leading-snug ${className}`}>
    {children}
  </div>
)

const getNormalizedSoaRows = (soaRows = []) => {
  if (!soaRows.length) return []

  return soaRows.map((row, index) => ({
    id: row.id || index + 1,
    dueDate: row.dueDate || row.due_date || '-',
    description: row.description || row.payment_description || '-',
    dueAmount: cleanMoney(row.dueAmount ?? row.due_amount),
    penalty: cleanMoney(row.penalty ?? row.penaltyAmount ?? row.penalty_amount),
    datePaid: row.datePaid || row.date_paid || '-',
    amountPaid: cleanMoney(row.amountPaid ?? row.amount_paid),
    referenceId: row.referenceId || row.reference_id || row.reference || '-',
    remainingBalance: cleanMoney(
      row.remainingBalance ??
        row.endingBalance ??
        row.runningBalance ??
        row.ending_balance
    ),
  }))
}

const OfferToBuyPreview = ({ listing = {}, client = {}, soaRows = [] }) => (
  <OfferToBuyForm listing={listing} client={client} soaRows={soaRows} />
)

const SOAPreview = ({ listing = {}, client = {}, soaRows = [] }) => {
  const rows = getNormalizedSoaRows(soaRows, listing)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const legalMisc = cleanMoney(getValue(listing, ['lmfAmount', 'legalMiscAmount'], 0))
  const totalAmount = tcp
  const latestBalance = cleanMoney(rows[rows.length - 1]?.remainingBalance || 0)

  return (
    <div className="print-export-page mx-auto w-[920px] bg-white p-5 text-black shadow-lg print:shadow-none">
      <div className="border-2 border-black p-4">
        <div className="grid grid-cols-[1fr_345px] gap-5">
          <div>
            <h1 className="text-lg font-black tracking-wide">D&amp;C PRIME REALTY</h1>
            <p className="mt-1 text-[10px] font-semibold leading-tight">
              Magsaysay St., Indang, Cavite.
            </p>
            <p className="text-[10px] font-semibold leading-tight">
              4122 Philippines
            </p>
            <p className="text-[10px] font-semibold leading-tight">
              (046) 866-0616
            </p>
          </div>

          <div className="border-2 border-black">
            <h2 className="border-b-2 border-black py-1 text-center text-lg font-black">
              STATEMENT OF ACCOUNT
            </h2>

            {[
              ['Statement Date:', getValue(listing, ['statementDate'], new Date().toISOString().slice(0, 10))],
              ['Property Address:', getValue(listing, ['project_location', 'location'], '-')],
              ['Buyer’s Name:', getValue(client, ['buyerName'], getValue(listing, ['buyer_name'], '-'))],
              ['Unit No:', getValue(listing, ['unit_id', 'unitCode'], '-')],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[115px_1fr] border-b border-black text-[10px]">
                <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
                <div className="px-1.5 py-0.5 font-bold">{value}</div>
              </div>
            ))}

            <h3 className="border-b-2 border-black py-1 text-center text-base font-black">
              AMOUNT DETAILS
            </h3>

            {[
              ['Total Contract Price:', money(tcp)],
              ['Legal Miscellaneous (included):', money(legalMisc)],
              ['Total Amount:', money(totalAmount)],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[170px_1fr] border-b border-black text-[10px] last:border-b-0">
                <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
                <div className="px-1.5 py-0.5 text-right font-black">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-28">
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                {[
                  'Due Date',
                  'Description',
                  'Due Amount',
                  'Penalty',
                  'Date Paid',
                  'Amount Paid',
                  'Reference',
                  'Remaining Balance',
                ].map((head) => (
                  <th
                    key={head}
                    className="border-2 border-black px-2 py-2 text-center font-black"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {formatDate(row.dueDate)}
                  </td>

                  <td className="border border-black px-2 py-1 font-bold">
                    {row.description}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-black">
                    {money(row.dueAmount)}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-bold">
                    {Number(row.penalty || 0) > 0 ? money(row.penalty) : '0.00'}
                  </td>

                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {formatDate(row.datePaid)}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-bold">
                    {Number(row.amountPaid || 0) > 0 ? money(row.amountPaid) : ''}
                  </td>

                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {row.referenceId || '-'}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-black">
                    {money(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="grid grid-cols-[300px_150px] text-[12px]">
            <p className="px-2 text-right font-semibold">
              Total amount to fully pay as of statement date
            </p>
            <p className="px-2 text-right font-black">{money(latestBalance)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const isPrintableDocumentUrl = (url = '') => {
  const clean = String(url || '').trim()
  if (!clean) return false
  if (clean.startsWith('/mock-documents/')) return false
  return clean.startsWith('data:image/') || clean.startsWith('http://') || clean.startsWith('https://')
}

const DocumentsPrintPreview = ({ documents = [] }) => {
  const printableDocuments = documents.flatMap((document) => {
    const urls = document.images?.length ? document.images : [document.fileUrl || document.file_url]
    return urls
      .filter(isPrintableDocumentUrl)
      .map((url) => ({ url, name: document.name || document.document_name || document.fileName || 'Uploaded Document' }))
  })

  return (
    <div className="mx-auto w-[850px] bg-white p-6 shadow-lg print:shadow-none">
      {printableDocuments.length ? (
        <div className="flex flex-col gap-6">
          {printableDocuments.map((document, index) => (
            <div
              key={`${document.url}-${index}`}
              className="print-export-page flex min-h-[980px] flex-col items-center justify-center border border-slate-300 bg-white p-4 print:min-h-screen print:border-0"
            >
              <p className="mb-3 text-center text-xs font-black text-slate-700 print:hidden">{document.name}</p>
              <img
                src={document.url}
                alt={document.name || `Document ${index + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[720px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div>
            <p className="text-lg font-black text-slate-800">No printable uploaded documents</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">Upload image documents first. Mock document paths are intentionally ignored.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const PrintPreviewModal = ({
  title,
  type,
  listing = {},
  client = {},
  soaRows = [],
  documents = [],
  onClose,
}) => {
  const previewContentRef = useRef(null)
  const [pdfNotice, setPdfNotice] = useState(null)

  const handlePrint = () => {
    printWithTemporaryBlankTitle()
  }

  const handleDownloadPdf = async () => {
    if (!previewContentRef.current) return

    setPdfNotice({ type: 'loading', message: 'Opening PDF save window...' })

    try {
      const unitLabel = getValue(listing, ['unit_id', 'unitCode', 'unitNo'], '')
      await downloadElementAsPdf(previewContentRef.current, {
        filename: sanitizePdfFileName(`${title || 'printout'}${unitLabel ? `-${unitLabel}` : ''}`),
      })
      setPdfNotice({ type: 'success', message: 'PDF window opened. Choose Save as PDF in the print dialog.' })
    } catch (error) {
      setPdfNotice({
        type: 'error',
        message: error?.message || 'Failed to open the PDF save window.',
      })
    }
  }

  const isDownloadingPdf = pdfNotice?.type === 'loading'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }

        @media print {
          html,
          body,
          #root {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-export-page {
            margin: 0 auto !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }

          .print-export-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }

        .pdf-export-root .print-export-page {
          margin: 0 auto !important;
          box-shadow: none !important;
          break-after: page;
          page-break-after: always;
        }

        .pdf-export-root .print-export-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
      `}</style>

      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 print:hidden">
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            <p className="text-sm font-semibold text-slate-500">
              Review the printable page, print it, or open a clean Save-as-PDF window.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <FiX className="mx-auto" />
          </button>
        </div>

        {pdfNotice ? (
          <div className="shrink-0 px-6 pt-4 print:hidden">
            <StatusAlert
              type={pdfNotice.type}
              message={pdfNotice.message}
              onClose={pdfNotice.type === 'loading' ? undefined : () => setPdfNotice(null)}
            />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-6 print:bg-white print:p-0">
          <div ref={previewContentRef} className="print-preview-pages bg-white">
            {type === 'offer' ? (
              <OfferToBuyPreview listing={listing} client={client} soaRows={soaRows} />
            ) : null}

            {type === 'soa' ? (
              <SOAPreview listing={listing} client={client} soaRows={soaRows} />
            ) : null}

            {type === 'documents' ? (
              <DocumentsPrintPreview documents={documents} />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t px-6 py-4 print:hidden sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>


          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <FiPrinter />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintPreviewModal
