import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiExternalLink,
  FiFileText,
  FiImage,
  FiLoader,
  FiPaperclip,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../../utils/useFetch'
import { requestDoubleCheck } from '../../../../utils/doubleCheck'
import { useUploadSecurity } from '../../../Shared/UploadSecurityCenter/UploadSecurityProvider.jsx'
import {
  appendCloudinarySecurityFields,
  canOpenMalwareScannedFile,
  createCloudinaryMalwareQuotaError,
  getMalwareFallbackToken,
  getMalwareScanStatus,
  isCloudinaryMalwareQuotaError,
  isMalwareQuotaFallbackError,
  malwareScanLabel,
} from '../../../../utils/cloudinaryUploadSecurity'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_FILES = 5
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value || value === '-') return '-'
  const text = String(value).slice(0, 10)
  const [year, month, day] = text.split('-').map(Number)
  if (!year || !month || !day) return text
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0)
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const createLocalPreviewUrl = (file) => (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')
const revokeLocalPreviewUrl = (url) => { if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url) }
const previewLocalFile = (file) => {
  const url = createLocalPreviewUrl(file)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => revokeLocalPreviewUrl(url), 60_000)
}

const isPdf = (proof = {}) =>
  String(proof.fileType || '').toLowerCase() === 'application/pdf' ||
  String(proof.fileName || '').toLowerCase().endsWith('.pdf')

