import PrintPageShell from './PrintPageShell'
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

const DocumentsPrintPage = () => {
  const { documents = [] } = readPrintPayload()

  const fileList = documents.flatMap((document) => {
    const images = Array.isArray(document.images) ? document.images : []
    const sources = images.length ? images : [document.fileUrl]

    return sources
      .filter(isPrintableFile)
      .map((fileUrl) => ({ fileUrl, name: document.name || document.document_name || 'Document' }))
  })

  return (
    <PrintPageShell title="Print Documents">
      <div className="mx-auto flex w-[210mm] flex-col bg-white print:w-[210mm]">
        {fileList.length ? (
          fileList.map((item, index) => {
            const isPdf = String(item.fileUrl).startsWith('data:application/pdf') || String(item.fileUrl).toLowerCase().includes('.pdf')

            return (
              <section
                key={`${item.fileUrl}-${index}`}
                className="print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]"
              >
                {isPdf ? (
                  <div className="flex h-full w-full flex-col items-center justify-center border border-dashed border-slate-300 p-8 text-center text-slate-700 print:border-black">
                    <h2 className="text-lg font-black">{item.name}</h2>
                    <p className="mt-2 text-sm font-semibold">PDF file saved. Open the uploaded PDF file directly for exact PDF printing.</p>
                  </div>
                ) : (
                  <img
                    src={item.fileUrl}
                    alt={`${item.name} preview ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </section>
            )
          })
        ) : (
          <section className="print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]">
            <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-300 p-8 text-center print:border-black">
              <div>
                <h2 className="text-xl font-black text-slate-900">No uploaded document images</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Upload buyer document images first before printing document images.
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
