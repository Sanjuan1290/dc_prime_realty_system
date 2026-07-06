import { useState } from 'react'
import { FiFileText, FiLoader, FiUploadCloud, FiX } from 'react-icons/fi'

const UploadDocumentModal = ({ document, isSaving = false, onClose, onSave }) => {
  const [file, setFile] = useState(null)

  const [error, setError] = useState('')

  const readFileAsDataUrl = (selectedFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result || '')
      reader.onerror = () => reject(new Error('Failed to read selected file.'))
      reader.readAsDataURL(selectedFile)
    })

  const handleSave = async () => {
    if (!file || isSaving) return

    setError('')

    try {
      const fileUrl = await readFileAsDataUrl(file)
      onSave?.({
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      })
    } catch (readError) {
      setError(readError?.message || 'Failed to read selected file.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Upload Document</h2>
            <p className="text-sm font-semibold text-slate-500">{document.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 w-10 rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close upload document modal"
          >
            <FiX className="mx-auto" />
          </button>
        </div>

        <div className="p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center transition hover:bg-blue-100/60">
            <FiUploadCloud className="h-10 w-10 text-blue-600" />
            <span className="mt-3 text-sm font-black text-blue-800">Choose file</span>
            <span className="mt-1 text-xs font-semibold text-blue-700">PDF, image, or scanned document</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              disabled={isSaving}
              onChange={(event) => {
                setError('')
                setFile(event.target.files?.[0] || null)
              }}
            />
          </label>

          {file ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <FiFileText className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="truncate font-black text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{file.type || 'Unknown type'} · {(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
              {error}
            </p>
          ) : null}

          <p className="mt-3 text-xs font-semibold text-slate-500">
            Images are saved with preview data so Document Images and Print Documents can display them. Large PDF storage can be connected to Google Drive or Cloudinary later.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-2xl border px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!file || isSaving}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Save Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadDocumentModal
