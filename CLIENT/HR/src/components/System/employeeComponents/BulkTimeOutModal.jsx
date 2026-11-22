import {useRef,useState} from 'react'
import {FiClock,FiX} from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import {useFetchPost} from '../../../utils/useFetch'
import useModalFocus from '../../../utils/useModalFocus'
import {formatPhilippineCalendarDate} from '../../../utils/formatDateTime'

const clock=value=>{
  if(!value)return '—'
  const [hour,minute]=String(value).split(':').map(Number)
  return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`
}
const duration=seconds=>{
  const minutes=Math.round(Math.abs(seconds||0)/60),hours=Math.floor(minutes/60),rest=minutes%60
  return `${seconds<0?'−':''}${hours?`${hours}h`:''}${hours&&rest?' ':''}${rest||!hours?`${rest}m`:''}`
}
const inputClass='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-50'

export default function BulkTimeOutModal({date,records,onClose,onSaved}){
  const [timeOut,setTimeOut]=useState(''),[reason,setReason]=useState(''),[review,setReview]=useState(null)
  const [busy,setBusy]=useState(''),[error,setError]=useState('')
  const working=useRef(false),dialog=useModalFocus(onClose,{busy:Boolean(busy)})
  const payload=()=>({attendance_date:date,attendance_ids:records.map(record=>record.employee_attendance_id),actual_time_out:timeOut,reason})
  const edit=setter=>event=>{setter(event.target.value);setReview(null);setError('')}
  const preview=async event=>{
    event.preventDefault()
    if(working.current)return
    working.current=true;setBusy('preview');setError('');setReview(null)
    try{
      const result=await useFetchPost('/attendance/bulk-time-out/preview',payload(),{confirmationHandled:'technical',timeoutMs:120000})
      setReview(result.data)
    }catch(failure){setError(failure.message||'Unable to preview this adjustment.')}
    finally{working.current=false;setBusy('')}
  }
  const save=async()=>{
    if(working.current||!review)return
    working.current=true;setBusy('save');setError('')
    try{
      const result=await useFetchPost('/attendance/bulk-time-out',{...payload(),review_token:review.review_token},{confirmationHandled:'bulk-time-out',timeoutMs:120000})
      onSaved(result.message);onClose()
    }catch(failure){setError(failure.message||'Unable to save this adjustment.');setReview(null)}
    finally{working.current=false;setBusy('')}
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="bulk-time-out-title" tabIndex={-1} className="my-auto flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div className="flex gap-3"><FiClock className="mt-1 shrink-0 text-blue-700" aria-hidden="true"/><div>
          <h2 id="bulk-time-out-title" className="text-lg font-black text-slate-950">Bulk Time Out Adjustment</h2>
          <p className="mt-1 text-sm text-slate-600">{formatPhilippineCalendarDate(date,{style:'long'})} · {records.length} selected employee(s)</p>
        </div></div>
        <button data-dialog-close type="button" aria-label="Close bulk adjustment" onClick={onClose} disabled={Boolean(busy)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><FiX/></button>
      </header>
      <form onSubmit={preview} className="min-h-0 overflow-y-auto p-5">
        <p className="mb-4 text-sm text-slate-600">Set one shared Time Out for the selected employees. Original Time In values are preserved.</p>
        <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)]">
          <label className="grid content-start gap-2 text-sm font-bold">New Time Out for all selected<input type="time" required step="60" value={timeOut} onChange={edit(setTimeOut)} disabled={Boolean(busy)} className={inputClass}/></label>
          <label className="grid gap-2 text-sm font-bold">Adjustment reason<textarea required rows={2} maxLength={1000} value={reason} onChange={edit(setReason)} disabled={Boolean(busy)} placeholder="Example: Authorized overtime" className={inputClass}/></label>
        </div>
        <p className="mt-3 text-xs text-slate-500">For overnight shifts, an earlier Time Out clock time means the next day. The existing 16-hour shift limit applies.</p>
        {error&&<StatusAlert type="error" message={error} className="mt-4"/>}
        {!review&&<div className="mt-4 rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-bold">Selected employees</h3><ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">{records.map(record=><li key={record.employee_attendance_id}>{record.full_name} · {record.employee_code}</li>)}</ul></div>}
        {review&&<section aria-label="Bulk adjustment preview" className="mt-5 space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <h3 className="font-black">Review {review.changed_count} adjustment(s)</h3>
            <p className="mt-1">New Time Out: <strong>{clock(review.actual_time_out)}</strong>. Automatic Time Out stays at <strong>{clock(review.automatic_time_out)}</strong>.</p>
            <p className="mt-1">{review.draft_payroll_count} existing payroll draft(s) will be recalculated. Finalized and released payroll records stay unchanged.</p>
            {review.unchanged_count>0&&<p className="mt-1">{review.unchanged_count} selected record(s) already match and will be left unchanged.</p>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Employee','Original Time In','Original Time Out','New Time Out','Worked hours','Overtime','Additional time'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{review.employees.map(employee=><tr key={employee.attendance_id}>
              <td className="px-3 py-3"><p className="font-bold">{employee.employee_name}</p><p className="text-xs text-slate-500">{employee.employee_code}</p></td>
              <td className="whitespace-nowrap px-3 py-3">{clock(employee.time_in)}</td>
              <td className="whitespace-nowrap px-3 py-3">{clock(employee.original_time_out)}{employee.original_time_out_source==='automatic'&&<p className="text-xs text-amber-700">Automatic</p>}</td>
              <td className="whitespace-nowrap px-3 py-3 font-bold text-blue-700">{clock(employee.new_time_out)}{employee.new_time_out<employee.time_in&&<p className="text-xs font-normal">Next day</p>}</td>
              <td className="whitespace-nowrap px-3 py-3">{duration(employee.before.totalWorkedSeconds)} → <strong>{duration(employee.after.totalWorkedSeconds)}</strong></td>
              <td className="whitespace-nowrap px-3 py-3">{duration(employee.before.overtimeSeconds)} → <strong>{duration(employee.after.overtimeSeconds)}</strong>
                {employee.after.restDayOvertimeSeconds>0&&<p className="text-xs text-slate-500">Rest-day work: {duration(employee.after.restDayOvertimeSeconds)}</p>}
                {(employee.after.regularHolidaySeconds+employee.after.specialHolidaySeconds+employee.after.doublePaySeconds)>0&&<p className="text-xs text-slate-500">Holiday hours use existing payroll rules.</p>}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-bold">{employee.changed?`${employee.additional_work_seconds>0?'+':''}${duration(employee.additional_work_seconds)}`:'Already matches'}</td>
            </tr>)}</tbody>
          </table></div>
        </section>}
        <footer className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Cancel</button>
          {review?<button type="button" onClick={save} disabled={Boolean(busy)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy==='save'?'Saving adjustments…':'Confirm and save'}</button>
            :<button type="submit" disabled={Boolean(busy)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy==='preview'?'Preparing preview…':'Preview adjustment'}</button>}
        </footer>
      </form>
    </section>
  </div>
}
