import { useCallback, useState } from 'react'
import PrintPageShell from './PrintPageShell'
import PdfPrintPages from './PdfPrintPages'
import { readPrintPayload } from './printUtils'

const isPrintableFile = (value = '') => {
  const url = String(value || '').trim()
  if (!url) return false
  if (url.startsWith('/mock-documents/')) return false
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('data:application/pdf')) return true
  if (/^https?:\/\//i.test(url)) return true
  return false
}

const isPdfFile = (value = '') => {
  const url = String(value || '').trim().toLowerCase()
  return url.startsWith('data:application/pdf') || /\.pdf(?:$|[?#])/.test(url)
}

const pageClass = 'print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]'

const DocumentsPrintPage = () => {
  const { documents = [] } = readPrintPayload()
  const [pdfStatuses, setPdfStatuses] = useState({})

  const fileList = documents.flatMap((document) => {
    const images = Array.isArray(document.images) ? document.images : []
    const sources = images.length ? images : [document.fileUrl]

    return sources
      .filter(isPrintableFile)
      .map((fileUrl) => ({
        fileUrl,
        name: document.name || document.document_name || 'Document',
      }))
  })

  const pdfItems = fileList
    .map((item, index) => ({ ...item, key: `${item.fileUrl}-${index}` }))
    .filter((item) => isPdfFile(item.fileUrl))

  const handlePdfStatusChange = useCallback((key, status) => {
    setPdfStatuses((current) => (
      current[key] === status ? current : { ...current, [key]: status }
    ))
  }, [])

  const isPreparingPdfPages = pdfItems.some((item) => (
    !pdfStatuses[item.key] || pdfStatuses[item.key] === 'loading'
  ))

  return (
    <PrintPageShell
      title="Print Documents"
      printDisabled={isPreparingPdfPages}
      printDisabledMessage="Wait for all PDF pages to finish loading before printing."
    >
      <div className="mx-auto flex w-[210mm] flex-col bg-white print:w-[210mm]">
        {fileList.length ? (
          fileList.map((item, index) => {
            const key = `${item.fileUrl}-${index}`

            return isPdfFile(item.fileUrl) ? (
              <PdfPrintPages
                key={key}
                fileUrl={item.fileUrl}
                name={item.name}
                onStatusChange={(status) => handlePdfStatusChange(key, status)}
              />
            ) : (
              <section key={key} className={pageClass}>
                <img
                  src={item.fileUrl}
                  alt={`${item.name} preview ${index + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              </section>
            )
          })
        ) : (
          <section className={pageClass}>
            <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-300 p-8 text-center print:border-black">
              <div>
                <h2 className="text-xl font-black text-slate-900">No uploaded documents</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Upload buyer document images or PDF files before printing.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </PrintPageShell>
  )
}

export default DocumentsPrintPage