const PaymentProofModal = ({
  projectSlug,
  listingId,
  payment,
  readOnly = false,
  canDelete = false,
  onClose,
  onChanged,
  onCountChange,
}) => {
  const paymentId = Number(payment?.paymentId || payment?.id || 0)
  const basePath = `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${paymentId}/proofs`

  const [proofs, setProofs] = useState([])
  const [paymentDetails, setPaymentDetails] = useState(payment || {})
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [preview, setPreview] = useState(null)
  const [openingProofId, setOpeningProofId] = useState(0)
  const [deletingProofId, setDeletingProofId] = useState(0)
  const [scanFallback, setScanFallback] = useState(null)
  const taskIdsRef = useRef([])
  const {
    addUpload,
    updateUpload,
    beginSecurityScan,
    failUpload,
  } = useUploadSecurity()

  const invalidFiles = useMemo(
    () => files.filter((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES),
    [files]
  )

  const remainingSlots = Math.max(MAX_FILES - proofs.length, 0)
  const isBusy = isLoading || isUploading || Boolean(deletingProofId)

  const createStatusTasks = () => {
    const taskIds = files.map((file) => addUpload({
      fileName: file.name,
      category: 'Payment proof',
      detail: paymentDetails.referenceId || payment?.referenceId || `Payment #${paymentId}`,
    }))
    taskIdsRef.current = taskIds
    return taskIds
  }

  const updateTaskAt = (index, patch) => {
    const taskId = taskIdsRef.current[index]
    if (taskId) updateUpload(taskId, patch)
  }

  const failBatchTasks = (error, fallbackMessage = 'Payment proof upload failed.') => {
    taskIdsRef.current.forEach((taskId) => {
      if (taskId) failUpload(taskId, error, fallbackMessage)
    })
  }

  const startSavedProofScans = (completed = [], result = {}) => {
    const proofIds = Array.isArray(result?.proofIds)
      ? result.proofIds
      : Array.isArray(result?.data?.proofIds)
        ? result.data.proofIds
        : []

    completed.forEach((file, index) => {
      const taskId = taskIdsRef.current[index]
      if (!taskId) return
      const proofId = Number(proofIds[index] || 0)
      beginSecurityScan(taskId, {
        accessPath: proofId ? `${basePath}/${proofId}/access-url` : '',
        malwareScanStatus: file.malwareScanStatus || 'pending',
        message: proofId
          ? ''
          : 'Upload succeeded, but the saved proof status reference was not returned.',
      })
    })
  }

  const loadProofs = async ({ quiet = false } = {}) => {
    if (!paymentId) return
    if (!quiet) setIsLoading(true)
    try {
      const result = await useFetch(basePath)
      const data = result?.data || {}
      const nextProofs = Array.isArray(data.proofs) ? data.proofs : []
      setProofs(nextProofs)
      setPaymentDetails((current) => ({ ...current, ...(data.payment || {}) }))
      onCountChange?.(nextProofs.length)
      if (!quiet) setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to load payment proof files.' })
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProofs()
    // Payment ID identifies the modal contents. Parent callbacks are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId])

  const uploadOne = async (file, uploadIndex, uploadCount, { allowUnscanned = false, fallbackToken = '' } = {}) => {
    const signatureResponse = await useFetchPost(`${basePath}/upload-signature`, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadIndex,
      uploadCount,
      ...(allowUnscanned ? { allowUnscanned: true, fallbackToken } : {}),
    }, { confirmationHandled: 'technical' })
    const signed = signatureResponse?.data || {}
    if (!signed.uploadUrl || !signed.signature || !signed.apiKey) {
      throw new Error('The server did not return a valid protected upload signature.')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', signed.apiKey)
    formData.append('timestamp', String(signed.timestamp))
    formData.append('signature', signed.signature)
    formData.append('public_id', signed.publicId)
    formData.append('asset_folder', signed.folder)
    formData.append('type', signed.type || 'authenticated')
    formData.append('tags', signed.tags || 'dc_prime,payment_proof,authenticated')
    formData.append('context', signed.context || '')
    appendCloudinarySecurityFields(formData, signed)

    const response = await fetch(signed.uploadUrl, { method: 'POST', body: formData })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      if (isCloudinaryMalwareQuotaError({ response, result, scanRequested: signed.malwareScanRequested })) {
        throw createCloudinaryMalwareQuotaError({
          result,
          fallbackToken: signed.fallbackToken || fallbackToken,
        })
      }
      throw new Error(result?.error?.message || `Cloudinary upload failed for ${file.name}.`)
    }

    return {
      fallbackToken: signed.fallbackToken || fallbackToken,
      uploadedFile: {
        fileName: file.name,
        storedFileName: signed.storedFileName || null,
        proofSequence: Number(signed.proofSequence || uploadIndex || 1),
        fileSize: Number(result?.bytes || file.size),
        fileType: file.type,
        cloudinaryAssetId: result?.asset_id || null,
        cloudinaryPublicId: result?.public_id || null,
        cloudinaryResourceType: result?.resource_type || (file.type === 'application/pdf' ? 'raw' : 'image'),
        cloudinaryDeliveryType: result?.type || 'authenticated',
        cloudinaryVersion: Number(result?.version || 0) || null,
        cloudinaryFolder: result?.asset_folder || signed.folder,
        cloudinaryAssetFolder: result?.asset_folder || signed.folder,
        cloudinaryFormat: result?.format || null,
        malwareScanStatus: signed.malwareScanStatus || (signed.malwareScanRequested ? 'pending' : 'not_scanned'),
        malwareScanProvider: signed.malwareScanProvider || null,
        malwareScanReason: signed.malwareScanReason || null,
      },
    }
  }

  const runUploadBatch = async ({
    startIndex = 0,
    uploadedFiles = [],
    allowUnscanned = false,
    fallbackToken = '',
    confirmationToken = '',
  } = {}) => {
    setIsUploading(true)
    setProgress({ current: startIndex, total: files.length })
    setNotice({
      type: 'loading',
      message: allowUnscanned
        ? 'Preparing payment proof upload without security scanning...'
        : 'Preparing protected payment proof upload and security scanning...',
    })

    const completed = [...uploadedFiles]
    let activeFallbackToken = fallbackToken

    try {
      for (let index = startIndex; index < files.length; index += 1) {
        setProgress({ current: index + 1, total: files.length })
        setNotice({
          type: 'loading',
          message: `${allowUnscanned ? 'Uploading without security scan' : 'Uploading and requesting security scan'} ${index + 1} of ${files.length}: ${files[index].name}`,
        })
        updateTaskAt(index, {
          status: 'uploading',
          message: allowUnscanned
            ? 'Uploading without malware scanning after your confirmation.'
            : 'Uploading securely to Cloudinary and requesting malware scanning.',
        })

        try {
          const upload = await uploadOne(files[index], index + 1, files.length, {
            allowUnscanned,
            fallbackToken: activeFallbackToken,
          })
          activeFallbackToken = upload.fallbackToken || activeFallbackToken
          completed.push(upload.uploadedFile)
          updateTaskAt(index, {
            status: 'saving',
            message: allowUnscanned
              ? 'Upload complete. Saving the proof as not security scanned.'
              : 'Upload complete. Saving the protected proof before the security result is tracked.',
          })
        } catch (error) {
          if (!allowUnscanned && isMalwareQuotaFallbackError(error)) {
            updateTaskAt(index, {
              status: 'waiting_confirmation',
              message: 'The malware-scanning quota is unavailable. Choose Cancel or Upload Without Scan in the payment proof window.',
            })
            setScanFallback({
              startIndex: index,
              uploadedFiles: completed,
              fallbackToken: getMalwareFallbackToken(error) || error?.fallbackToken || '',
              confirmationToken,
            })
            setNotice(null)
            return false
          }
          failUpload(taskIdsRef.current[index], error, `Upload failed for ${files[index].name}.`)
          throw error
        }
      }

      setNotice({ type: 'loading', message: 'Saving protected payment proof records...' })
      const result = await useFetchPost(basePath, { files: completed, note: note.trim() }, { confirmationToken: confirmationToken })
      startSavedProofScans(completed, result || {})
      setFiles([])
      setNote('')
      setScanFallback(null)
      setNotice({ type: 'success', message: result?.message || 'Payment proof uploaded successfully.' })
      await loadProofs({ quiet: true })
      await onChanged?.()
      return true
    } catch (error) {
      failBatchTasks(error, 'Payment proof upload failed before the secure record could be saved.')
      setNotice({ type: 'error', message: error?.message || 'Payment proof upload failed.' })
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!files.length || isBusy || readOnly) return
    if (invalidFiles.length) {
      setNotice({ type: 'error', message: 'Only PDF, JPG, and PNG files up to 15 MB are accepted.' })
      return
    }
    if (files.length > remainingSlots) {
      setNotice({ type: 'error', message: `You can add only ${remainingSlots} more proof file(s) to this payment.` })
      return
    }

    const reviewFiles = files.map((file) => ({
      fileName: file.name,
      fileType: file.type,
      fileSize: formatBytes(file.size),
      previewUrl: createLocalPreviewUrl(file),
    }))
    let reviewResult = { confirmed: false, token: '' }
    try {
      reviewResult = await requestDoubleCheck({
        type: 'payment-proof',
        data: {
          payment: {
            buyer: paymentDetails.buyerName || payment?.client || '-',
            unit: paymentDetails.unitId || payment?.unit || '-',
            amount: paymentDetails.amount ?? payment?.amount ?? 0,
            paymentDate: paymentDetails.paymentDate || payment?.paymentDate || '-',
            method: paymentDetails.method || payment?.method || '-',
            reference: paymentDetails.referenceId || payment?.referenceId || '-',
          },
          uploadNote: { note: note.trim() },
          files: reviewFiles,
        },
      })
    } finally {
      reviewFiles.forEach((file) => window.setTimeout(() => revokeLocalPreviewUrl(file.previewUrl), 60_000))
    }
    if (!reviewResult.confirmed) {
      setNotice({ type: 'info', message: 'Payment proof review cancelled. No files were uploaded or saved.' })
      return
    }

    setScanFallback(null)
    createStatusTasks()
    await runUploadBatch({ confirmationToken: reviewResult.token })
  }

  const uploadWithoutScan = async () => {
    if (!scanFallback || isBusy) return
    const pending = scanFallback
    setScanFallback(null)
    await runUploadBatch({
      startIndex: pending.startIndex,
      uploadedFiles: pending.uploadedFiles,
      allowUnscanned: true,
      fallbackToken: pending.fallbackToken,
      confirmationToken: pending.confirmationToken,
    })
  }

  const cancelUnscannedUpload = () => {
    taskIdsRef.current.forEach((taskId) => {
      if (taskId) {
        updateUpload(taskId, {
          status: 'cancelled',
          message: 'Upload was cancelled because security scanning was unavailable.',
        })
      }
    })
    setScanFallback(null)
    setNotice({ type: 'info', message: 'Upload without security scanning was cancelled.' })
  }

  const openProof = async (proof) => {
    if (!canOpenMalwareScannedFile(proof)) {
      setNotice({
        type: getMalwareScanStatus(proof) === 'rejected' ? 'error' : 'warning',
        message: `${malwareScanLabel(proof)}. This file cannot be opened right now.`,
      })
      return
    }
    if (getMalwareScanStatus(proof) === 'not_scanned') {
      const confirmed = window.confirm('This file was not malware scanned. Open it only if you trust the source. Continue?')
      if (!confirmed) return
    }

    setOpeningProofId(proof.proofId)
    try {
      const result = await useFetch(proof.accessPath)
      const url = result?.data?.url || result?.url || ''
      if (!url) throw new Error('The server did not return a protected proof link.')
      if (isPdf(proof)) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setPreview({ ...proof, url })
      }
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to open payment proof.' })
    } finally {
      setOpeningProofId(0)
    }
  }

  const removeProof = async (proof) => {
    if (!canDelete || readOnly || deletingProofId) return
    const confirmed = window.confirm(`Remove ${proof.fileName}? The payment record itself will not be changed.`)
    if (!confirmed) return

    setDeletingProofId(proof.proofId)
    setNotice({ type: 'loading', message: `Removing ${proof.fileName}...` })
    try {
      const result = await useFetchPost(`${basePath}/${proof.proofId}/delete`, {}, { confirmationHandled: 'compact' })
      setNotice({ type: 'success', message: result?.message || 'Payment proof removed successfully.' })
      await loadProofs({ quiet: true })
      await onChanged?.()
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to remove payment proof.' })
    } finally {
      setDeletingProofId(0)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
              <FiShield /> Protected payment evidence
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Payment Proof</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Screenshots or PDF confirmations sent by the client. These are supporting files, not official receipts.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isUploading} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50" aria-label="Close payment proof">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}

          {scanFallback ? (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <FiShield className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-sm font-black">Security scanning is temporarily unavailable.</h3>
                  <p className="mt-1 text-xs font-semibold leading-5">
                    This file will be uploaded without malware scanning. Only continue if you trust the source of this file.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={cancelUnscannedUpload} className="h-9 rounded-lg border border-amber-300 bg-white px-4 text-xs font-black text-amber-900">
                  Cancel
                </button>
                <button type="button" onClick={uploadWithoutScan} className="h-9 rounded-lg bg-amber-700 px-4 text-xs font-black text-white hover:bg-amber-800">
                  Upload Without Scan
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-7">
            <div><p className="text-xs font-black uppercase text-slate-500">Buyer</p><p className="mt-1 text-sm font-black text-slate-950">{paymentDetails.buyerName || payment?.client || '-'}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Unit</p><p className="mt-1 text-sm font-black text-slate-950">{paymentDetails.unitId || payment?.unit || '-'}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Amount</p><p className="mt-1 text-sm font-black text-slate-950">{money(paymentDetails.amount ?? payment?.amount)}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Payment Date</p><p className="mt-1 text-sm font-black text-slate-950">{formatDate(paymentDetails.paymentDate || payment?.paymentDate)}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Method</p><p className="mt-1 text-sm font-black text-slate-950">{paymentDetails.method || payment?.method || '-'}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Reference</p><p className="mt-1 break-all text-sm font-black text-slate-950">{paymentDetails.referenceId || payment?.referenceId || '-'}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-500">Storage Code</p><p className="mt-1 font-mono text-sm font-black text-slate-950">{paymentDetails.storageCode || payment?.storageCode || '-'}</p></div>
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">Saved Proof Files</h3>
                <p className="text-xs font-semibold text-slate-500">{proofs.length} of {MAX_FILES} file slots used</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"><FiPaperclip /> {proofs.length}</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm font-black text-slate-500"><FiLoader className="animate-spin" /> Loading payment proof...</div>
            ) : proofs.length ? (
              <div className="divide-y divide-slate-100">
                {proofs.map((proof) => (
                  <div key={proof.proofId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      {isPdf(proof) ? <FiFileText className="h-5 w-5" /> : <FiImage className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{proof.fileName}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatBytes(proof.fileSize)} · Uploaded by {proof.uploadedBy} · {formatDateTime(proof.uploadedAt)}</p>
                      {proof.storedFileName ? <p className="mt-1 truncate font-mono text-[11px] font-bold text-slate-500">Cloudinary: {proof.storedFileName}</p> : null}
                      <p className={`mt-1 text-[11px] font-black ${
                        getMalwareScanStatus(proof) === 'approved'
                          ? 'text-emerald-700'
                          : getMalwareScanStatus(proof) === 'pending'
                            ? 'text-amber-700'
                            : getMalwareScanStatus(proof) === 'rejected' || getMalwareScanStatus(proof) === 'error'
                              ? 'text-red-700'
                              : 'text-amber-700'
                      }`}>
                        {malwareScanLabel(proof)}
                      </p>
                      {proof.note ? <p className="mt-1 text-xs font-semibold text-slate-600">Note: {proof.note}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => openProof(proof)} disabled={openingProofId === proof.proofId} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-50">
                        {openingProofId === proof.proofId ? <FiLoader className="animate-spin" /> : <FiExternalLink />}
                        View
                      </button>
                      {!readOnly && canDelete ? (
                        <button type="button" onClick={() => removeProof(proof)} disabled={deletingProofId === proof.proofId} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                          {deletingProofId === proof.proofId ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FiPaperclip className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-700">No payment proof uploaded yet</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Attach the screenshot or PDF sent by the client.</p>
              </div>
            )}
          </section>

          {!readOnly && remainingSlots > 0 ? (
            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-black text-slate-950">Add Payment Proof</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">PDF, JPG, or PNG · up to 15 MB per file · {remainingSlots} slot(s) remaining</p>

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center transition hover:bg-blue-100/60">
                <FiUploadCloud className="h-8 w-8 text-blue-600" />
                <span className="mt-2 text-sm font-black text-blue-900">Choose payment screenshot or PDF</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                  multiple
                  disabled={isBusy}
                  className="hidden"
                  onChange={(event) => {
                    setNotice(null)
                    setScanFallback(null)
                    setFiles(Array.from(event.target.files || []).slice(0, remainingSlots))
                  }}
                />
              </label>

              {files.length ? (
                <div className="mt-3 space-y-2">
                  {files.map((file, index) => {
                    const invalid = !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES
                    return (
                      <div key={`${file.name}-${file.size}-${index}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${invalid ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                        <FiFileText className={invalid ? 'text-red-600' : 'text-blue-600'} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{file.name}</p><p className="text-xs font-semibold text-slate-500">{formatBytes(file.size)}</p></div>
                        <button type="button" onClick={() => previewLocalFile(file)} disabled={isBusy || invalid} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><FiExternalLink /> Preview</button>
                        {isUploading && progress.current === index + 1 ? <FiLoader className="animate-spin text-blue-600" /> : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase text-slate-500">Optional Note</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} disabled={isBusy} rows={3} placeholder="Example: Client sent this through Messenger." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                <span className="mt-1 block text-right text-xs font-semibold text-slate-400">{note.length}/500</span>
              </label>

              <div className="mt-4 flex justify-end">
                <button type="button" onClick={handleUpload} disabled={!files.length || Boolean(invalidFiles.length) || isBusy || Boolean(scanFallback)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
                  {isUploading ? <FiLoader className="animate-spin" /> : <FiShield />}
                  {isUploading ? `Uploading ${progress.current}/${progress.total}` : 'Proceed to Review'}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isUploading} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">Close</button>
        </footer>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-[94vh] max-w-[94vw]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPreview(null)} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg"><FiX /></button>
            <img src={preview.url} alt={preview.fileName || 'Payment proof'} className="max-h-[94vh] max-w-[94vw] rounded-2xl bg-white object-contain shadow-2xl" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PaymentProofModal
