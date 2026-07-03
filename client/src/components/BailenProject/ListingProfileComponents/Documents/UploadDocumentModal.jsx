import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiUploadCloud, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload'
import { useFetchPut } from '../../../../utils/useFetch'

const UploadDocumentModal = ({ listingId, requirement, onClose }) => {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [alert, setAlert] = useState(null)

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setAlert({ type: 'loading', message: 'Uploading file to Cloudinary...' })
      const uploaded = await uploadToCloudinary(file)
      setAlert({ type: 'loading', message: 'Saving document record...' })
      return useFetchPut(`/bailen/listing-profile/${listingId}/documents/${requirement.listing_document_requirement_id}/upload`, {
        uploaded_file_url: uploaded.url,
        uploaded_file_name: file.name,
        uploaded_public_id: uploaded.public_id,
      })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document uploaded.' })
      queryClient.invalidateQueries({ queryKey: ['bailen-listing-profile'] })
      setTimeout(onClose, 650)
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to upload document.' }),
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-xl font-bold text-slate-950">Upload Document</h3><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><FiX /></button></div>
        <div className="p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-bold text-slate-950">{requirement.document_name}</p><p className="text-sm font-semibold text-slate-500">{requirement.requirement} • {requirement.document_review_status}</p></div>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:bg-slate-50"><FiUploadCloud className="h-10 w-10 text-blue-600" /><span className="mt-3 text-sm font-bold text-slate-950">{file ? file.name : 'Choose file'}</span><span className="mt-1 text-xs font-semibold text-slate-500">PDF or image file</span><input type="file" className="hidden" onChange={(e)=>setFile(e.target.files?.[0] || null)} /></label>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={onClose} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700">Cancel</button><button onClick={()=>uploadMutation.mutate()} disabled={!file || uploadMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-60"><FiUploadCloud />{uploadMutation.isPending ? 'Uploading...' : 'Upload'}</button></div>
      </div>
    </div>
  )
}

export default UploadDocumentModal
