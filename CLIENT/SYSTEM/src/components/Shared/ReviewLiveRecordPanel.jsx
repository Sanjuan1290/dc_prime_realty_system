import {FiAlertTriangle} from 'react-icons/fi'

// The source page owns its full record layout. This component only reports a
// missing/mismatched target; it never covers that page with a duplicate form.
export default function ReviewLiveRecordPanel({record,error='',loading=false,onBackToReview}) {
 if(loading)return <p role="status" className="text-sm text-slate-500">Loading record…</p>
 if(!error&&record&&typeof record==='object'&&!Array.isArray(record))return null
 return <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="flex items-start gap-2"><FiAlertTriangle className="mt-0.5 shrink-0"/>{error||'The exact record is unavailable. Saved review history remains available.'}</p><button type="button" onClick={onBackToReview} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Back to Review</button></section>
}
