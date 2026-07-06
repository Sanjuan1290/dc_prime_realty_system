
import { useState } from 'react'
import { FiLoader, FiUploadCloud, FiX } from 'react-icons/fi'

const getMockFileUrl = (fileName) => {
  const clean = String(fileName || 'uploaded-document.pdf').trim().replace(/[\\/]+/g, '-').replace(/\s+/g, '-')
  return `/mock-documents/${encodeURIComponent(clean || 'uploaded-document.pdf')}`
}

const UploadDocumentModal = ({ document, isSaving = false, onClose, onSave }) => {
  const [file, setFile] = useState(null)

  const handleSave = () => {
    if (!file || isSaving) return

    onSave?.({
      fileName: file.name,
      fileUrl: getMockFileUrl(file.name),
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black">Upload Document</h2>
            <p className="text-sm font-semibold text-slate-500">{document.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 w-10 rounded-2xl hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={isSaving}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          {file ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
              Selected: {file.name}
            </p>
          ) : null}
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
