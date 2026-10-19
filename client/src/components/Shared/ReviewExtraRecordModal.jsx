import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiArrowLeft, FiEye, FiFileText, FiLock } from 'react-icons/fi'
import { useFetch } from '../../utils/useFetch'

const LABELS = {
  id:'Record Number', projectId:'Project', listingId:'Unit', accountId:'Buyer Account',
  buyerName:'Buyer Name', email:'Email', contactNo:'Phone Number', buyerType:'Buyer Type',
  status:'Status', submittedAt:'Submitted On', reviewedAt:'Reviewed On', rejectionReason:'Reason',
  reference:'Import Reference', filename:'File Name', totalRows:'Total Rows', importedRows:'Imported',
  removedRows:'Removed', importedAt:'Imported On', stage:'Release Stage', percent:'Release Percent',
  amount:'Amount', releaseDate:'Released On', payee:'Paid To', paymentMethod:'Payment Method',
  paymentReference:'Payment Reference', network:'Network', networkId:'Network', memberCount:'Members Imported',
  firstName:'First Name', middleName:'Middle Name', lastName:'Last Name', buyerName:'Buyer Name',
  presentAddress:'Present Address', permanentAddress:'Permanent Address', birthDate:'Date of Birth',
  birthPlace:'Place of Birth', civilStatus:'Civil Status', nationality:'Nationality',
  occupationPositionTitle:'Occupation', monthlyIncome:'Monthly Income', spouse:'Spouse', coBuyers:'Co-buyers',
}
const safeKey = (key) => !/password|secret|token|cookie|authorization|accountnumber|tinno|private|otp|passcode|signature/i.test(key)
const pretty = (key) => LABELS[key] || key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./, s=>s.toUpperCase())
const value = (v) => {
  if (v === null || v === undefined || v === '') return 'Not Set'
  if (typeof v === 'boolean') return v ? 'Yes':'No'
  if (typeof v === 'number') return v.toLocaleString('en-PH')
  if (typeof v === 'object') return null
  return String(v).replace(/_/g,' ')
}
const Fields = ({ fields = {} }) => <dl className="grid gap-3 sm:grid-cols-2">
  {Object.entries(fields).filter(([key])=>safeKey(key)).map(([key,v])=>typeof v === 'object' && v!==null ?
    <div key={key} className="sm:col-span-2 rounded-xl border p-3"><dt className="mb-2 text-xs font-black text-slate-500">{pretty(key)}</dt>{Array.isArray(v) ? <div className="space-y-2">{v.slice(0,30).map((item,i)=><div key={i} className="rounded-lg bg-slate-50 p-2">{typeof item === 'object' ? <Fields fields={item} /> : <span className="text-sm">{value(item)}</span>}</div>)}{v.length>30?<p className="text-xs text-amber-700">Only the first 30 entries are shown.</p>:null}</div>:<Fields fields={v}/>}</div>
    : <div key={key}><dt className="mb-1 text-xs font-semibold text-slate-600">{pretty(key)}</dt><dd className="min-h-10 break-words rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900">{value(v)}</dd></div>)}
</dl>

export default function ReviewExtraRecordModal({ reviewId, onClose }) {
  const [page,setPage] = useState(1)
  const query = useQuery({
    queryKey:['review-extra-record',reviewId,page],
    queryFn:()=>useFetch(`/workflow/reviews/${encodeURIComponent(reviewId)}/record-preview?page=${page}`),
    retry:false,
  })
  const item=query.data?.data
  return <div role="dialog" aria-modal="true" aria-label="Review Record" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b p-4"><FiEye className="text-blue-600"/><div className="flex-1"><h2 className="font-black text-slate-900">{item?.title || 'View Record'}</h2><p className="flex items-center gap-1 text-xs text-slate-500"><FiLock/> Current Record · View Only</p></div><button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100" onClick={onClose} aria-label="Close"><FiArrowLeft/></button></header>
      <div className="space-y-4 overflow-y-auto p-4">
        {query.isLoading?<p role="status" className="p-4 text-sm">Loading record...</p>: query.isError || !item?.available ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-start gap-2"><FiAlertTriangle className="mt-0.5 shrink-0"/><div><p className="font-bold">{query.isError ? 'Could not load the current record' : 'Current record unavailable'}</p><p className="mt-1">{query.isError ? 'The saved review is still available. Try loading this record again.' : item?.message || 'The saved review is still available.'}</p></div></div>{query.isError ? <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold disabled:opacity-50">{query.isFetching ? 'Trying again...' : 'Try Again'}</button> : null}</div>:<>
          <section><h3 className="mb-3 text-sm font-black text-slate-900">Record Details</h3><Fields fields={item.fields}/></section>
          {item.form && Object.keys(item.form).length > 0 ? <section className="border-t pt-4"><h3 className="mb-3 text-sm font-black">Submitted Information</h3><Fields fields={item.form}/></section>:null}
          {item.entries ? <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-black">{item.type === 'network_member_import'?'Imported Sellers':'Imported Units'}</h3><div className="space-y-2">{item.entries.rows.length ? item.entries.rows.map((row)=><div key={row.row} className="rounded-lg border p-3"><Fields fields={row}/></div>) : <p className="text-sm text-slate-500">No matching entries.</p>}</div><div className="flex items-center justify-between"><button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={page<=1 || query.isFetching} onClick={()=>setPage(p=>p-1)}>Previous</button><span className="text-xs text-slate-600">Page {page}</span><button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={!item.entries.hasMore || query.isFetching} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>:null}
          <p className="flex items-center gap-2 text-xs text-slate-500"><FiFileText/> Current record details. For historical values, use Before &amp; After in Review Center.</p>
        </>}
      </div>
      <footer className="border-t bg-slate-50 p-4 text-right"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><FiArrowLeft/> Back to Review</button></footer>
    </div>
  </div>
}

