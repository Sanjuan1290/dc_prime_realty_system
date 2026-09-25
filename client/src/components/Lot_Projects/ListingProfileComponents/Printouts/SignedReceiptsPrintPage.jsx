import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StatusAlert from '../../../Shared/StatusAlert'
import { fetchProtectedObjectUrl, revokeProtectedObjectUrl } from '../../../../utils/protectedFile'
import PdfPrintPages from './PdfPrintPages'
import PrintPageShell from './PrintPageShell'
import { readSignedReceiptPrintPayload } from './signedReceiptPrint'

const pageClass = 'print-page flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[10mm] shadow-lg print:p-[8mm]'

const isPdfFile = (file = {}) => {
  const fileType = String(file.fileType || '').toLowerCase()
  const fileName = String(file.fileName || file.name || '').toLowerCase()
  return fileType.includes('pdf') || fileName.endsWith('.pdf')
}

const isPrintableUrl = (value = '') => {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:image/') || url.startsWith('data:application/pdf')
}

const SignedReceiptsPrintPage = () => {
  const [payload] = useState(() => readSignedReceiptPrintPayload())
  const sourceFiles = useMemo(
    () => (Array.isArray(payload?.files) ? payload.files : []).filter((file) => String(file?.accessPath || '').trim()),
    [payload]
  )
  const [resolvedFiles, setResolvedFiles] = useState([])
  const [loadState, setLoadState] = useState({ loading: true, failed: 0, warningCount: 0, message: '' })
  const [pdfStatuses, setPdfStatuses] = useState({})
  const [imageStatuses, setImageStatuses] = useState({})
  const objectUrlsRef = useRef(new Set())

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => revokeProtectedObjectUrl(url))
    objectUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    let cancelled = false

    const resolveFiles = async () => {
      if (!sourceFiles.length) {
        setResolvedFiles([])
        setLoadState({ loading: false, failed: 0, warningCount: 0, message: '' })
        return
      }

      setLoadState({ loading: true, failed: 0, warningCount: 0, message: 'Preparing protected signed receipts...' })

      const results = await Promise.allSettled(
        sourceFiles.map(async (file, index) => {
          const scanStatus = String(file.malwareScanStatus || '').toLowerCase()
          const allowUnscanned = file.allowUnscanned === true && scanStatus === 'not_scanned'

          if (scanStatus !== 'approved' && !allowUnscanned) {
            throw new Error(`${file.fileName || file.name || `Signed receipt ${index + 1}`} is not security-approved for printing.`)
          }
          const fileUrl = await fetchProtectedObjectUrl(file.contentPath || file.accessPath)
          objectUrlsRef.current.add(fileUrl)
          if (!isPrintableUrl(fileUrl)) {
            throw new Error(`Protected content was not returned for ${file.fileName || file.name || `signed receipt ${index + 1}`}.`)
          }

          return {
            ...file,
            key: file.key || `signed-receipt-${index + 1}`,
            fileUrl,
            isPdf: isPdfFile(file),
            securityWarning: allowUnscanned ? 'This signed receipt was uploaded without malware scanning.' : null,
          }
        })
      )

      if (cancelled) return

      const nextFiles = []
      const errors = []
      let warningCount = 0
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          nextFiles.push(result.value)
          if (result.value.securityWarning) warningCount += 1
        } else {
          errors.push(result.reason?.message || 'A signed receipt could not be prepared.')
        }
      })

      setResolvedFiles(nextFiles)
      setPdfStatuses({})
      setImageStatuses({})
      setLoadState({
        loading: false,
        failed: errors.length,
        warningCount,
        message: errors[0] || '',
      })
    }

    resolveFiles()

    return () => {
      cancelled = true
    }
  }, [sourceFiles])

  const pdfItems = useMemo(() => resolvedFiles.filter((item) => item.isPdf), [resolvedFiles])
  const imageItems = useMemo(() => resolvedFiles.filter((item) => !item.isPdf), [resolvedFiles])

  const handlePdfStatusChange = useCallback((key, status) => {
    setPdfStatuses((current) => (
      current[key] === status ? current : { ...current, [key]: status }
    ))
  }, [])

  const handleImageStatusChange = useCallback((key, status) => {
    setImageStatuses((current) => (
      current[key] === status ? current : { ...current, [key]: status }
    ))
  }, [])

  const isPreparingPdfPages = pdfItems.some((item) => (
    !pdfStatuses[item.key] || pdfStatuses[item.key] === 'loading'
  ))
  const isPreparingImages = imageItems.some((item) => (
    !imageStatuses[item.key] || imageStatuses[item.key] === 'loading'
  ))
  const isPreparing = loadState.loading || isPreparingPdfPages || isPreparingImages

  return (
    <PrintPageShell
      title={payload?.title || 'Signed Receipts'}
      printDisabled={isPreparing || !resolvedFiles.length}
      printDisabledMessage={
        loadState.loading
          ? 'Wait for protected signed receipt links to finish loading.'
          : isPreparingPdfPages
            ? 'Wait for all signed PDF pages to finish loading before printing.'
            : isPreparingImages
              ? 'Wait for all signed receipt images to finish loading before printing.'
              : 'No signed receipts are available for printing.'
      }
    >
      <div className="mx-auto w-[210mm] bg-white print:w-[210mm]">
        {loadState.loading ? (
          <div className="p-4 print:hidden">
            <StatusAlert type="loading" message={loadState.message || 'Preparing signed receipts...'} />
          </div>
        ) : null}

        {!loadState.loading && loadState.failed > 0 ? (
          <div className="p-4 print:hidden">
            <StatusAlert
              type="warning"
              message={`${loadState.failed} signed receipt${loadState.failed === 1 ? '' : 's'} could not be loaded. ${loadState.message}`.trim()}
            />
          </div>
        ) : null}

        {!loadState.loading && loadState.warningCount > 0 ? (
          <div className="p-4 print:hidden">
            <StatusAlert
              type="warning"
              message={`${loadState.warningCount} signed receipt${loadState.warningCount === 1 ? '' : 's'} were uploaded without malware scanning. Print only if you trust the source.`}
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
              ) : imageStatuses[item.key] === 'error' ? (
                <section key={item.key} className={pageClass}>
                  <div className="flex h-full w-full flex-col items-center justify-center border border-dashed border-red-300 p-8 text-center text-red-700 print:border-black print:text-black">
                    <h2 className="text-lg font-black">{item.name}</h2>
                    <p className="mt-2 text-sm font-semibold">This signed receipt image could not be loaded.</p>
                  </div>
                </section>
              ) : (
                <section key={item.key} className={pageClass}>
                  <img
                    src={item.fileUrl}
                    alt={`${item.name} ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                    onLoad={() => handleImageStatusChange(item.key, 'ready')}
                    onError={() => handleImageStatusChange(item.key, 'error')}
                  />
                </section>
              )
            ))}
          </div>
        ) : !loadState.loading ? (
          <section className={pageClass}>
            <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-300 p-8 text-center print:border-black">
              <div>
                <h2 className="text-xl font-black text-slate-900">No signed receipts available</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Upload and security-approve signed receipt copies before using Print All Signed.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </PrintPageShell>
  )
}

export default SignedReceiptsPrintPage

