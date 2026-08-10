import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCalendar, FiCheck, FiCheckCircle, FiEdit3, FiFacebook, FiMail, FiPhone, FiUser } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { company } from '../data/company'
import { projects } from '../data/projects'

const getDayName = (value) => value ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${value}T12:00:00`)) : ''
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`)) : ''

const TrippingForm = ({ initialProject = '' }) => {
  const bookableProjects = projects.filter((project) => project.bookingEnabled)
  const safeInitialProject = bookableProjects.some((project) => project.slug === initialProject) ? initialProject : ''
  const [form, setForm] = useState({ name: '', phone: '', email: '', project: safeInitialProject, date: '', time: '', visitors: '1', message: '' })
  const [reviewed, setReviewed] = useState(false)
  const dayName = useMemo(() => getDayName(form.date), [form.date])
  const unavailable = ['Tuesday', 'Thursday'].includes(dayName)
  const today = new Date().toISOString().slice(0, 10)
  const selectedProject = bookableProjects.find((project) => project.slug === form.project)

  const update = (field) => (event) => {
    setReviewed(false)
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const emailSubject = encodeURIComponent(`Property tripping request — ${selectedProject?.name || 'D&C Prime Realty'}`)
  const emailBody = encodeURIComponent([
    'Hello D&C Prime Realty,',
    '',
    'I would like to request a property tripping.',
    `Name: ${form.name}`,
    `Mobile: ${form.phone}`,
    `Email: ${form.email}`,
    `Project: ${selectedProject?.name || ''}`,
    `Preferred date: ${formatDate(form.date)}`,
    `Preferred time: ${form.time}`,
    `Visitors: ${form.visitors}`,
    `Message: ${form.message || 'None'}`,
    '',
    'Please confirm the available schedule and meeting point.',
  ].join('\n'))

  const steps = [
    { label: 'Choose Project', complete: Boolean(form.project) },
    { label: 'Choose Schedule', complete: Boolean(form.date && form.time && !unavailable) },
    { label: 'Review Request', complete: reviewed },
  ]

  return (
    <form id="book-tripping" onSubmit={(event) => { event.preventDefault(); if (!unavailable) setReviewed(true) }} className="rounded-[20px] border border-[#ded9ce] bg-white p-5 shadow-[0_12px_38px_rgba(44,36,20,0.07)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5ead0] text-[#806014]"><FiCalendar className="h-5 w-5" /></span>
        <div>
          <h3 className="text-[21px] text-[#1b1813]">Prepare a property tripping request</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#726d64]">Tuesday and Thursday are unavailable. The final schedule still needs confirmation from the property team.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {steps.map((step, index) => <div key={step.label} className={`rounded-lg border px-2 py-2 text-center ${step.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#e3ddd2] bg-[#faf9f6] text-[#7a746a]'}`}><span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px] font-bold">{step.complete ? <FiCheck /> : index + 1}</span><p className="mt-1 text-[9px] font-semibold sm:text-[10px]">{step.label}</p></div>)}
      </div>

      {!reviewed ? <>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="website-label inline-flex items-center gap-2"><FiUser /> Full name</span><input required value={form.name} onChange={update('name')} placeholder="Enter your full name" className="website-input" /></label>
          <label className="block"><span className="website-label inline-flex items-center gap-2"><FiPhone /> Mobile number</span><input required value={form.phone} onChange={update('phone')} placeholder="09XX XXX XXXX" className="website-input" /></label>
          <label className="block"><span className="website-label inline-flex items-center gap-2"><FiMail /> Email address</span><input type="email" required value={form.email} onChange={update('email')} placeholder="name@example.com" className="website-input" /></label>
          <label className="block"><span className="website-label">Project</span><select required value={form.project} onChange={update('project')} className="website-input"><option value="">Choose a project</option>{bookableProjects.map((project) => <option key={project.slug} value={project.slug}>{project.name} — {project.location}</option>)}</select></label>
          <label className="block"><span className="website-label">Preferred date</span><input type="date" required min={today} value={form.date} onChange={update('date')} className="website-input" /></label>
          <label className="block"><span className="website-label">Preferred time</span><select required value={form.time} onChange={update('time')} className="website-input"><option value="">Choose a time</option><option>8:00 AM</option><option>9:00 AM</option><option>10:00 AM</option><option>1:00 PM</option><option>2:00 PM</option><option>3:00 PM</option></select></label>
          <label className="block"><span className="website-label">Number of visitors</span><input type="number" min="1" max="20" value={form.visitors} onChange={update('visitors')} className="website-input" /></label>
          <label className="block sm:col-span-2"><span className="website-label">Message</span><textarea rows="3" value={form.message} onChange={update('message')} placeholder="Questions or details for the property team" className="website-input h-auto py-3" /></label>
        </div>

        {selectedProject ? <div className="mt-4 rounded-xl border border-[#d9cfb7] bg-[#faf4e5] p-3 text-[12px] leading-5 text-[#69521b]"><strong>{selectedProject.name}</strong><br />{selectedProject.visitNote}</div> : null}
        {unavailable ? <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900"><FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>{dayName} is unavailable for regular tripping.</strong><br />Choose another date or contact the office.</div></div> : null}
        <p className="mt-4 text-[10px] leading-4 text-[#817a70]">By preparing a request, you acknowledge the <Link to="/privacy-policy" className="font-semibold text-[#806014] hover:underline">Privacy Notice</Link>. No information is sent until you use the email or Facebook action.</p>
        <button type="submit" disabled={unavailable} className="website-button-dark mt-5 w-full disabled:cursor-not-allowed disabled:bg-[#aaa399]"><FiCalendar /> Review Tripping Request</button>
      </> : (
        <div className="mt-6">
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-900"><FiCheckCircle /> Request summary</p>
            <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
              {[['Name', form.name], ['Project', selectedProject?.name], ['Date', formatDate(form.date)], ['Time', form.time], ['Visitors', form.visitors], ['Mobile', form.phone]].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">{label}</dt><dd className="mt-1 font-semibold text-emerald-950">{value}</dd></div>)}
            </dl>
            {form.message ? <div className="mt-3 border-t border-emerald-200 pt-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Message</p><p className="mt-1 text-[12px] leading-5 text-emerald-950">{form.message}</p></div> : null}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-[#6d6960]">Choose how to contact the team. This does not confirm the appointment automatically.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href={`mailto:${company.email}?subject=${emailSubject}&body=${emailBody}`} className="website-button-dark"><FiMail /> Send by email</a>
            <a href={company.facebookUrl} target="_blank" rel="noreferrer" className="website-button-light"><FiFacebook /> Message on Facebook</a>
          </div>
          <button type="button" onClick={() => setReviewed(false)} className="mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-[#806014] hover:underline"><FiEdit3 /> Edit request</button>
        </div>
      )}
    </form>
  )
}

export default TrippingForm


