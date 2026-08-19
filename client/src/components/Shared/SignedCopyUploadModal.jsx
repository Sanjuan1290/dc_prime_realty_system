import { useEffect, useRef, useState } from 'react'
import {
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'
import StatusAlert from './StatusAlert'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import { requestDoubleCheck } from '../../utils/doubleCheck'
import { fetchProtectedObjectUrl, openProtectedObjectUrl } from '../../utils/protectedFile'
import { useUploadSecurity } from './UploadSecurityCenter/UploadSecurityProvider.jsx'
import {
  appendCloudinarySecurityFields,
  canOpenMalwareScannedFile,
  createCloudinaryMalwareQuotaError,
  getMalwareScanStatus,
  isCloudinaryMalwareQuotaError,
  isMalwareQuotaFallbackError,
  malwareScanLabel,
} from '../../utils/cloudinaryUploadSecurity'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0)
  if (!value) return '-'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  }).format(date)
}

const createPreviewUrl = (file) => (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')
const revokePreviewUrl = (url) => { if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url) }

const SignedCopyUploadModal = ({
  title = 'Signed Copy',
  description = 'Upload the physically signed PDF or image for this record.',
  recordLabel = 'Signed document',
  category = 'Signed copy',
  basePath,
  readOnly = false,
  viewLabel = 'View / Print',
  allowDelete = false,
  deleteLabel = 'Delete Signed Copy',
  onClose,
  onChanged,
}) => {
  const [signedCopy, setSignedCopy] = useState(null)
  const [record, setRecord] = useState(null)
  const [file, setFile] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [scanFallback, setScanFallback] = useState(null)
  const taskIdRef = useRef('')
  const { addUpload, updateUpload, beginSecurityScan, failUpload } = useUploadSecurity()

  const invalidFile = file && (!allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES)
  const isBusy = isLoading || isUploading || isOpening || isDeleting

  const load = async ({ quiet = false } = {}) => {
    if (!basePath) return
    if (!quiet) setIsLoading(true)
    try {
      const result = await useFetch(basePath)
      const data = result?.data || {}
      setSignedCopy(data.signedCopy || null)
      setRecord(data.receipt || data.payment || null)
      if (!quiet) setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || `Failed to load ${recordLabel.toLowerCase()}.` })
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [basePath]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSignedCopy = async () => {
    if (!signedCopy || !canOpenMalwareScannedFile(signedCopy)) {
      setNotice({ type: 'warning', message: malwareScanLabel(signedCopy || {}) })
      return
    }
    if (getMalwareScanStatus(signedCopy) === 'not_scanned') {
      const confirmed = window.confirm('This signed copy was uploaded without malware scanning. Open it only if you trust the source. Continue?')
      if (!confirmed) return
    }
    setIsOpening(true)
    try {
      const objectUrl = await fetchProtectedObjectUrl(signedCopy.contentPath || `${basePath}/content`)
      if (!openProtectedObjectUrl(objectUrl)) {
        setNotice({ type: 'warning', message: 'Your browser blocked the protected file window. Allow pop-ups for this site and try again.' })
      }
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to open signed copy.' })
    } finally {
      setIsOpening(false)
    }
  }

  const deleteSignedCopy = async () => {
    if (!signedCopy || readOnly || !allowDelete || isBusy) return
    const confirmed = window.confirm(`Delete ${signedCopy.fileName || 'this signed copy'}? The uploaded file will be permanently removed. The system-generated unsigned record will remain unchanged.`)
    if (!confirmed) return

    setIsDeleting(true)
    setNotice({ type: 'loading', message: 'Deleting signed copy...' })
    try {
      const result = await useFetchPost(`${basePath}/delete`, {}, { confirmationHandled: 'compact' })
      setSignedCopy(null)
      setFile(null)
      setNotice({ type: 'success', message: result?.message || 'Signed copy deleted successfully.' })
      await load({ quiet: true })
      onChanged?.(result)
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to delete signed copy.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const uploadOne = async ({ allowUnscanned = false, fallbackToken = '' } = {}) => {
    const signatureResponse = await useFetchPost(`${basePath}/upload-signature`, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      ...(allowUnscanned ? { allowUnscanned: true, fallbackToken } : {}),
    }, { confirmationHandled: 'technical' })
    const signed = signatureResponse?.data || {}
    if (!signed.uploadUrl || !signed.signature || !signed.apiKey) throw new Error('The server did not return a valid protected upload signature.')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', signed.apiKey)
    formData.append('timestamp', String(signed.timestamp))
    formData.append('signature', signed.signature)
    formData.append('public_id', signed.publicId)
    formData.append('asset_folder', signed.folder)
    formData.append('type', signed.type || 'authenticated')
    formData.append('tags', signed.tags || 'dc_prime,signed_copy,authenticated')
    formData.append('context', signed.context || '')
    appendCloudinarySecurityFields(formData, signed)

    const response = await fetch(signed.uploadUrl, { method: 'POST', body: formData })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      if (isCloudinaryMalwareQuotaError({ response, result, scanRequested: signed.malwareScanRequested })) {
        throw createCloudinaryMalwareQuotaError({ result, fallbackToken: signed.fallbackToken || fallbackToken })
      }
      throw new Error(result?.error?.message || `Cloudinary upload failed for ${file.name}.`)
    }

    return {
      fileName: file.name,
      storedFileName: signed.storedFileName || null,
      fileSize: Number(result?.bytes || file.size),
      fileType: file.type,
      cloudinaryAssetId: result?.asset_id || null,
      cloudinaryPublicId: result?.public_id || null,
      cloudinaryResourceType: result?.resource_type || (file.type === 'application/pdf' ? 'raw' : 'image'),
      cloudinaryDeliveryType: result?.type || 'authenticated',
      cloudinaryVersion: Number(result?.version || 0) || null,
      cloudinaryAssetFolder: result?.asset_folder || signed.folder,
      cloudinaryFormat: result?.format || null,
      malwareScanStatus: signed.malwareScanStatus || (signed.malwareScanRequested ? 'pending' : 'not_scanned'),
      malwareScanProvider: signed.malwareScanProvider || null,
      malwareScanReason: signed.malwareScanReason || null,
      fallbackToken: signed.fallbackToken || fallbackToken,
    }
  }

  const runUpload = async ({ allowUnscanned = false, fallbackToken = '', confirmationToken = '' } = {}) => {
    setIsUploading(true)
    setNotice({ type: 'loading', message: allowUnscanned ? 'Uploading signed copy without malware scanning...' : 'Uploading protected signed copy and starting security scan...' })
    try {
      if (!taskIdRef.current) {
        taskIdRef.current = addUpload({
          fileName: file.name,
          category,
          detail: record?.referenceNumber || record?.referenceId || record?.unitId || recordLabel,
        })
      }
      updateUpload(taskIdRef.current, { status: 'uploading', message: 'Uploading protected signed copy...' })
      const uploadedFile = await uploadOne({ allowUnscanned, fallbackToken })
      updateUpload(taskIdRef.current, { status: 'saving', message: 'Saving signed-copy record...' })
      const saveResult = await useFetchPost(basePath, { file: uploadedFile }, { confirmationToken: confirmationToken })
      const signedCopyId = Number(saveResult?.signedCopyId || saveResult?.data?.signedCopy?.signedCopyId || 0)
      beginSecurityScan(taskIdRef.current, {
        accessPath: `${basePath}/access-url`,
        malwareScanStatus: uploadedFile.malwareScanStatus,
        message: signedCopyId ? '' : 'Upload succeeded, but the signed-copy status reference was not returned.',
      })
      taskIdRef.current = ''
      setScanFallback(null)
      setFile(null)
      setNotice({ type: 'success', message: saveResult?.message || 'Signed copy uploaded successfully.' })
      await load({ quiet: true })
      onChanged?.(saveResult)
    } catch (error) {
      if (isMalwareQuotaFallbackError(error)) {
        setScanFallback({ fallbackToken: error.fallbackToken || error?.data?.fallbackToken || fallbackToken, confirmationToken })
        setNotice({ type: 'warning', message: 'Security scanning is temporarily unavailable. You can cancel, retry later, or explicitly upload this trusted file without malware scanning.' })
        if (taskIdRef.current) updateUpload(taskIdRef.current, { status: 'unscanned', message: 'Security scan quota is unavailable. Waiting for your decision.' })
      } else {
        if (taskIdRef.current) failUpload(taskIdRef.current, error, 'Signed copy upload failed.')
        taskIdRef.current = ''
        setNotice({ type: 'error', message: error?.message || 'Signed copy upload failed.' })
      }
    } finally {
      setIsUploading(false)
    }
  }

  const reviewAndUpload = async () => {
    if (!file) return
    if (invalidFile) {
      setNotice({ type: 'error', message: 'Only PDF, JPG, and PNG files up to 15 MB are allowed.' })
      return
    }
    const previewUrl = createPreviewUrl(file)
    try {
      const review = await requestDoubleCheck({
        type: 'document-upload',
        title: signedCopy ? `Review Replacement ${title}` : `Review ${title} Upload`,
        description: signedCopy ? 'The current signed copy will remain in version history and this file will become the active signed copy.' : 'Preview the signed file before protected upload starts.',
        confirmLabel: signedCopy ? 'Confirm & Replace Signed Copy' : 'Confirm & Upload Signed Copy',
        data: {
          targetDocument: { name: recordLabel },
          files: [{ name: file.name, fileName: file.name, type: file.type, fileType: file.type, size: formatBytes(file.size), fileSize: formatBytes(file.size), previewUrl }],
        },
      })
      if (!review.confirmed) return
      await runUpload({ confirmationToken: review.token })
    } finally {
      window.setTimeout(() => revokePreviewUrl(previewUrl), 5000)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{description}</p></div>
          <button type="button" onClick={onClose} disabled={isBusy} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </div>

        <div className="p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}

          {isLoading ? <div className="flex items-center justify-center gap-2 p-8 text-sm font-black text-slate-500"><FiLoader className="animate-spin" /> Loading signed copy...</div> : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Current signed copy</p>{signedCopy ? <><p className="mt-1 break-words text-sm font-black text-slate-950">{signedCopy.fileName}</p><p className="mt-1 text-xs font-semibold text-slate-500">Version {signedCopy.version || 1} · {formatBytes(signedCopy.fileSize)} · {formatDateTime(signedCopy.uploadedAt)}</p><p className={`mt-1 text-xs font-black ${getMalwareScanStatus(signedCopy) === 'approved' ? 'text-emerald-700' : getMalwareScanStatus(signedCopy) === 'rejected' || getMalwareScanStatus(signedCopy) === 'error' ? 'text-red-700' : 'text-amber-700'}`}>{malwareScanLabel(signedCopy)}</p></> : <p className="mt-1 text-sm font-semibold text-slate-500">No signed copy uploaded yet.</p>}</div>
                  {signedCopy ? <div className="flex shrink-0 flex-wrap justify-end gap-2"><button type="button" onClick={openSignedCopy} disabled={isOpening || !canOpenMalwareScannedFile(signedCopy)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">{isOpening ? <FiLoader className="animate-spin" /> : <FiExternalLink />}{viewLabel}</button>{allowDelete && !readOnly ? <button type="button" onClick={deleteSignedCopy} disabled={isBusy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">{isDeleting ? <FiLoader className="animate-spin" /> : <FiTrash2 />}{isDeleting ? 'Deleting...' : deleteLabel}</button> : null}</div> : null}
                </div>
              </section>

              {!readOnly ? <section className="mt-4 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-black text-slate-950">{signedCopy ? 'Replace Signed Copy' : 'Upload Signed Copy'}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">PDF, JPG, or PNG · maximum 15 MB. Replaced copies stay retained in protected version history.</p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center hover:bg-blue-100/60">
                  <FiUploadCloud className="h-8 w-8 text-blue-600" />
                  <span className="mt-2 text-sm font-black text-blue-900">Choose signed PDF or image</span>
                  <input type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" disabled={isBusy} className="hidden" onChange={(event) => { setNotice(null); setScanFallback(null); setFile(event.target.files?.[0] || null) }} />
                </label>
                {file ? <div className={`mt-3 flex items-center gap-3 rounded-xl border px-3 py-3 ${invalidFile ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}><FiFileText className={invalidFile ? 'text-red-600' : 'text-blue-600'} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{file.name}</p><p className="text-xs font-semibold text-slate-500">{formatBytes(file.size)}</p></div></div> : null}

                {scanFallback ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">Security scanning is temporarily unavailable.</p><p className="mt-1 text-xs font-semibold leading-5 text-amber-800">This file will be uploaded without malware scanning. Only continue if you trust the source of this file.</p><button type="button" onClick={() => runUpload({ allowUnscanned: true, fallbackToken: scanFallback.fallbackToken, confirmationToken: scanFallback.confirmationToken })} disabled={isUploading} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-amber-700 px-3 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-50"><FiShield />Upload Without Scan</button></div> : null}

                <div className="mt-4 flex justify-end"><button type="button" onClick={reviewAndUpload} disabled={!file || invalidFile || isBusy || Boolean(scanFallback)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{isUploading ? <FiLoader className="animate-spin" /> : <FiShield />}{isUploading ? 'Uploading...' : 'Proceed to Review'}</button></div>
              </section> : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SignedCopyUploadModal

