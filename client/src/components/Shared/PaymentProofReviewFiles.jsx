import { useEffect, useState } from 'react'
import { FiAlertTriangle, FiCheckCircle, FiClock, FiExternalLink, FiFileText, FiImage, FiLoader, FiX } from 'react-icons/fi'
import { fetchProtectedObjectUrl, openProtectedObjectUrl, revokeProtectedObjectUrl } from '../../utils/protectedFile'

const scanInformation = (file) => {
  const status = String(file.malwareScanStatus || '').toLowerCase()
  if (status === 'approved') return { label: 'Security scan passed', tone: 'text-emerald-700', icon: FiCheckCircle }
  if (status === 'rejected') return { label: 'Security scan blocked this file', tone: 'text-red-700', icon: FiAlertTriangle }
  if (status === 'error') return { label: 'Security scan failed — contact the administrator', tone: 'text-red-700', icon: FiAlertTriangle }
  if (status === 'not_scanned') return { label: 'Not security scanned — preview unavailable', tone: 'text-amber-700', icon: FiAlertTriangle }
  if (status === 'pending') {
    const uploadedAt = Date.parse(file.uploadedAt || '')
    const delayed = Number.isFinite(uploadedAt) && Date.now() - uploadedAt > 5 * 60 * 1000
    return { label: delayed ? 'Still waiting for the Cloudinary scan result' : 'Awaiting security scan result', tone: 'text-amber-700', icon: FiClock }
  }
  return { label: 'Scan status unavailable — preview blocked', tone: 'text-amber-700', icon: FiAlertTriangle }
}

const ProtectedProofCard = ({ reviewId, file }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [imageOpen, setImageOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const info = scanInformation(file)
  const Icon = info.icon
  const isImage = /^image\/(jpeg|png)$/i.test(file.fileType || '') || /\.(png|jpe?g)$/i.test(file.fileName || '')
  const isPdf = file.fileType === 'application/pdf' || /\.pdf$/i.test(file.fileName || '')
  const contentPath = `/workflow/reviews/${encodeURIComponent(reviewId)}/proofs/${encodeURIComponent(file.proofId)}/content`

  useEffect(() => {
    if (!file.previewAvailable || !isImage) { setThumbnailUrl(''); return }
    let canceled = false
    let objectUrl = ''
    setLoading(true)
    fetchProtectedObjectUrl(contentPath)
      .then((url) => {
        if (canceled) revokeProtectedObjectUrl(url)
        else { objectUrl = url; setThumbnailUrl(url) }
      })
      .catch(() => { if (!canceled) setError('Preview could not load. Try reopening this review.') })
      .finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true; if (objectUrl) revokeProtectedObjectUrl(objectUrl) }
  }, [reviewId, file.proofId, file.previewAvailable, isImage])

  const openPdf = async () => {
    setError('')
    setLoading(true)
    try {
      const url = await fetchProtectedObjectUrl(contentPath)
      if (!openProtectedObjectUrl(url)) setError('Allow pop-ups to view the protected PDF.')
    } catch (e) { setError(e?.message || 'Unable to open the protected PDF.') }
    finally { setLoading(false) }
  }

  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap gap-4 p-4">
      <div className="flex h-28 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {thumbnailUrl && file.previewAvailable
          ? <button type="button" onClick={() => setImageOpen(true)} title="Enlarge payment proof" className="h-full w-full"><img src={thumbnailUrl} alt={`Preview of ${file.fileName}`} className="h-full w-full object-contain" /></button>
          : loading && file.previewAvailable ? <FiLoader className="animate-spin text-blue-700" />
          : isPdf ? <FiFileText className="h-8 w-8 text-slate-400" /> : <FiImage className="h-8 w-8 text-slate-400" />}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-all text-sm font-black text-slate-900">{file.fileName}</p>
        <div role="status" className={`flex items-center gap-2 text-xs font-black ${info.tone}`}><Icon className="shrink-0" />{info.label}</div>
        {file.malwareScanStatus === 'pending' ? <p className="text-xs font-semibold text-slate-500">Checking automatically every 5 seconds. This label reflects the server's current scan status, not a completed scan.</p> : null}
        {file.previewAvailable && isImage && thumbnailUrl ? <button type="button" onClick={() => setImageOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700"><FiImage /> Enlarge Image</button> : null}
        {file.previewAvailable && isPdf ? <button type="button" onClick={openPdf} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700 disabled:opacity-50"><FiExternalLink /> View Protected PDF</button> : null}
        {!file.previewAvailable ? <p className="text-xs text-slate-500">Preview becomes available only after the server confirms a passed scan and the file remains active.</p> : null}
        {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
    {imageOpen && thumbnailUrl ? <div role="dialog" aria-modal="true" aria-label="Payment proof image preview" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 p-4"><button type="button" onClick={() => setImageOpen(false)} className="absolute right-5 top-5 rounded-xl bg-white p-2 text-slate-900" aria-label="Close proof preview"><FiX /></button><img src={thumbnailUrl} alt={file.fileName} className="max-h-[85vh] max-w-[90vw] object-contain" /></div> : null}
  </div>
}

const PaymentProofReviewFiles = ({ reviewId, files = [] }) => <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
  <h3 className="text-base font-black text-slate-900">Payment Proof Files</h3>
  <p className="mt-1 text-xs font-semibold text-slate-600">Live security status and protected previews. The before/after section above is a fixed record of the upload, not a live scan report.</p>
  {!files.length ? <p className="mt-4 text-sm font-semibold text-slate-500">No payment proof files are associated with this review.</p> : <div className="mt-4 grid gap-3">{files.map((file) => <ProtectedProofCard key={file.proofId} reviewId={reviewId} file={file} />)}</div>}
</section>

export default PaymentProofReviewFiles
