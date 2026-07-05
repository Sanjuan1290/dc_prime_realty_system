import PrintPageShell from './PrintPageShell'
import { readPrintPayload } from './printUtils'

const DocumentsPrintPage = () => {
  const { documents = [] } = readPrintPayload()

  const imageList =
    documents.length > 0
      ? documents.flatMap((document) =>
          document.images && document.images.length
            ? document.images
            : ['/docImage1.png']
        )
      : ['/docImage1.png', '/docImage1.png', '/docImage1.png']

  return (
    <PrintPageShell title="Print Documents">
      <div className="mx-auto w-[850px] bg-white p-6 shadow-lg print:w-full print:p-0 print:shadow-none">
        <div className="flex flex-col gap-6 print:gap-0">
          {imageList.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className="flex min-h-[980px] items-center justify-center border border-slate-300 bg-white p-4 print:min-h-screen print:border-0 print:p-0"
            >
              <img
                src={image}
                alt={`Document ${index + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </PrintPageShell>
  )
}

export default DocumentsPrintPage