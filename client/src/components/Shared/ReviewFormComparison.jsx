import { useState } from 'react'
import { FiAlertCircle, FiColumns, FiList, FiLock } from 'react-icons/fi'
import {
  formatSnapshotValue, humanizeKey, isPlainObject, parseSnapshotValue, sameValue,
} from '../../utils/reviewSnapshotFormat'
import ReviewSnapshotDiff from './ReviewSnapshotDiff'
import { getSavedReviewRevisions } from '../../utils/reviewRevisionHistory'

// Form groups are display-only. Never hydrate historical fields from live database.
export const REVIEW_FORM_TEMPLATES = Object.freeze({
  accredited_seller: { title: 'Seller Details', sections: [
    ['Seller Information', ['name','fullName','firstName','lastName','role','status','accreditationDate']],
    ['Network Assignment', ['groupId','sellerGroupId','groupName','networkName','reportsUnderUserId','reportsUnderName','managerName','headUserId']],
  ] },
  seller_group: { title: 'Network Details', sections: [
    ['Network Information', ['name','networkName','groupType','status','description','headUserId']],
    ['Broker Information', ['broker','broker_name','broker_license_number','realty_name','broker_prc_number']],
  ] },
  seller_group_project_rates: { title: 'Project Commission Rates', sections: [
    ['Network & Project', ['groupId','projectId','name','networkName','status']],
    ['Rates', ['poolRate','companyProfitRate','divisionManagerRate','salesDirectorRate','unitManagerRate','salesAgentRate','rates']],
  ] },
  lot_project_listing: { title: 'Listing Details', sections: [
    ['Unit Information', ['unitCode','unitId','listingId','lotType','lotAreaSqm','status','soldSubstatus']],
    ['Prices & Charges', ['netSellingPrice','cashPricePerSqm','installmentPricePerSqm','reservationFee','legalMiscRate','legalMiscAmount','annualInterestRate']],
    ['Requirements', ['cadastralLots','documentRequirements']],
  ] },
  lot_project_client_profile: { title: 'Buyer Details', sections: [
    ['Buyer Information', ['buyerType','buyerName','buyerFullName','firstName','lastName','buyer_first_name','buyer_last_name','buyer_email','buyer_contact_number']],
    ['Address & Employment', ['buyer_present_address','buyer_permanent_address','buyer_employment_status','buyer_monthly_income']],
    ['Seller Assignment', ['assignedSellerId','assignedAccreditedSellerId','sellerName','saleChannel']],
  ] },
  lot_project_payment: { title: 'Payment Details', sections: [
    ['Payment Information', ['paymentType','paymentMethod','paymentDate','amount','paymentAmount','referenceId','paymentStatus']],
    ['Buyer Account', ['listingId','accountId','paymentId','buyerName']],
  ] },
  lot_project_reservation: { title: 'Reservation Details', sections: [
    ['Reservation', ['unitCode','listingId','accountId','reservationDate','reservationFee','status']],
    ['Buyer & Seller', ['buyerName','assignedSellerId','sellerName','saleChannel']],
  ] },
  lot_project_commission: { title: 'Commission Details', sections: [
    ['Seller', ['sellerName','commissionRole','sellerDisplayName']],
    ['Commission', ['commissionRate','commissionBaseAmount','grossCommissionAmount','releasedCommissionAmount','commissionStatus']],
  ] },
  lot_project_settings: { title: 'Project Settings', sections: [
    ['General Settings', ['name','status','reservationFee','annualInterestRate','legalMiscRate']],
  ] },
})

const neverShow = (key, hide) => hide?.(key) || /password|passcode|token|secret|otp|authorization|cookie|private.key|verification.code|_normalized|Normalized/i.test(key)
const asObj = (value) => { const parsed = parseSnapshotValue(value); return isPlainObject(parsed) ? parsed : {} }

