import { useMemo, useState } from 'react'
import { FiCheckCircle, FiImage, FiLoader, FiTrash2, FiUploadCloud } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import UploadDocumentModal from './UploadDocumentModal'
import DocumentImagesModal from './DocumentImagesModal'

const statusStyles = { Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700', Submitted: 'border-blue-200 bg-blue-50 text-blue-700', Missing: 'border-red-200 bg-red-50 text-red-700', Rejected: 'border-amber-200 bg-amber-50 text-amber-700' }
const requirementStyles = { Required: 'border-blue-200 bg-blue-50 text-blue-700', Optional: 'border-slate-200 bg-slate-100 text-slate-600' }
const StatusPill = ({ value }) => <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${statusStyles[value] || 'border-slate-200 bg-slate-100 text-slate-600'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{value || 'Missing'}</span>
const RequirementPill = ({ value }) => <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black ${requirementStyles[value] || requirementStyles.Optional}`}>{value || 'Optional'}</span>

const Documents = ({ documents = [], onUpload, onMarkStatus, onClear, isUploading = false, isUpdatingStatus = false, isClearing = false }) => {
  const [uploadDoc, setUploadDoc] = useState(null)
  const [imagesDoc, setImagesDoc] = useState(null)
  const [alert, setAlert] = useState(null)
  const [activeDocumentId, setActiveDocumentId] = useState(null)

  const approvedCount = useMemo(() => documents.filter((row) => row.status === 'Approved').length, [documents])
  const submittedCount = useMemo(() => documents.filter((row) => row.status === 'Submitted').length, [documents])
  const missingCount = useMemo(() => documents.filter((row) => row.status === 'Missing').length, [documents])
  const requiredCount = useMemo(() => documents.filter((row) => row.requirement === 'Required').length, [documents])

  const handleUploadSave = async (payload) => {
    if (!uploadDoc) return
    setActiveDocumentId(uploadDoc.documentId)
    await onUpload?.(uploadDoc.documentId, payload)
    setUploadDoc(null)
    setActiveDocumentId(null)
  }

  const handleApproveDocument = async (document) => {
    if (document.status === 'Missing') {
      setAlert({ type: 'warning', message: 'Upload or submit a document first before approving it.' })
      return
    }
    setActiveDocumentId(document.documentId)
    await onMarkStatus?.(document.documentId, 'Approved')
    setActiveDocumentId(null)
  }

  const handleClearDocument = async (document) => {
    const confirmed = window.confirm(`Clear uploaded file for ${document.name}?`)
    if (!confirmed) return
    setActiveDocumentId(document.documentId)
    await onClear?.(document.documentId)
    setActiveDocumentId(null)
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} className="mb-4" /> : null}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-2xl font-black text-slate-950">Documents</h2><p className="mt-1 text-sm font-semibold text-slate-500">Upload, review, approve, and print the buyer document checklist.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{documents.length} total</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{approvedCount} approved</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{submittedCount} submitted</span><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{missingCount} missing</span></div></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase text-blue-700">Required</p><p className="mt-2 text-2xl font-black text-blue-900">{requiredCount}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Approved</p><p className="mt-2 text-2xl font-black text-emerald-900">{approvedCount}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Submitted</p><p className="mt-2 text-2xl font-black text-amber-900">{submittedCount}</p></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Missing</p><p className="mt-2 text-2xl font-black text-red-900">{missingCount}</p></div></div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="overflow-x-auto"><table className="min-w-[1050px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{['Document','Requirement','Status','File','Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{documents.map((document) => { const isActive = activeDocumentId === document.documentId; return <tr key={document.documentId} className="transition hover:bg-slate-50"><td className="px-4 py-4"><p className="font-black text-slate-950">{document.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{document.description}</p></td><td className="px-4 py-4"><RequirementPill value={document.requirement} /></td><td className="px-4 py-4"><StatusPill value={document.status} /></td><td className="px-4 py-4 font-semibold text-slate-600">{document.fileName || '-'}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setUploadDoc(document)} disabled={isUploading || isActive} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60">{isUploading && isActive ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiUploadCloud className="h-3.5 w-3.5" />}{document.status === 'Missing' ? 'Upload' : 'Replace'}</button><button type="button" onClick={() => setImagesDoc(document)} disabled={!document.images?.length} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FiImage className="h-3.5 w-3.5" />Images</button><button type="button" onClick={() => handleApproveDocument(document)} disabled={isUpdatingStatus || isActive || document.status === 'Approved'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{isUpdatingStatus && isActive ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiCheckCircle className="h-3.5 w-3.5" />}Approve</button><button type="button" onClick={() => handleClearDocument(document)} disabled={isClearing || isActive || document.status === 'Missing'} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60">{isClearing && isActive ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiTrash2 className="h-3.5 w-3.5" />}Clear</button></div></td></tr> })}{!documents.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No document checklist found for this listing.</td></tr> : null}</tbody></table></div></div>
      {uploadDoc ? <UploadDocumentModal document={uploadDoc} isSaving={isUploading} onClose={() => setUploadDoc(null)} onSave={handleUploadSave} /> : null}
      {imagesDoc ? <DocumentImagesModal document={imagesDoc} onClose={() => setImagesDoc(null)} /> : null}
    </section>
  )
}

export default Documents
