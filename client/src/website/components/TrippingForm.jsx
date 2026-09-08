import { useMemo, useState } from 'react'
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEdit3,
  FiFacebook,
  FiMail,
  FiSearch,
  FiUsers,
} from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { company } from '../data/company'
import { projects } from '../data/projects'
import { availabilityLegend, buildUpcomingDates, getProjectSchedule } from '../data/trippingAvailability'
import StatusBadge from './StatusBadge'
import rainySeasonSafety from '../assets/rainy-season-safety.png'

const STORAGE_KEY = 'dc_prime_tripping_requests_v2'

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
  : ''

const shortDate = (date) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date)
const dayLabel = (date) => new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(date)

const readSavedRequests = () => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const saveRequest = (request) => {
  const current = readSavedRequests().filter((item) => item.reference !== request.reference)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([request, ...current].slice(0, 20)))
}

const createReference = () => {
  const now = new Date()
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DCP-${datePart}-${random}`
}

const downloadCalendar = (request, project) => {
  const timeMap = {
    '9:00 AM': [9, 0],
    '10:30 AM': [10, 30],
    '1:00 PM': [13, 0],
    '2:30 PM': [14, 30],
    '4:00 PM': [16, 0],
  }
  const [hour, minute] = timeMap[request.time] || [9, 0]
  const start = new Date(`${request.date}T00:00:00`)
  start.setHours(hour, minute, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  const stamp = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//D&C Prime Realty//Tripping Request//EN',
    'BEGIN:VEVENT',
    `UID:${request.reference}@dcprimerealty`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:D&C Prime Realty Tripping Request - ${project?.name || 'Property Visit'}`,
    `DESCRIPTION:Request reference ${request.reference}. Schedule remains subject to confirmation by D&C Prime Realty.`,
    `LOCATION:${project?.location || company.address}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${request.reference}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const TrippingForm = ({ initialProject = '' }) => {
  const bookableProjects = projects.filter((project) => project.bookingEnabled)
  const safeInitialProject = bookableProjects.some((project) => project.slug === initialProject) ? initialProject : ''
  const [mode, setMode] = useState('book')
  const [step, setStep] = useState(safeInitialProject ? 2 : 1)
  const [form, setForm] = useState({
    project: safeInitialProject,
    date: '',
    time: '',
    visitors: '1',
    name: '',
    phone: '',
    email: '',
    source: '',
    message: '',
  })
  const [savedRequest, setSavedRequest] = useState(null)
  const [lookup, setLookup] = useState({ reference: '', phone: '' })
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupMessage, setLookupMessage] = useState('')

  const selectedProject = bookableProjects.find((project) => project.slug === form.project)
  const schedule = getProjectSchedule(form.project)
  const upcomingDates = useMemo(() => form.project ? buildUpcomingDates(form.project, 21) : [], [form.project])
  const selectedDateState = upcomingDates.find((item) => item.dateKey === form.date)?.status

  const update = (field) => (event) => {
    const value = event.target.value
    setSavedRequest(null)
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'project' ? { date: '', time: '' } : {}),
      ...(field === 'date' ? { time: '' } : {}),
    }))
  }

  const chooseDate = (item) => {
    if (['closed', 'full'].includes(item.status)) return
    setForm((current) => ({ ...current, date: item.dateKey, time: '' }))
  }

  const requestPayload = savedRequest || form
  const requestProject = bookableProjects.find((project) => project.slug === requestPayload.project)
  const emailSubject = encodeURIComponent(`Property tripping request — ${requestProject?.name || 'D&C Prime Realty'} — ${requestPayload.reference || ''}`)
  const emailBody = encodeURIComponent([
    'Hello D&C Prime Realty,',
    '',
    'I would like to request a property tripping schedule.',
    `Reference: ${requestPayload.reference || 'Not created yet'}`,
    `Name: ${requestPayload.name}`,
    `Mobile: ${requestPayload.phone}`,
    `Email: ${requestPayload.email}`,
    `Project: ${requestProject?.name || ''}`,
    `Preferred date: ${formatDate(requestPayload.date)}`,
    `Preferred time: ${requestPayload.time}`,
    `Visitors: ${requestPayload.visitors}`,
    `How I heard about D&C: ${requestPayload.source || 'Not specified'}`,
    `Message: ${requestPayload.message || 'None'}`,
    '',
    'Please confirm the final schedule and meeting point.',
  ].join('\n'))

  const createRequest = () => {
    const request = {
      ...form,
      reference: createReference(),
      status: 'Pending Confirmation',
      createdAt: new Date().toISOString(),
    }
    saveRequest(request)
    setSavedRequest(request)
    setStep(5)
  }

  const runLookup = (event) => {
    event.preventDefault()
    const reference = lookup.reference.trim().toUpperCase()
    const phone = lookup.phone.trim()
    const request = readSavedRequests().find((item) => (
      (!reference || String(item.reference || '').toUpperCase() === reference)
      && (!phone || String(item.phone || '').replace(/\s/g, '') === phone.replace(/\s/g, ''))
    ))
    if (!reference && !phone) {
      setLookupResult(null)
      setLookupMessage('Enter a request reference or mobile number.')
      return
    }
    setLookupResult(request || null)
    setLookupMessage(request ? '' : 'No request saved in this browser matched those details.')
  }

  const resetBooking = () => {
    setSavedRequest(null)
    setForm({ project: safeInitialProject, date: '', time: '', visitors: '1', name: '', phone: '', email: '', source: '', message: '' })
    setStep(safeInitialProject ? 2 : 1)
  }

  const steps = [
    ['Project', 1],
    ['Schedule', 2],
    ['Details', 3],
    ['Review', 4],
  ]

  return (
    <div id="book-tripping" className="rounded-[20px] border border-[#ded9ce] bg-white p-5 shadow-[0_12px_38px_rgba(44,36,20,0.07)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5ead0] text-[#806014]"><FiCalendar className="h-5 w-5" /></span>
          <div>
            <h3 className="text-[21px] text-[#1b1813]">Property Tripping Scheduler</h3>
            <p className="mt-1 text-[12px] leading-5 text-[#726d64]">Choose a project and preferred visit schedule. Wednesday and Thursday are closed for regular office/tripping schedules.</p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-[#ded9ce] bg-[#faf9f6] p-1 text-[11px] font-bold">
          <button type="button" onClick={() => setMode('book')} className={`rounded-lg px-3 py-2 ${mode === 'book' ? 'bg-[#17130a] text-white' : 'text-[#625d54]'}`}>Book</button>
          <button type="button" onClick={() => setMode('lookup')} className={`rounded-lg px-3 py-2 ${mode === 'lookup' ? 'bg-[#17130a] text-white' : 'text-[#625d54]'}`}>Check Request</button>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
        <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>Schedule request only:</strong> dates shown are preliminary. Your appointment is confirmed only after the D&C Prime Realty team confirms the date, time and meeting point.</p>
      </div>

      {mode === 'lookup' ? (
        <div className="mt-6">
          <div className="flex items-center gap-2"><FiSearch className="text-[#806014]" /><h4 className="text-[18px]">Check a request saved on this device</h4></div>
          <form onSubmit={runLookup} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className="website-label">Request reference</span><input value={lookup.reference} onChange={(event) => setLookup((current) => ({ ...current, reference: event.target.value }))} className="website-input" placeholder="DCP-260907-ABCD" /></label>
            <label><span className="website-label">Mobile number</span><input value={lookup.phone} onChange={(event) => setLookup((current) => ({ ...current, phone: event.target.value }))} className="website-input" placeholder="09XX XXX XXXX" /></label>
            <button type="submit" className="website-button-dark sm:col-span-2"><FiSearch /> Find Request</button>
          </form>
          {lookupMessage ? <p className="mt-4 rounded-xl border border-[#ded9ce] bg-[#faf9f6] p-4 text-[12px] text-[#675f55]">{lookupMessage}</p> : null}
          {lookupResult ? (
            <div className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-emerald-950">{lookupResult.reference}</p><StatusBadge value="limited">{lookupResult.status}</StatusBadge></div>
              <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Project</dt><dd className="mt-1 font-semibold">{bookableProjects.find((project) => project.slug === lookupResult.project)?.name}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Schedule</dt><dd className="mt-1 font-semibold">{formatDate(lookupResult.date)} · {lookupResult.time}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Name</dt><dd className="mt-1 font-semibold">{lookupResult.name}</dd></div>
                <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Visitors</dt><dd className="mt-1 font-semibold">{lookupResult.visitors}</dd></div>
              </dl>
              <p className="mt-4 text-[11px] leading-5 text-emerald-900">This lookup reads requests saved in this browser only. Contact D&C Prime Realty for the confirmed appointment status.</p>
            </div>
          ) : null}
        </div>
      ) : savedRequest ? (
        <div className="mt-6">
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-5">
            <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-950"><FiCheckCircle /> Tripping request prepared</p>
            <p className="mt-2 text-[11px] leading-5 text-emerald-900">Your request is saved on this browser. Send it to the office by email or Facebook to receive final confirmation.</p>
            <div className="mt-4 rounded-xl bg-white/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">Request reference</p>
              <p className="mt-1 text-[22px] font-black tracking-wide text-emerald-950">{savedRequest.reference}</p>
            </div>
            <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
              <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Project</dt><dd className="mt-1 font-semibold">{requestProject?.name}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Schedule</dt><dd className="mt-1 font-semibold">{formatDate(savedRequest.date)} · {savedRequest.time}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Visitors</dt><dd className="mt-1 font-semibold">{savedRequest.visitors}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-emerald-700">Status</dt><dd className="mt-1 font-semibold">Pending Confirmation</dd></div>
            </dl>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <a href={`mailto:${company.email}?subject=${emailSubject}&body=${emailBody}`} className="website-button-dark"><FiMail /> Send by Email</a>
            <a href={company.facebookUrl} target="_blank" rel="noreferrer" className="website-button-light"><FiFacebook /> Facebook</a>
            <button type="button" onClick={() => downloadCalendar(savedRequest, requestProject)} className="website-button-light"><FiDownload /> Add to Calendar</button>
          </div>

          <div className="mt-5 overflow-hidden rounded-[16px] border border-[#ded9ce] bg-[#17130a] text-white sm:grid sm:grid-cols-[0.7fr_1.3fr]">
            <img src={rainySeasonSafety} alt="D&C Prime Realty rainy season safety reminder" className="h-full max-h-[230px] w-full object-cover" />
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#dfbd62]">Travel reminder</p>
              <h4 className="mt-2 text-[19px]">Safety first during rainy weather.</h4>
              <p className="mt-2 text-[11px] leading-5 text-[#d4cec2]">Road and site conditions can change. Confirm your final schedule and meeting point before travelling.</p>
            </div>
          </div>

          <button type="button" onClick={resetBooking} className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold text-[#806014] hover:underline"><FiEdit3 /> Prepare another request</button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {steps.map(([label, value]) => (
              <div key={label} className={`rounded-lg border px-2 py-2 text-center ${step >= value ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#e3ddd2] bg-[#faf9f6] text-[#7a746a]'}`}>
                <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px] font-bold">{step > value ? <FiCheck /> : value}</span>
                <p className="mt-1 text-[9px] font-semibold sm:text-[10px]">{label}</p>
              </div>
            ))}
          </div>

          {step === 1 ? (
            <div className="mt-6">
              <h4 className="text-[18px]">Choose a project</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {bookableProjects.map((project) => (
                  <button key={project.slug} type="button" onClick={() => { setForm((current) => ({ ...current, project: project.slug, date: '', time: '' })); setStep(2) }} className="rounded-[16px] border border-[#ded9ce] bg-[#faf9f6] p-4 text-left transition hover:border-[#b68a1f] hover:bg-[#faf4e5]">
                    <img src={project.logo} alt="" className="h-10 max-w-[140px] object-contain object-left" />
                    <p className="mt-3 text-[14px] font-bold text-[#29251f]">{project.name}</p>
                    <p className="mt-1 text-[11px] text-[#746f65]">{project.location}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806014]">{selectedProject?.name}</p><h4 className="mt-1 text-[18px]">Choose a preferred date</h4></div>
                <button type="button" onClick={() => setStep(1)} className="text-[11px] font-bold text-[#806014] hover:underline">Change project</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{availabilityLegend.map((item) => <StatusBadge key={item.value} value={item.value}>{item.label}</StatusBadge>)}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {upcomingDates.map((item) => {
                  const disabled = ['closed', 'full'].includes(item.status)
                  const selected = form.date === item.dateKey
                  return (
                    <button key={item.dateKey} type="button" disabled={disabled} onClick={() => chooseDate(item)} className={`min-h-[88px] rounded-xl border p-2 text-left transition ${selected ? 'border-[#806014] bg-[#f7edcf] ring-2 ring-[#d8b451]/30' : 'border-[#ded9ce] bg-white'} ${disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-[#b68a1f]'}`}>
                      <p className="text-[10px] font-bold uppercase text-[#7a746a]">{dayLabel(item.date)}</p>
                      <p className="mt-1 text-[13px] font-bold text-[#2d2923]">{shortDate(item.date)}</p>
                      <p className={`mt-2 text-[9px] font-bold uppercase ${item.status === 'available' ? 'text-emerald-700' : item.status === 'limited' ? 'text-amber-700' : item.status === 'full' ? 'text-rose-700' : 'text-slate-500'}`}>{item.status === 'limited' ? 'Filling Up' : item.status}</p>
                    </button>
                  )
                })}
              </div>
              {form.date ? (
                <div className="mt-5">
                  <p className="website-label">Preferred time</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {schedule.slots.map((slot) => <button type="button" key={slot} onClick={() => setForm((current) => ({ ...current, time: slot }))} className={`min-h-[44px] rounded-xl border px-3 text-[12px] font-bold ${form.time === slot ? 'border-[#806014] bg-[#17130a] text-white' : 'border-[#ded9ce] bg-white text-[#3c3832] hover:border-[#b68a1f]'}`}><FiClock className="mr-2 inline" />{slot}</button>)}
                  </div>
                </div>
              ) : null}
              {selectedDateState === 'limited' ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">This date is marked Filling Up for planning. Final availability still needs confirmation from the property team.</p> : null}
              <button type="button" disabled={!form.date || !form.time} onClick={() => setStep(3)} className="website-button-dark mt-5 w-full disabled:cursor-not-allowed disabled:bg-[#aaa399]">Continue to Visitor Details</button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-[18px]">Visitor details</h4><button type="button" onClick={() => setStep(2)} className="text-[11px] font-bold text-[#806014] hover:underline">Change schedule</button></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label><span className="website-label">Full name</span><input required value={form.name} onChange={update('name')} className="website-input" placeholder="Your full name" /></label>
                <label><span className="website-label">Mobile number</span><input required value={form.phone} onChange={update('phone')} className="website-input" placeholder="09XX XXX XXXX" /></label>
                <label><span className="website-label">Email address</span><input type="email" required value={form.email} onChange={update('email')} className="website-input" placeholder="name@example.com" /></label>
                <label><span className="website-label">Party size</span><input type="number" min="1" max="20" value={form.visitors} onChange={update('visitors')} className="website-input" /></label>
                <label className="sm:col-span-2"><span className="website-label">How did you hear about us?</span><select value={form.source} onChange={update('source')} className="website-input"><option value="">Select one</option><option>Facebook</option><option>QR / Printed Material</option><option>Accredited Seller</option><option>Referral</option><option>Google / Web Search</option><option>Walk-in</option><option>Other</option></select></label>
                <label className="sm:col-span-2"><span className="website-label">Message</span><textarea rows="3" value={form.message} onChange={update('message')} className="website-input h-auto py-3" placeholder="Questions or details for the property team" /></label>
              </div>
              <p className="mt-4 text-[10px] leading-4 text-[#817a70]">Your request remains on this browser until you contact the office. Review the <Link to="/privacy-policy" className="font-semibold text-[#806014] hover:underline">Privacy Notice</Link>.</p>
              <button type="button" disabled={!form.name.trim() || !form.phone.trim() || !form.email.trim()} onClick={() => setStep(4)} className="website-button-dark mt-5 w-full disabled:cursor-not-allowed disabled:bg-[#aaa399]">Review Request</button>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="mt-6">
              <div className="flex items-center gap-2"><FiCheckCircle className="text-emerald-700" /><h4 className="text-[18px]">Review your request</h4></div>
              <div className="mt-4 rounded-[16px] border border-[#ded9ce] bg-[#faf9f6] p-4">
                <dl className="grid gap-4 text-[12px] sm:grid-cols-2">
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Project</dt><dd className="mt-1 font-semibold">{selectedProject?.name}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Schedule</dt><dd className="mt-1 font-semibold">{formatDate(form.date)} · {form.time}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Visitor</dt><dd className="mt-1 font-semibold">{form.name}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Party size</dt><dd className="mt-1 font-semibold"><FiUsers className="mr-1 inline" />{form.visitors}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Mobile</dt><dd className="mt-1 font-semibold">{form.phone}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Email</dt><dd className="mt-1 font-semibold">{form.email}</dd></div>
                </dl>
                {form.message ? <div className="mt-4 border-t border-[#ded9ce] pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#806014]">Message</p><p className="mt-1 text-[12px] leading-5">{form.message}</p></div> : null}
              </div>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => setStep(3)} className="website-button-light flex-1"><FiEdit3 /> Edit</button><button type="button" onClick={createRequest} className="website-button-dark flex-1"><FiCheckCircle /> Create Request</button></div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default TrippingForm