const entryValue = (obj, key) => Object.hasOwn(obj, key) ? obj[key] : undefined
const displayValue = (key, value, opts) => {
  if (value === undefined) return 'Not Recorded'
  if (value === null || value === '') return 'Not Set'
  return formatSnapshotValue(key, value, opts)
}

const HistoricalField = ({ field, side, changed, opts, before, after, hide }) => {
  const value = side === 'before' ? before : after
  if (isPlainObject(value)) {
    return <div className="col-span-full rounded-xl border border-slate-200 p-3">
      <p className="mb-3 text-xs font-bold text-slate-600">{field.label}</p>
      <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(value).filter(([key]) => !neverShow(key, hide)).map(([key, item]) =>
        <div key={key} className="min-w-0"><dt className="text-xs text-slate-500">{opts.labelFor(key)}</dt><dd className="break-words text-sm font-semibold">{displayValue(key,item,opts)}</dd></div>)}</dl>
    </div>
  }
  if (Array.isArray(value) && value.some(isPlainObject)) {
    return <div className="col-span-full rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-bold text-slate-600">{field.label} ({value.length})</p>
      <div className="max-h-64 space-y-2 overflow-y-auto">{value.map((item,index) => <div key={index} className="rounded-lg bg-slate-50 p-2"><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(item).filter(([key])=>!neverShow(key,hide)).map(([key,v]) => <div key={key}><dt className="text-xs text-slate-500">{opts.labelFor(key)}</dt><dd className="break-words text-xs font-semibold">{displayValue(key,v,opts)}</dd></div>)}</dl></div>)}</div>
    </div>
  }
  return <div className="min-w-0">
    <dt className="mb-1 text-xs font-semibold text-slate-600">{field.label}</dt>
    <dd className={`min-h-10 break-words rounded-lg border px-3 py-2 text-sm ${changed ? 'border-amber-300 bg-amber-50 font-bold text-slate-900' : 'border-slate-200 bg-slate-50 font-semibold text-slate-800'}`}>
      {displayValue(field.key, value, opts)}
    </dd>
  </div>
}

export const buildReviewFormSections = ({ before, after, entityType, labels = {}, isHiddenField }) => {
  const template = REVIEW_FORM_TEMPLATES[entityType] || { title: 'Record Details', sections: [] }
  const availableKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key)=>!neverShow(key,isHiddenField))
  const used = new Set()
  const sections = template.sections.map(([name, fields])=>({
    name,
    fields: fields.filter(key=>availableKeys.includes(key)).map(key=>{ used.add(key); return {key,label:labels[key]||humanizeKey(key)} }),
  })).filter(group=>group.fields.length)
  const remaining = availableKeys.filter(key=>!used.has(key)).map(key=>({key,label:labels[key]||humanizeKey(key)}))
  if (remaining.length) sections.push({name:template.sections.length ? 'Other Saved Details' : 'Record Details',fields:remaining})
  return {title:template.title,sections}
}

