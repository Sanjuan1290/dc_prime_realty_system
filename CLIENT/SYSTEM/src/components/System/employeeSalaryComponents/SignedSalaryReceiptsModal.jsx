import { useEffect, useRef, useState } from 'react'
import { FiAlertCircle, FiArchive, FiCheckCircle, FiDownload, FiEye, FiFileText, FiPrinter, FiRefreshCw, FiShield, FiUploadCloud, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { appendCloudinarySecurityFields } from '../../../utils/cloudinaryUploadSecurity'
import { requestApiBlob } from '../../../utils/apiClient'
import { revokeProtectedObjectUrl } from '../../../utils/protectedFile'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import FundReleaseReceiptModal from './FundReleaseReceiptModal'

const accept = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 15 * 1024 * 1024
const safeFileName = (value) => String(value || 'signed-salary-receipt').replace(/[\\/\x00-\x1f<>:"|?*]/g, '_')
const scanLabel = (status) => status === 'approved' ? 'Ready' : status === 'pending' ? 'Security check in progress' : status === 'rejected' ? 'Rejected' : 'Unavailable'

// Protected copies are fetched with the authenticated API; no public Cloudinary URLs.
const receiptFileUrl = async (item) => {
  const response = await requestApiBlob(item.contentPath, { redirectOnUnavailable: false })
  if (!response?.blob) throw new Error('The file could not be opened.')
  return URL.createObjectURL(response.blob)
}

const SignedSalaryReceiptsModal = ({ payrollId, employeeName = '', canUpload = false, canPrint = false, canExport = false, onClose }) => {
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [showOfficialReceipt, setShowOfficialReceipt] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedFilePreview, setSelectedFilePreview] = useState('')
  const previewUrlRef = useRef(null)
  const fileRef = useRef(null)
  const basePath = `/employee-payroll/payrolls/${payrollId}/signed-receipts`
  // A local preview never uploads a file; revoke the URL when the file changes.
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setSelectedFilePreview(''); return undefined }
    const url = URL.createObjectURL(file)
    setSelectedFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => { if (previewUrlRef.current) revokeProtectedObjectUrl(previewUrlRef.current) }, [])

  const clearPreview = () => {
    if (previewUrlRef.current) revokeProtectedObjectUrl(previewUrlRef.current)
    previewUrlRef.current = null
    setPreview(null)
  }
  const showPreview = async (item) => {
    if (item.scanStatus !== 'approved') {
      setNotice({ type: 'warning', message: 'This file will be available after the security check is approved.' }); return
    }
    if (preview?.id === item.id) { clearPreview(); return }
    setPreviewLoading(true)
    try {
      const url = await receiptFileUrl(item)
      if (previewUrlRef.current) revokeProtectedObjectUrl(previewUrlRef.current)
      previewUrlRef.current = url
      setPreview({ id: item.id, name: item.name, type: item.type, url })
      setNotice(null)
    } catch (error) { setNotice({ type: 'error', message: error?.message || 'Could not display the uploaded receipt.' }) }
    finally { setPreviewLoading(false) }
  }

  const load = async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const result = await useFetch(basePath)
      setFiles(result?.data?.files || [])
      setNotice(null)
    } catch (error) {
      setFiles([])
      setLoadFailed(true)
      setNotice({ type: 'error', message: error?.message || 'Could not load receipts. Try again.' })
    } finally { setLoading(false) }
  }
  useEffect(() => { if (payrollId) load() }, [payrollId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (!file || busy || loadFailed) return
    if (!accept.includes(file.type) || file.size <= 0 || file.size > MAX_BYTES) {
      setNotice({ type: 'error', message: 'Choose a PDF, JPG or PNG file (maximum 15 MB).' }); return
    }
    setBusy(true)
    setNotice({ type: 'loading', message: 'Uploading receipt and checking file security…' })
    try {
      const signatureResponse = await useFetchPost(`${basePath}/upload-signature`, { fileName: file.name, fileType: file.type, fileSize: file.size }, { confirmationHandled: 'compact' })
      const signed = signatureResponse?.data || {}
      // The backend signs `asset_folder` using the value returned as `folder`.
      // Appending undefined turns it into the literal string "undefined" and
      // causes Cloudinary to reject the entire request as an invalid signature.
      if (!signed.folder || !signed.signature || !signed.publicId || !signed.uploadUrl) {
        throw new Error('Upload setup is incomplete. Please refresh and try again.')
      }
      const form = new FormData()
      form.append('file', file)
      form.append('api_key', signed.apiKey)
      form.append('timestamp', signed.timestamp)
      form.append('signature', signed.signature)
      form.append('public_id', signed.publicId)
      form.append('asset_folder', signed.folder)
      form.append('type', signed.type)
      form.append('tags', signed.tags)
      form.append('context', signed.context)
      appendCloudinarySecurityFields(form, signed)
      const cloud = await fetch(signed.uploadUrl, { method: 'POST', body: form })
      const result = await cloud.json().catch(() => ({}))
      if (!cloud.ok) {
        const cloudMessage = String(result?.error?.message || '')
        // Cloudinary errors can contain signed URLs and storage metadata.
        // Show a clear message, never the raw signature string in the UI.
        if (/invalid signature/i.test(cloudMessage)) throw new Error('Receipt upload verification failed. Refresh the page and try again. If this continues, contact your administrator.')
        if (/quota|perception.point/i.test(cloudMessage)) throw new Error('Receipt security scanning is unavailable. Contact your administrator.')
        throw new Error('Cloudinary could not upload the receipt. Check the file and try again.')
      }
      await useFetchPost(basePath, { file: {
        fileName: file.name, fileType: file.type, fileSize: Number(result?.bytes || file.size),
        cloudinaryPublicId: result?.public_id, cloudinaryResourceType: result?.resource_type || 'image',
      } }, { confirmationHandled: 'compact' })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
      setNotice({ type: 'success', message: 'Receipt uploaded. When its security check passes, select View to display the file below.' })
    } catch (error) { setNotice({ type: 'error', message: error?.message || 'Unable to upload receipt.' }) }
    finally { setBusy(false) }
  }

  const actOnFile = async (item, action) => {
    if (action === 'view') return showPreview(item)
    if (item.scanStatus !== 'approved') {
      setNotice({ type: 'warning', message: 'Wait for the receipt security check to finish.' }); return
    }
    // Open a blank window during the click for browsers that block delayed pop-ups.
    const popup = action !== 'download' ? window.open('', '_blank') : null
    if (action !== 'download' && !popup) {
      setNotice({ type: 'warning', message: 'Allow pop-ups to view or print receipts.' }); return
    }
    try {
      if (popup) { popup.document.title = 'Opening salary receipt…'; popup.document.body.textContent = 'Loading protected receipt…' }
      const url = await receiptFileUrl(item)
      if (action === 'download') {
        const link = document.createElement('a')
        link.href = url
        link.download = safeFileName(item.name)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => revokeProtectedObjectUrl(url), 60000)
      } else if (action === 'view' || item.type === 'application/pdf') {
        popup.location.replace(url)
        window.setTimeout(() => revokeProtectedObjectUrl(url), 120000)
        if (action === 'print' && item.type === 'application/pdf') setNotice({ type: 'info', message: 'The PDF opened in a new tab. Choose Print in your PDF viewer.' })
      } else {
        // Image printing uses its own document so page chrome is not printed.
        popup.document.open()
        popup.document.write(`<!doctype html><html><head><title>Print signed salary receipt</title><style>html,body{margin:0;background:white}img{display:block;margin:auto;max-width:100%;max-height:100vh;object-fit:contain}@page{size:auto;margin:10mm}</style></head><body><img id="receipt" alt="Signed salary receipt"></body></html>`)
        popup.document.close()
        const image = popup.document.getElementById('receipt')
        image.onload = () => { popup.focus(); popup.print() }
        image.src = url
        window.setTimeout(() => revokeProtectedObjectUrl(url), 120000)
      }
    } catch (error) {
      if (popup && !popup.closed) popup.close()
      setNotice({ type: 'error', message: error?.message || 'Unable to open the protected receipt.' })
    }
  }

  const archive = async (item) => {
    if (busy || !window.confirm(`Archive ${item.name}? The audit history and stored file will be retained.`)) return
    setBusy(true)
    try {
      await useFetchPost(`${basePath}/${item.id}/archive`, {}, { confirmationHandled: 'compact' })
      if (preview?.id === item.id) clearPreview()
      await load()
      setNotice({ type: 'success', message: 'Receipt archived. You can upload a replacement.' })
    } catch (error) { setNotice({ type: 'error', message: error?.message || 'Unable to archive receipt.' }) }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label="Employee salary receipts" className="flex max-h-[94vh] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-950">Receipts</h2><p className="mt-1 text-sm text-slate-500">{employeeName} · Salary payment documents</p></div><button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-slate-100"><FiX /></button></header>
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 sm:p-5">
        {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><FiFileText className="text-blue-700" />Official Acknowledgment</h3><p className="mt-1 text-xs text-slate-600">Created from the finalized salary record.</p></div><button type="button" onClick={() => setShowOfficialReceipt(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"><FiEye />Open Receipt{canPrint || canExport ? ' · Print / PDF' : ''}</button></div>
        </section>
        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black text-slate-900">Uploaded Signed Copies</h3><p className="mt-1 text-xs text-slate-500">Keep up to five signed copies for this salary.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{loadFailed ? 'Unavailable' : loading ? 'Loading…' : `${files.length} / 5`}</span><button type="button" onClick={load} disabled={busy || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><FiRefreshCw />Retry / Refresh</button></div></div>
          {loading ? <p className="text-sm text-slate-500">Loading receipts…</p> : null}
          {loadFailed ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><FiAlertCircle className="mr-2 inline" />Couldn't load uploaded receipts. Retry or ask your administrator to check the receipt service.</div> : null}
          {!loading && !loadFailed && files.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No signed copies uploaded yet.</p> : null}
          {!loadFailed && <div className="space-y-2">{files.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"><FiFileText className="hidden shrink-0 text-blue-700 sm:block" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.name}</p><p className={`mt-1 flex items-center gap-1 text-xs ${item.scanStatus === 'approved' ? 'text-emerald-700' : 'text-slate-500'}`}>{item.scanStatus === 'approved' ? <FiCheckCircle /> : <FiShield />}{scanLabel(item.scanStatus)}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => actOnFile(item, 'view')} disabled={item.scanStatus !== 'approved'} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FiEye />View</button>{canPrint && <button type="button" onClick={() => actOnFile(item, 'print')} disabled={item.scanStatus !== 'approved'} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FiPrinter />Print</button>}{canExport && <button type="button" onClick={() => actOnFile(item, 'download')} disabled={item.scanStatus !== 'approved'} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FiDownload />Download</button>}{canUpload && <button type="button" onClick={() => archive(item)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40"><FiArchive />Archive</button>}</div></div>)}</div>}
          {previewLoading ? <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">Opening protected receipt preview…</p> : null}
          {preview ? <div className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-slate-50 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><h4 className="text-sm font-bold text-slate-900">Uploaded Receipt Preview</h4><p className="break-all text-xs text-slate-500">{preview.name}</p></div><button type="button" onClick={clearPreview} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100">Close Preview</button></div>
            {preview.type === 'application/pdf' ? <iframe title={`Preview of ${preview.name}`} src={preview.url} className="h-[420px] w-full max-w-full rounded-lg border border-slate-200 bg-white" /> : <img src={preview.url} alt={`Uploaded signed salary receipt: ${preview.name}`} className="mx-auto max-h-[420px] max-w-full rounded-lg object-contain" />}
          </div> : null}
          {canUpload && !loadFailed && !loading && files.length < 5 ? <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4"><h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><FiUploadCloud />Upload a Signed Copy</h4><p className="mt-1 text-xs text-slate-600">PDF, JPG or PNG · Up to 15 MB each. A security check runs after upload.</p><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-3 block w-full max-w-full text-sm" disabled={busy} />{selectedFilePreview ? <div className="mt-3"><p className="mb-2 text-xs font-semibold text-slate-600">Selected image preview (not yet uploaded)</p><img src={selectedFilePreview} alt="Selected signed receipt before upload" className="max-h-48 max-w-full rounded-lg border border-blue-200 bg-white object-contain" /></div> : file?.type === 'application/pdf' ? <p className="mt-2 break-all text-xs text-slate-600">Selected PDF: {file.name}</p> : null}<button type="button" disabled={!file || busy} onClick={upload} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"><FiUploadCloud />{busy ? 'Uploading…' : 'Upload Receipt'}</button></div> : null}
          {!loadFailed && files.length === 5 ? <p className="text-xs text-slate-500">All five upload slots are used. Archive an incorrect copy to upload a replacement.</p> : null}
        </section>
      </div>
      <footer className="border-t border-slate-200 p-4 text-right"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button></footer>
    </section>
    {showOfficialReceipt ? <FundReleaseReceiptModal payrollId={payrollId} canPrint={canPrint} canExport={canExport} onClose={() => setShowOfficialReceipt(false)} /> : null}
  </div>
}
export default SignedSalaryReceiptsModal


