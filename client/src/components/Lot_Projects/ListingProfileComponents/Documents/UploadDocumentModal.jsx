import { useMemo, useState } from 'react'
import { FiFileText, FiLoader, FiShield, FiUploadCloud, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost } from '../../../../utils/useFetch'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0)
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const UploadDocumentModal = ({ document, signaturePath, isSaving = false, onClose, onSave }) => {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const isBusy = isSaving || isUploading
  const invalidFiles = useMemo(
    () => files.filter((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES),
    [files]
  )

  const uploadOne = async (file) => {
    const signatureResponse = await useFetchPost(signaturePath, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })
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

    const response = await fetch(signed.uploadUrl, { method: 'POST', body: formData })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(result?.error?.message || `Cloudinary upload failed for ${file.name}.`)

    return {
      fileName: file.name,
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

    setIsUploading(true)
    setProgress({ current: 0, total: files.length })
    setNotice({ type: 'loading', message: 'Preparing protected uploads...' })

    try {
      const uploadedFiles = []
      for (let index = 0; index < files.length; index += 1) {
        setProgress({ current: index + 1, total: files.length })
        setNotice({ type: 'loading', message: `Uploading ${index + 1} of ${files.length}: ${files[index].name}` })
        uploadedFiles.push(await uploadOne(files[index]))
      }

      setNotice({ type: 'loading', message: 'Verifying uploaded files and saving document records...' })
      await onSave?.({ files: uploadedFiles })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Protected upload failed.' })
    } finally {
      setIsUploading(false)
    }
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
                    {isUploading && progress.current === index + 1 ? <FiLoader className="h-4 w-4 animate-spin text-blue-600" /> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600">
            The server assigns the buyer account folder and signs each upload. Files use authenticated Cloudinary delivery and open through short-lived access links.
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isBusy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!files.length || Boolean(invalidFiles.length) || isBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isBusy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiShield className="h-4 w-4" />}
            {isUploading ? `Uploading ${progress.current}/${progress.total}` : isSaving ? 'Saving...' : 'Upload Securely'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default UploadDocumentModal