const ReviewFormComparison = ({ beforeValue, afterValue, events = [], revision = 1, entityType, lookups = {}, labels = {}, isHiddenField, fieldOrder = [], listRenderers = {} }) => {
  const [mode,setMode] = useState('changes')
  const [mobileSide,setMobileSide] = useState('after')
  const [highlight,setHighlight] = useState(true)
  const [selectedRevision,setSelectedRevision] = useState('latest')
  const revisionOptions = getSavedReviewRevisions({before:beforeValue,after:afterValue,events,latestRevision:revision})
  const chosen = selectedRevision === 'latest' ? revisionOptions[0] : revisionOptions.find(item=>item.revision===Number(selectedRevision)) || revisionOptions[0]
  const selectedBefore = chosen?.before
  const selectedAfter = chosen?.after
  const before = asObj(selectedBefore)
  const after = asObj(selectedAfter)
  const hasBefore = selectedBefore != null && selectedBefore !== ''
  const hasAfter = selectedAfter != null && selectedAfter !== ''
  const {title,sections} = buildReviewFormSections({before,after,entityType,labels,isHiddenField})
  const opts = {lookups,labelFor:(key)=>labels[key]||humanizeKey(key),isHidden:(key)=>neverShow(key,isHiddenField)}
  const count = sections.reduce((sum,section)=>sum + section.fields.filter(field=>!sameValue(entryValue(before,field.key),entryValue(after,field.key))).length,0)
  const renderSide = (side) => <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
    <h4 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-black text-slate-900">{side==='before'?'Before':'After'} <span className="ml-auto text-xs font-semibold text-slate-500">Read Only</span></h4>
    {side==='before'&&!hasBefore ? <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">No previous values were saved with this review</p> : side==='after'&&!hasAfter ? <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">No after-values were saved with this review</p> : sections.length ? sections.map(section=><section key={section.name} className="space-y-3">
      <h5 className="text-xs font-black uppercase tracking-wide text-slate-500">{section.name}</h5>
      <dl className="grid gap-3 sm:grid-cols-2">{section.fields.map(field=><HistoricalField key={field.key} field={field} side={side} changed={highlight&&!sameValue(entryValue(before,field.key),entryValue(after,field.key))} before={entryValue(before,field.key)} after={entryValue(after,field.key)} opts={opts} hide={isHiddenField}/>)}</dl>
    </section>) : <p className="text-sm text-slate-500">No form values were saved with this review.</p>}
  </div>
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Before and After">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h3 className="text-base font-black text-slate-900">Before &amp; After</h3><p className="text-xs font-semibold text-slate-500">{title} · {count} changed {count===1?'field':'fields'}</p></div>
      <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><FiLock/> Saved history</span>
    </div>
    <div className="space-y-4 p-4">
      {revisionOptions.length > 1 ? <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Saved Version
        <select value={selectedRevision} onChange={(event)=>setSelectedRevision(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold">
          <option value="latest">Latest Saved Version</option>
          {revisionOptions.slice(1).map(item=><option key={item.revision} value={item.revision}>Version {item.revision}</option>)}
        </select></label> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={()=>setMode('forms')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode==='forms'?'bg-white text-blue-700 shadow-sm':'text-slate-600'}`}><FiColumns className="mr-1 inline"/> All Saved Details</button>
          <button type="button" onClick={()=>setMode('changes')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode==='changes'?'bg-white text-blue-700 shadow-sm':'text-slate-600'}`}><FiList className="mr-1 inline"/> Changed Fields Only</button>
        </div>
        {mode==='forms' ? <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={highlight} onChange={(event)=>setHighlight(event.target.checked)}/> Highlight Changes</label> : null}
      </div>
      {mode==='changes' ? <ReviewSnapshotDiff beforeValue={selectedBefore} afterValue={selectedAfter} lookups={lookups} labels={labels} isHiddenField={isHiddenField} fieldOrder={fieldOrder} listRenderers={listRenderers} mode="changes"/> : <>
        <div className="flex gap-2 sm:hidden" aria-label="Choose comparison side">
          {['before','after'].map(side=><button key={side} type="button" onClick={()=>setMobileSide(side)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${mobileSide===side?'border-blue-400 bg-blue-50 text-blue-700':'border-slate-200 text-slate-700'}`}>{side==='before'?'Before':'After'}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2"><div className={mobileSide==='after'?'hidden sm:block':'block'}>{renderSide('before')}</div><div className={mobileSide==='before'?'hidden sm:block':'block'}>{renderSide('after')}</div></div>
      </>}
      {sections.some(group=>group.fields.some(field=>entryValue(before,field.key)===undefined || entryValue(after,field.key)===undefined)) ? <p className="flex items-center gap-2 text-xs font-semibold text-amber-800"><FiAlertCircle/> Some fields were not recorded in an older review. They have not been filled in from live data.</p> : null}
    </div>
  </section>
}

export default ReviewFormComparison

