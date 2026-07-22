import { useCallback, useEffect, useMemo, useState } from 'react'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'
import { getDocumentFiles, isPdfLike } from '../Documents/documentFileUtils'
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

const pageClass = 'print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]'

const DocumentsPrintPage = () => {
  const [payload] = useState(() => readPrintPayload())
  const documents = Array.isArray(payload?.documents) ? payload.documents : []
  const projectSlug = String(payload?.projectSlug || '').trim()
  const [resolvedFiles, setResolvedFiles] = useState([])
  const [loadState, setLoadState] = useState({ loading: true, failed: 0, message: '' })
  const [pdfStatuses, setPdfStatuses] = useState({})

  const sourceFiles = useMemo(
    () => documents.flatMap((document) =>
      getDocumentFiles({ ...document, projectSlug }).map((file, index) => ({
        ...file,
        key: `${document.id || document.document_id || 'document'}-${file.fileId || file.cloudinaryPublicId || index}`,
        name: document.name || document.document_name || 'Document',
        isPdf: isPdfLike(file),
      }))
    ),
    [documents, projectSlug]
  )

  useEffect(() => {
    let cancelled = false

    const resolveFiles = async () => {
      if (!sourceFiles.length) {
        setResolvedFiles([])
        setLoadState({ loading: false, failed: 0, message: '' })
        return
      }

      setLoadState({ loading: true, failed: 0, message: 'Preparing protected document files...' })

      const results = await Promise.allSettled(
        sourceFiles.map(async (file) => {
          if (file.url && !file.protected) return { ...file, fileUrl: file.url }
          if (!file.accessPath) throw new Error(`${file.fileName || file.name} does not have a secure access route.`)

          const result = await useFetch(file.accessPath)
          const fileUrl = result?.data?.url || result?.url || ''
          if (!fileUrl) throw new Error(`No secure link was returned for ${file.fileName || file.name}.`)
          return { ...file, fileUrl }
        })
      )

      if (cancelled) return

      const nextFiles = []
      const errors = []
      results.forEach((result) => {
        if (result.status === 'fulfilled' && isPrintableFile(result.value.fileUrl)) {
          nextFiles.push(result.value)
        } else if (result.status === 'rejected') {
          errors.push(result.reason?.message || 'A protected document could not be opened.')
        }
      })

      setResolvedFiles(nextFiles)
      setLoadState({
        loading: false,
        failed: errors.length,
        message: errors[0] || '',
      })
    }

    resolveFiles()

    return () => {
      cancelled = true
    }
  }, [sourceFiles])

  const pdfItems = resolvedFiles.filter((item) => item.isPdf)

  const handlePdfStatusChange = useCallback((key, status) => {
    setPdfStatuses((current) => (
      current[key] === status ? current : { ...current, [key]: status }
    ))
  }, [])

  const isPreparingPdfPages = pdfItems.some((item) => (
    !pdfStatuses[item.key] || pdfStatuses[item.key] === 'loading'
  ))
  const isPreparing = loadState.loading || isPreparingPdfPages

  return (
    <PrintPageShell
      title="Print Documents"
      printDisabled={isPreparing || !resolvedFiles.length}
      printDisabledMessage={
        loadState.loading
          ? 'Wait for protected document links to finish loading.'
          : isPreparingPdfPages
            ? 'Wait for all PDF pages to finish loading before printing.'
            : 'No uploaded documents are available for printing.'
      }
    >
      <div className="mx-auto w-[210mm] bg-white print:w-[210mm]">
        {loadState.loading ? (
          <div className="p-4 print:hidden">
            <StatusAlert type="loading" message={loadState.message || 'Preparing document files...'} />
          </div>
        ) : null}

        {!loadState.loading && loadState.failed > 0 ? (
          <div className="p-4 print:hidden">
            <StatusAlert
              type="warning"
              message={`${loadState.failed} document file(s) could not be loaded. ${loadState.message}`.trim()}
            />
          </div>
        ) : null}

        {resolvedFiles.length ? (
          <div className="flex flex-col">
            {resolvedFiles.map((item, index) => (
              item.isPdf ? (
                <PdfPrintPages
                  key={item.key}
                  fileUrl={item.fileUrl}
                  name={item.name}
                  onStatusChange={(status) => handlePdfStatusChange(item.key, status)}
                />
              ) : (
                <section key={item.key} className={pageClass}>
                  <img
                    src={item.fileUrl}
                    alt={`${item.name} preview ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </section>
              )
            ))}
          </div>
        ) : !loadState.loading ? (
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
        ) : null}
      </div>
    </PrintPageShell>
  )
}

export default DocumentsPrintPage
