import { useEffect, useRef, useState } from 'react'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'


const pageClass = 'print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]'

const canvasToObjectUrl = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Failed to prepare a PDF page for printing.'))
      return
    }

    resolve(URL.createObjectURL(blob))
  }, 'image/png')
})

const renderPageToImage = async (pdf, pageNumber) => {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: false })

  if (!context) throw new Error('Your browser could not render the PDF page.')

  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({
    canvasContext: context,
    viewport,
    background: '#ffffff',
  }).promise

  const imageUrl = await canvasToObjectUrl(canvas)
  page.cleanup()
  canvas.width = 1
  canvas.height = 1

  return imageUrl
}

const PdfPrintPages = ({ fileUrl, name = 'PDF document', onStatusChange }) => {
  const onStatusChangeRef = useRef(onStatusChange)
  const [state, setState] = useState({ status: 'loading', pages: [], message: '' })

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    let cancelled = false
    let loadingTask
    let generatedUrls = []

    const loadPdf = async () => {
      setState({ status: 'loading', pages: [], message: '' })
      onStatusChangeRef.current?.('loading')

      try {
        const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = pdfWorker

        loadingTask = getDocument({
          url: fileUrl,
          withCredentials: false,
        })

        const pdf = await loadingTask.promise
        const pageUrls = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) break
          const pageUrl = await renderPageToImage(pdf, pageNumber)
          pageUrls.push(pageUrl)
          generatedUrls.push(pageUrl)
        }

        if (!cancelled) {
          setState({ status: 'ready', pages: pageUrls, message: '' })
          onStatusChangeRef.current?.('ready')
        }

        await pdf.cleanup()
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            pages: [],
            message: error?.message || 'Failed to load this PDF for printing.',
          })
          onStatusChangeRef.current?.('error')
        }
      }
    }

    loadPdf()

    return () => {
      cancelled = true
      loadingTask?.destroy?.()
      generatedUrls.forEach((url) => URL.revokeObjectURL(url))
      generatedUrls = []
    }
  }, [fileUrl])

  if (state.status === 'loading') {
    return (
      <section className={pageClass}>
        <div className="print-hidden flex h-full w-full flex-col items-center justify-center border border-dashed border-slate-300 p-8 text-center text-slate-700">
          <h2 className="text-lg font-black">{name}</h2>
          <p className="mt-2 text-sm font-semibold">Loading PDF pages for the combined printout...</p>
        </div>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className={pageClass}>
        <div className="flex h-full w-full flex-col items-center justify-center border border-dashed border-red-300 p-8 text-center text-red-700 print:border-black print:text-black">
          <h2 className="text-lg font-black">{name}</h2>
          <p className="mt-2 text-sm font-semibold">{state.message}</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="print-hidden mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white"
          >
            Open original PDF
          </a>
        </div>
      </section>
    )
  }

  return state.pages.map((pageUrl, index) => (
    <section key={`${fileUrl}-page-${index + 1}`} className={pageClass}>
      <img
        src={pageUrl}
        alt={`${name} page ${index + 1}`}
        className="max-h-full max-w-full object-contain"
      />
    </section>
  ))
}

export default PdfPrintPages


