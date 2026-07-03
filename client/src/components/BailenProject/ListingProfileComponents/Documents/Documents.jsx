import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiTrash2, FiUploadCloud } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchDelete, useFetchPut } from '../../../../utils/useFetch'
import UploadDocumentModal from './UploadDocumentModal'

const Documents = ({ listing, documents = [] }) => {
  const queryClient = useQueryClient()
  const [selectedRequirement, setSelectedRequirement] = useState(null)
  const [alert, setAlert] = useState(null)

  const approveMutation = useMutation({ mutationFn: (id) => useFetchPut(`/bailen/listing-profile/${listing.bailen_listing_id}/documents/${id}/approve`, {}), onSuccess: (r)=>{setAlert({type:'success',message:r?.message||'Document approved.'}); queryClient.invalidateQueries({queryKey:['bailen-listing-profile']})}, onError: (e)=>setAlert({type:'error',message:e.message}) })
  const deleteMutation = useMutation({ mutationFn: (id) => useFetchDelete(`/bailen/listing-profile/${listing.bailen_listing_id}/documents/${id}/upload`), onSuccess: (r)=>{setAlert({type:'success',message:r?.message||'Upload deleted.'}); queryClient.invalidateQueries({queryKey:['bailen-listing-profile']})}, onError: (e)=>setAlert({type:'error',message:e.message}) })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5"><h2 className="text-lg font-bold text-slate-950">Documents</h2><p className="text-sm font-semibold text-slate-500">Upload and review the listing document checklist.</p></div>
      <div className="p-5">{alert ? <StatusAlert type={alert.type} message={alert.message} onClose={()=>setAlert(null)} className="mb-4" /> : null}<div className="grid gap-3">{documents.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">No document checklist found.</p> : documents.map((doc)=><div key={doc.listing_document_requirement_id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><div><p className="font-bold text-slate-950">{doc.document_name}</p><p className="text-sm font-semibold text-slate-500">{doc.requirement} • {doc.document_review_status}</p>{doc.uploaded_file_url ? <a className="text-sm font-bold text-blue-700" href={doc.uploaded_file_url} target="_blank" rel="noreferrer">View uploaded file</a> : null}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">{doc.status}</span><button onClick={()=>setSelectedRequirement(doc)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><FiUploadCloud />Upload</button><div className="flex gap-2"><button onClick={()=>approveMutation.mutate(doc.listing_document_requirement_id)} disabled={!doc.uploaded_file_url} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"><FiCheckCircle />Approve</button><button onClick={()=>deleteMutation.mutate(doc.listing_document_requirement_id)} disabled={!doc.uploaded_file_url} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50"><FiTrash2 />Delete</button></div></div>)}</div></div>
      {selectedRequirement ? <UploadDocumentModal listingId={listing.bailen_listing_id} requirement={selectedRequirement} onClose={()=>setSelectedRequirement(null)} /> : null}
    </section>
  )
}

export default Documents
