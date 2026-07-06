import PrintPageShell from './PrintPageShell'
import { readPrintPayload } from './printUtils'

const DocumentsPrintPage = () => {
  const { documents = [] } = readPrintPayload()

  const imageList = documents.flatMap((document) =>
    document.images && document.images.length
      ? document.images.map((image) => ({ image, name: document.name || 'Document' }))
      : document.fileUrl
        ? [{ image: document.fileUrl, name: document.name || 'Document' }]
        : []
  )

  return (
    <PrintPageShell title="Print Documents">
      <div className="mx-auto w-[850px] bg-white p-6 shadow-lg print:w-full print:p-0 print:shadow-none">
        {imageList.length ? (
          <div className="flex flex-col gap-6 print:gap-0">
            {imageList.map((item, index) => (
              <div
                key={`${item.image}-${index}`}
                className="flex min-h-[980px] flex-col items-center justify-center border border-slate-300 bg-white p-4 print:min-h-screen print:border-0 print:p-0"
              >
                {String(item.image).startsWith('data:application/pdf') || String(item.image).toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={item.image}
                    title={`${item.name} preview ${index + 1}`}
                    className="h-full min-h-[920px] w-full"
                  />
                ) : (
                  <img
                    src={item.image}
                    alt={`${item.name} preview ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[700px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-8 text-center print:border-black print:bg-white">
            <div>
              <h2 className="text-xl font-black text-slate-900">No uploaded document images</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Upload buyer documents first before printing document images.
              </p>
            </div>
          </div>
        )}
      </div>
    </PrintPageShell>
  )
}

export default DocumentsPrintPage
