import { useState } from 'react'
import { FiFileText, FiLoader, FiUploadCloud, FiX } from 'react-icons/fi'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_UPLOAD_URL = CLOUDINARY_CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`
  : ''

const uploadFileToCloudinary = async (selectedFile, { folder = '' } = {}) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in client/.env.')
  }

  const formData = new FormData()
  formData.append('file', selectedFile)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  if (folder) {
    formData.append('folder', folder)
    formData.append('tags', 'dc_prime,client_unit_document,document_image')
  }

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.')
  }

  if (!data?.secure_url) {
    throw new Error('Cloudinary did not return a secure file URL.')
  }

  return data
}

const UploadDocumentModal = ({ document, uploadFolder = '', isSaving = false, onClose, onSave }) => {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const isBusy = isSaving || isUploading

  const handleSave = async () => {
    if (!files.length || isBusy) return

    setError('')
    setIsUploading(true)

    try {
      const uploadedFiles = []

      for (const file of files) {
        const uploadedFile = await uploadFileToCloudinary(file, { folder: uploadFolder })

        uploadedFiles.push({
          fileName: file.name,
          fileUrl: uploadedFile.secure_url,
          fileSize: uploadedFile.bytes || file.size,
          fileType: uploadedFile.resource_type === 'image'
            ? file.type || uploadedFile.format || 'image/*'
            : file.type || 'application/octet-stream',
          cloudinaryPublicId: uploadedFile.public_id || null,
          cloudinaryResourceType: uploadedFile.resource_type || null,
          cloudinaryFolder: uploadFolder || null,
        })
      }

      onSave?.({
        files: uploadedFiles,
        fileName: uploadedFiles.length === 1 ? uploadedFiles[0].fileName : `${uploadedFiles.length} document image(s)`,
        fileUrl: uploadedFiles[0]?.fileUrl || '',
        fileSize: uploadedFiles.reduce((sum, file) => sum + Number(file.fileSize || 0), 0),
        fileType: uploadedFiles.length === 1 ? uploadedFiles[0].fileType : 'multiple/images',
        cloudinaryFolder: uploadFolder || null,
      })
    } catch (uploadError) {
      setError(uploadError?.message || 'Failed to upload file to Cloudinary.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Upload Document Images</h2>
            <p className="text-sm font-semibold text-slate-500">{document.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="h-10 w-10 rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close upload document modal"
          >
            <FiX className="mx-auto" />
          </button>
        </div>

        <div className="p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center transition hover:bg-blue-100/60">
            <FiUploadCloud className="h-10 w-10 text-blue-600" />
            <span className="mt-3 text-sm font-black text-blue-800">Choose one or more images</span>
            <span className="mt-1 text-xs font-semibold text-blue-700">Each selected image is added to this document's image gallery</span>
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              multiple
              disabled={isBusy}
              onChange={(event) => {
                setError('')
                setFiles(Array.from(event.target.files || []))
              }}
            />
          </label>

          {files.length ? (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <FiFileText className="h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{file.type || 'Unknown type'} · {(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
              {error}
            </p>
          ) : null}

          <p className="mt-3 text-xs font-semibold text-slate-500">
            Files are uploaded to Cloudinary under: <span className="font-black text-slate-700">{uploadFolder || 'dc_prime/projectName/unitId/documentName/documentimages'}</span>. Existing images for this document are kept, so one requirement can have multiple uploaded images.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="h-11 rounded-2xl border px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!files.length || isBusy}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isBusy ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
            {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Save Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadDocumentModal

