import { FiAlertTriangle, FiArrowLeft, FiEye, FiLock, FiX } from 'react-icons/fi'

// Read-only representation of the current form, not a correction form. The
// parent must supply a record fetched through its ordinary authorized endpoint.
const FIELDS = {
  accredited_seller: [['Seller', [['display_name','Seller Name'],['role','Position'],['user_status','Account Status'],['accredited_seller_status','Seller Status']]],['Network Assignment', [['reports_under_name','Reports Under'],['seller_group_name','Network']]]],
  seller_group: [['Network Information', [['name','Network Name'],['type','Network Type'],['status','Network Status'],['description','Description']]], ['Broker Details', [['broker_name','Broker Name'],['realty_name','Realty Name'],['broker_license_number','Broker License Number']]]],
  seller_group_project_rates: [['Network & Project', [['name','Network Name'],['type','Network Type'],['status','Status']]],['Project Rates', [['poolRate','Pool Rate'],['companyProfitRate','Company Profit']]]],
  lot_project_listing: [['Listing Information', [['unitCode','Unit Code'],['unit_id','Unit Code'],['lotType','Lot Type'],['lotAreaSqm','Lot Area (sqm)'],['status','Status']]], ['Pricing', [['netSellingPrice','Net Selling Price'],['reservationFee','Reservation Fee'],['legalMiscRate','Legal / Misc Rate']]]],
  lot_project_client_profile: [['Buyer Details', [['buyer_full_name','Buyer Name'],['buyerName','Buyer Name'],['fullName','Buyer Name'],['buyer_email','Email'],['email','Email'],['buyer_contact_number','Contact Number'],['contactNo','Contact Number'],['buyer_present_address','Address'],['presentAddress','Address'],['buyerType','Buyer Type'],['birthDate','Date of Birth'],['civilStatus','Civil Status'],['occupationPositionTitle','Occupation'],['monthlyIncome','Monthly Income']]],['Seller Assignment', [['assigned_accredited_seller_id','Assigned Seller ID'],['sale_channel','Sale Type']]]],
  lot_project_reservation: [['Reservation Details', [['account_reference','Account Reference'],['account_status','Account Status'],['buyer_name_snapshot','Buyer'],['reservation_date','Reservation Date']]]],
  lot_project_cancellation: [['Cancellation Details', [['account_reference','Account Reference'],['account_status','Account Status'],['cancellation_reason','Reason'],['refund_amount','Refund Amount']]]],
  lot_project_account: [['Reservation Details', [['account_reference','Account Reference'],['account_status','Account Status'],['buyer_name_snapshot','Buyer'],['reservation_date','Reservation Date']]]],
  lot_project_commission_account: [['Reservation Details', [['account_reference','Account Reference'],['account_status','Account Status'],['buyer_name_snapshot','Buyer']]]],
  lot_project_payment: [['Payment Details', [['paymentType','Payment Type'],['lot_project_payment_type','Payment Type'],['method','Payment Method'],['amount','Amount'],['lot_project_payment_amount','Amount'],['paymentDate','Payment Date'],['lot_project_payment_date','Payment Date'],['referenceId','Reference Number'],['lot_project_payment_reference_id','Reference Number'],['status','Payment Status']]]],
  lot_project_signed_receipt: [['Receipt Reference', [['paymentType','Payment Type'],['amount','Payment Amount'],['referenceId','Payment Reference']]]],
  lot_project_payment_proof: [['Payment Details', [['paymentType','Payment Type'],['amount','Amount'],['referenceId','Reference Number']]]],
  lot_project_settings: [['Project Settings', [['reservationFee','Reservation Fee'],['reservationContactName','Reservation Contact'],['reservationContactEmail','Contact Email'],['companyName','Company Name'],['companyEmail','Company Email'],['releaseDayOne','First Release Day'],['releaseDayTwo','Second Release Day']]]],
  lot_project_penalty_schedule: [['Payment Schedule', [['description','Description'],['due_date','Due Date'],['penalty_amount','Penalty'],['schedule_status','Status']]]],
  lot_project_lmf_schedule: [['Payment Schedule', [['description','Description'],['due_date','Due Date'],['due_amount','Amount'],['schedule_status','Status']]]],
}

const titleFor = (entityType) => ({
  accredited_seller:'Seller Details',seller_group:'Network Details',seller_group_project_rates:'Network Rates',
  lot_project_listing:'Listing Details',lot_project_client_profile:'Buyer Details',lot_project_account:'Reservation Details',lot_project_reservation:'Reservation Details',lot_project_cancellation:'Cancellation Details',lot_project_signed_receipt:'Signed Receipt',
  lot_project_commission_account:'Reservation Details',lot_project_payment:'Payment Details',lot_project_payment_proof:'Payment Proof',
  lot_project_penalty_schedule:'Payment Schedule',lot_project_lmf_schedule:'Payment Schedule',
})[entityType] || 'Record Details'

const showValue = (value) => {
  if (value == null || value === '') return 'Not Set'
  if (typeof value === 'boolean') return value ? 'Yes':'No'
  if (typeof value === 'number') return value.toLocaleString('en-PH')
  if (typeof value === 'object') return 'View in original record'
  return String(value).replace(/_/g,' ')
}

export default function ReviewLiveRecordPanel({ entityType, record, reviewId, onDismiss, onBackToReview, error = '', loading = false }) {
  const sections = FIELDS[entityType] || []
  const isFound = record && typeof record === 'object'
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={titleFor(entityType)}>
    <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b p-4">
        <FiEye className="text-xl text-blue-600"/>
        <div className="flex-1"><h2 className="text-base font-black text-slate-900">{titleFor(entityType)}</h2><p className="flex items-center gap-1 text-xs font-semibold text-slate-500"><FiLock/> Current Record · View Only</p></div>
        <button type="button" onClick={onDismiss} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Close record details"><FiX/></button>
      </header>
      <div className="overflow-y-auto p-4">
        {loading ? <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading record...</p> : error || !isFound ? <div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><FiAlertTriangle className="shrink-0"/>{error || 'The exact record could not be loaded. Its saved review is still available.'}</div> :
        <div className="space-y-5">{sections.map(([sectionName,fields])=>{
          const visible=fields.filter(([key,label],index)=>Object.prototype.hasOwnProperty.call(record,key) && !fields.slice(0,index).some(([prior,priorLabel])=>priorLabel===label && Object.prototype.hasOwnProperty.call(record,prior)))
          return visible.length ? <section key={sectionName}><h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{sectionName}</h3><dl className="grid gap-3 sm:grid-cols-2">{visible.map(([key,label])=><div key={key}><dt className="mb-1 text-xs font-semibold text-slate-600">{label}</dt><dd className="min-h-10 break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{showValue(record[key])}</dd></div>)}</dl></section>:null
        })}{!sections.some(([_,fields])=>fields.some(([key])=>Object.prototype.hasOwnProperty.call(record,key)))?<p className="text-sm text-slate-600">The current details are not available in this view. Use the saved Before &amp; After information in Review Center.</p>:null}</div>}
      </div>
      <footer className="flex justify-end border-t bg-slate-50 p-4"><button type="button" onClick={onBackToReview} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><FiArrowLeft/> Back to Review</button></footer>
    </div>
  </div>
}

