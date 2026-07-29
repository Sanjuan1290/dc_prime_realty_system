import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiMail, FiPhone, FiUser } from 'react-icons/fi'
import { projects } from '../data/projects'
import { sellers } from '../data/sellers'

const getDayName = (value) => value ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${value}T12:00:00`)) : ''

const TrippingForm = ({ initialProject = '' }) => {
  const [form, setForm] = useState({ name: '', phone: '', email: '', project: initialProject, seller: '', date: '', time: '', visitors: '1', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const dayName = useMemo(() => getDayName(form.date), [form.date])
  const unavailable = ['Tuesday', 'Thursday'].includes(dayName)
  const today = new Date().toISOString().slice(0, 10)

  const update = (field) => (event) => {
    setSubmitted(false)
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  return (
    <form id="book-tripping" onSubmit={(event) => { event.preventDefault(); if (!unavailable) setSubmitted(true) }} className="rounded-[28px] border border-[#e7dcc1] bg-white p-6 shadow-[0_24px_70px_rgba(93,69,14,0.10)] sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff2c5] text-[#9d7007]"><FiCalendar className="h-6 w-6" /></span>
        <div>
          <h3 className="text-[24px] font-black tracking-[-0.03em] text-[#18140b]">Request a property tripping</h3>
          <p className="mt-2 text-[13px] leading-6 text-[#716855]">Tuesday and Thursday are unavailable. This frontend form does not create a confirmed appointment yet.</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]"><FiUser /> Full name</span>
          <input required value={form.name} onChange={update('name')} placeholder="Enter your full name" className="website-input" />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]"><FiPhone /> Mobile number</span>
          <input required value={form.phone} onChange={update('phone')} placeholder="09XX XXX XXXX" className="website-input" />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]"><FiMail /> Email address</span>
          <input type="email" required value={form.email} onChange={update('email')} placeholder="name@example.com" className="website-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Project</span>
          <select required value={form.project} onChange={update('project')} className="website-input">
            <option value="">Choose a project</option>
            {projects.map((project) => <option key={project.slug} value={project.slug}>{project.name} — {project.location}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Preferred guide</span>
          <select value={form.seller} onChange={update('seller')} className="website-input">
            <option value="">No preference</option>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Preferred date</span>
          <input type="date" required min={today} value={form.date} onChange={update('date')} className="website-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Preferred time</span>
          <select required value={form.time} onChange={update('time')} className="website-input">
            <option value="">Choose a time</option>
            <option>8:00 AM</option><option>9:00 AM</option><option>10:00 AM</option><option>1:00 PM</option><option>2:00 PM</option><option>3:00 PM</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Number of visitors</span>
          <input type="number" min="1" max="20" value={form.visitors} onChange={update('visitors')} className="website-input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.12em] text-[#5e5544]">Message</span>
          <textarea rows="4" value={form.message} onChange={update('message')} placeholder="Questions or details for the property team" className="website-input h-auto py-3" />
        </label>
      </div>

      {unavailable ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[13px] leading-6 text-amber-900"><FiAlertCircle className="mt-1 h-5 w-5 shrink-0" /><div><strong>{dayName} is unavailable for regular tripping.</strong><br />Please choose another date or use the Contact Us page for assistance.</div></div>
      ) : null}
      {submitted ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-6 text-emerald-900"><FiCheckCircle className="mt-1 h-5 w-5 shrink-0" /><div><strong>Your details are ready for review.</strong><br />This frontend preview does not send or save the request. Contact D&amp;C Prime Realty to confirm the appointment.</div></div>
      ) : null}

      <button type="submit" disabled={unavailable} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17130a] px-5 text-[13px] font-black text-white transition hover:bg-[#9a6d05] disabled:cursor-not-allowed disabled:bg-[#b7ae9b]">
        <FiCalendar /> Review tripping request
      </button>
    </form>
  )
}

export default TrippingForm
