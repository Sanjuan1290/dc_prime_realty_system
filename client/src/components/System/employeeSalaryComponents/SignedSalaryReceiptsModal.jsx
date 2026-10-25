import { useEffect, useRef, useState } from 'react'
import { FiFileText, FiShield, FiUploadCloud, FiX, FiExternalLink, FiArchive, FiRefreshCw } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { appendCloudinarySecurityFields } from '../../../utils/cloudinaryUploadSecurity'
import { fetchProtectedObjectUrl, openProtectedObjectUrl } from '../../../utils/protectedFile'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const accept = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 15 * 1024 * 1024

const SignedSalaryReceiptsModal = ({ payrollId, employeeName = '', canUpload = false, onClose }) => {
  const [files, setFiles] = useState([])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const fileRef = useRef(null)
  const basePath = `/employee-payroll/payrolls/${payrollId}/signed-receipts`
  const load = async () => {
    try {
      const result = await useFetch(basePath)
      setFiles(result?.data?.files || [])
    } catch (error) { setNotice({ type:'error', message:error.message || 'Unable to load signed receipts.' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (payrollId) load() }, [payrollId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (!file || busy) return
    if (!accept.includes(file.type) || file.size <= 0 || file.size > MAX_BYTES) {
      setNotice({ type:'error', message:'Choose a PDF, JPG or PNG file (maximum 15 MB).' }); return
    }
    setBusy(true)
    setNotice({ type:'loading', message:'Uploading protected receipt and starting security scan…' })
    try {
      const signatureResponse = await useFetchPost(`${basePath}/upload-signature`, { fileName:file.name, fileType:file.type, fileSize:file.size }, { confirmationHandled:'compact' })
      const signed = signatureResponse?.data || {}
      if (!signed.uploadUrl || !signed.signature || !signed.apiKey) throw new Error('Secure file upload is not available.')
      const form = new FormData()
      form.append('file',file)
      form.append('api_key',signed.apiKey)
      form.append('timestamp',String(signed.timestamp))
      form.append('signature',signed.signature)
      form.append('public_id',signed.publicId)
      form.append('asset_folder',signed.folder)
      form.append('type',signed.type || 'authenticated')
      form.append('tags',signed.tags)
      form.append('context',signed.context)
      appendCloudinarySecurityFields(form,signed)
      const cloud = await fetch(signed.uploadUrl,{method:'POST',body:form})
      const result = await cloud.json().catch(()=>({}))
      if(!cloud.ok) throw new Error(result?.error?.message || 'The Cloudinary upload failed.')
      await useFetchPost(basePath, { file:{
        fileName:file.name, fileType:file.type, fileSize:Number(result?.bytes || file.size),
        cloudinaryPublicId:result?.public_id, cloudinaryResourceType:result?.resource_type || 'image',
      } },{ confirmationHandled:'compact' })
      setFile(null)
      if(fileRef.current) fileRef.current.value=''
      setNotice({type:'success',message:'Receipt saved. It can be opened after the security scan is approved.'})
      await load()
    } catch(error) { setNotice({type:'error',message:error?.message || 'Unable to save signed receipt.'}) }
    finally {setBusy(false)}
  }
  const openFile = async (item) => {
    if (item.scanStatus !== 'approved') { setNotice({type:'warning',message:'This receipt is not available until its security scan is approved.'}); return }
    try {
      const url=await fetchProtectedObjectUrl(item.contentPath)
      if(!openProtectedObjectUrl(url)) throw new Error('Allow pop-ups and try again.')
    } catch(error) {setNotice({type:'error',message:error.message})}
  }
  const archive = async (item) => {
    if (busy || !window.confirm(`Archive ${item.name}? The audit history and stored file will be retained.`)) return
    setBusy(true)
    try {
      await useFetchPost(`${basePath}/${item.id}/archive`,{}, {confirmationHandled:'compact'})
      setNotice({type:'success',message:'Copy archived. You can upload a replacement.'})
      await load()
    } catch(error) {setNotice({type:'error',message:error.message})}
    finally {setBusy(false)}
  }
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="presentation" onMouseDown={(event)=>{if(!busy && event.target===event.currentTarget)onClose()}}>
    <section role="dialog" aria-modal="true" aria-label="Signed salary receipts" className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-950">Signed Salary Receipts</h2><p className="mt-1 text-sm text-slate-500">{employeeName} · Up to 5 signed copies per released salary</p></div><button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-slate-100"><FiX /></button></header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={()=>setNotice(null)} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><span>Signed receipts: <strong>{files.length} / 5</strong></span><button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold"><FiRefreshCw/>Refresh scan status</button></div>
        {loading ? <p className="text-sm text-slate-500">Loading receipts…</p> : null}
        {!loading && !files.length ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No signed receipts uploaded yet.</p> : null}
        <div className="space-y-2">{files.map(item=><div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"><FiFileText className="shrink-0 text-blue-700"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">Security scan: {item.scanStatus === 'approved' ? 'Approved' : item.scanStatus === 'pending' ? 'Scanning' : item.scanStatus === 'rejected' ? 'Blocked' : 'Unavailable'}</p></div><button type="button" onClick={()=>openFile(item)} disabled={item.scanStatus !== 'approved'} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"><FiExternalLink/>View</button>{canUpload ? <button type="button" onClick={()=>archive(item)} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"><FiArchive/>Archive</button> : null}</div>)}</div>
        {canUpload && files.length<5 ? <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><FiUploadCloud/>Upload signed receipt</h3><p className="mt-1 text-xs text-slate-500">PDF, JPG or PNG · Max 15 MB per file. Only scanned, protected copies can be opened.</p><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0] || null)} className="mt-3 block w-full text-sm" disabled={busy}/><button type="button" disabled={!file || busy} onClick={upload} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"><FiShield/>{busy?'Saving…':'Upload Signed Copy'}</button></div> : null}
        {files.length===5 ? <p className="text-sm text-slate-500">All five upload slots are used. Archive an incorrect receipt to replace it.</p> : null}
      </div>
      <footer className="border-t border-slate-200 p-4 text-right"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button></footer>
    </section>
  </div>
}
export default SignedSalaryReceiptsModal
