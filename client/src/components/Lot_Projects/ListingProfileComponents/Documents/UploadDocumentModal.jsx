import { useMemo, useRef, useState } from 'react'
import { FiExternalLink, FiFileText, FiLoader, FiShield, FiUploadCloud, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost } from '../../../../utils/useFetch'
import { requestDoubleCheck } from '../../../../utils/doubleCheck'
import { useUploadSecurity } from '../../../Shared/UploadSecurityCenter/UploadSecurityProvider.jsx'
import {
  appendCloudinarySecurityFields,
  createCloudinaryMalwareQuotaError,
  getMalwareFallbackToken,
  isCloudinaryMalwareQuotaError,
  isMalwareQuotaFallbackError,
} from '../../../../utils/cloudinaryUploadSecurity'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])

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

const UploadDocumentModal = ({ document, signaturePath, isSaving = false, onClose, onSave }) => {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [scanFallback, setScanFallback] = useState(null)
  const taskIdsRef = useRef([])
  const {
    addUpload,
    updateUpload,
    beginSecurityScan,
    failUpload,
  } = useUploadSecurity()

  const isBusy = isSaving || isUploading
  const invalidFiles = useMemo(
    () => files.filter((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES),
    [files]
  )

  const createStatusTasks = () => {
    const taskIds = files.map((file) => addUpload({
      fileName: file.name,
      category: 'Buyer document',
      detail: document?.name || 'Document',
    }))
    taskIdsRef.current = taskIds
    return taskIds
  }

  const updateTaskAt = (index, patch) => {
    const taskId = taskIdsRef.current[index]
    if (taskId) updateUpload(taskId, patch)
  }

  const failBatchTasks = (error, fallbackMessage = 'Protected upload failed.') => {
    taskIdsRef.current.forEach((taskId) => {
      if (taskId) failUpload(taskId, error, fallbackMessage)
    })
  }

  const startSavedFileScans = (completed = [], saveResult = {}) => {
    const entries = saveResult?.imageEntries || saveResult?.data?.imageEntries || []

    completed.forEach((file, index) => {
      const taskId = taskIdsRef.current[index]
      if (!taskId) return

      const savedEntry = entries.find((entry) => {
        const assetId = entry?.cloudinaryAssetId || entry?.cloudinary_asset_id || ''
        const publicId = entry?.cloudinaryPublicId || entry?.cloudinary_public_id || ''
        return (file.cloudinaryAssetId && assetId === file.cloudinaryAssetId)
          || (file.cloudinaryPublicId && publicId === file.cloudinaryPublicId)
      }) || {}

      beginSecurityScan(taskId, {
        accessPath: savedEntry.accessPath || savedEntry.access_path || '',
        malwareScanStatus: savedEntry.malwareScanStatus || savedEntry.malware_scan_status || file.malwareScanStatus || 'pending',
      })
    })
  }

  const uploadOne = async (file, uploadIndex, uploadCount, { allowUnscanned = false, fallbackToken = '' } = {}) => {
    const signatureResponse = await useFetchPost(signaturePath, {
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
    formData.append('tags', signed.tags || 'dc_prime,buyer_document,authenticated')
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
        fileVersion: Number(signed.fileVersion || 0) || null,
        fileSequence: Number(signed.fileSequence || uploadIndex || 1),
        fileUrl: result?.secure_url || '',
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
      message: allowUnscanned ? 'Preparing unscanned protected uploads...' : 'Preparing protected uploads and security scanning...',
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
              ? 'Upload complete. Saving the file as not security scanned.'
              : 'Upload complete. Saving the protected file before the security result is tracked.',
          })
        } catch (error) {
          if (!allowUnscanned && isMalwareQuotaFallbackError(error)) {
            updateTaskAt(index, {
              status: 'waiting_confirmation',
              message: 'The malware-scanning quota is unavailable. Choose Cancel or Upload Without Scan in the upload window.',
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

      setNotice({ type: 'loading', message: 'Verifying uploaded files and saving document records...' })
      const saveResult = await onSave?.({ files: completed, confirmationToken })
      startSavedFileScans(completed, saveResult || {})
      setScanFallback(null)
      return true
    } catch (error) {
      failBatchTasks(error, 'Protected upload failed before the file record could be saved.')
      setNotice({ type: 'error', message: error?.message || 'Protected upload failed.' })
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!files.length || isBusy) return
    if (!signaturePath) {
      setNotice({ type: 'error', message: 'The secure upload route is missing.' })
      return
    }
    if (invalidFiles.length) {
      setNotice({ type: 'error', message: 'Only PDF, JPG, and PNG files up to 15 MB are accepted.' })
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
        type: 'document-upload',
        data: {
          targetDocument: { name: document?.name || 'Buyer document' },
          files: reviewFiles,
        },
      })
    } finally {
      reviewFiles.forEach((file) => window.setTimeout(() => revokeLocalPreviewUrl(file.previewUrl), 60_000))
    }
    if (!reviewResult.confirmed) {
      setNotice({ type: 'info', message: 'Upload review cancelled. No files were uploaded or saved.' })
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
              <FiShield /> Protected upload
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Upload Document Files</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{document?.name || 'Buyer document'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isBusy} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50" aria-label="Close upload modal">
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

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center transition hover:bg-blue-100/60">
            <FiUploadCloud className="h-10 w-10 text-blue-600" />
            <span className="mt-3 text-sm font-black text-blue-900">Choose PDF, JPG, or PNG files</span>
            <span className="mt-1 text-xs font-semibold text-blue-700">Maximum 15 MB per file</span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
              multiple
              disabled={isBusy}
              className="hidden"
              onChange={(event) => {
                setNotice(null)
                setScanFallback(null)
                setFiles(Array.from(event.target.files || []))
              }}
            />
          </label>

          {files.length ? (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => {
                const invalid = !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES
                return (
                  <div key={`${file.name}-${file.size}-${index}`} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${invalid ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <FiFileText className={`h-5 w-5 shrink-0 ${invalid ? 'text-red-600' : 'text-blue-600'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{file.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{file.type || 'Unknown file type'} · {formatBytes(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => previewLocalFile(file)} disabled={isBusy || invalid} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                      <FiExternalLink className="h-3.5 w-3.5" /> Preview
                    </button>
                    {isUploading && progress.current === index + 1 ? <FiLoader className="h-4 w-4 animate-spin text-blue-600" /> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600">
            The server signs each protected upload and requests malware scanning when quota is available. If the monthly scanner quota is exhausted, uploading without a scan requires your explicit confirmation. Files still use authenticated Cloudinary storage and are viewed through the logged-in portal without exposing Cloudinary access links.
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isBusy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!files.length || Boolean(invalidFiles.length) || isBusy || Boolean(scanFallback)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isBusy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiShield className="h-4 w-4" />}
            {isUploading ? `Uploading ${progress.current}/${progress.total}` : isSaving ? 'Saving...' : 'Proceed to Review'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default UploadDocumentModal

