import { useState } from 'react'
import { FiAlertTriangle, FiExternalLink, FiFileText, FiLoader, FiLock } from 'react-icons/fi'
import { fetchProtectedObjectUrl, openProtectedObjectUrl } from '../../utils/protectedFile'

// Access is checked again on the server. The signed-copy ID must be present
// in the saved review snapshot and match the original payment/project.
export default function ReviewSignedReceiptFile({ reviewId, before = {}, after = {} }) {
  const [working,setWorking] = useState(false)
  const [error,setError] = useState('')
  const file=after?.signedCopy || before?.signedCopy || null
  const id=Number(file?.signedCopyId || 0)
  const viewFile=async()=>{
    if (!Number.isSafeInteger(id) || id<1) return
    setError(''); setWorking(true)
    try {
      const uri=await fetchProtectedObjectUrl(`/workflow/reviews/${encodeURIComponent(reviewId)}/signed-receipts/${encodeURIComponent(id)}/content`)
      if (!openProtectedObjectUrl(uri)) setError('Allow pop-ups to open this protected receipt.')
    } catch (error) { setError(error?.message || 'This receipt cannot be opened.') }
    finally { setWorking(false) }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2"><FiFileText className="text-blue-700"/><h3 className="font-black text-slate-900">Signed Receipt</h3></div>
    {!file || !id ? <p className="mt-2 text-sm text-slate-600">No receipt file was saved with this review.</p> : <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
      <div><p className="break-all text-sm font-bold">{file.fileName || 'Signed Receipt'}</p><p className="text-xs text-slate-500">Version {file.fileVersion || '—'} · {file.fileStatus || 'Recorded'}</p></div>
      <button type="button" onClick={viewFile} disabled={working} className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{working?<FiLoader className="animate-spin"/>:<FiExternalLink/>} View Secure File</button>
    </div>}
    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><FiLock/> Available only while active and approved by the file security scan.</p>
    {error?<p role="alert" className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-800"><FiAlertTriangle/>{error}</p>:null}
  </section>
}

