import { useState } from 'react'
import { FiLoader, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const Input = ({ label, value, onChange, placeholder = '', type = 'text', disabled = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <input
      type={type}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'}`}
    />
  </label>
)

const TextArea = ({ label, value, onChange, placeholder = '' }) => (
  <label className="flex flex-col gap-1.5 md:col-span-2">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <textarea rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
  </label>
)

const Select = ({ label, value, onChange, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
      {children}
    </select>
  </label>
)

const Section = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="text-sm font-black text-slate-950">{title}</h4>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{children}</div>
  </div>
)

const EditClientProfileModal = ({ client = {}, onClose, onSave, isSaving = false }) => {
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({
    buyerType: client.buyerType || 'single',
    firstName: client.firstName || '',
    middleName: client.middleName || '',
    lastName: client.lastName || client.buyerName || '',
    suffix: client.suffix || '',
    birthDate: client.birthDate || '',
    placeOfBirth: client.placeOfBirth || '',
    citizenship: client.citizenship || 'Filipino',
    gender: client.gender || '',
    civilStatus: client.civilStatus || '',
    contactNo: client.contactNo || '',
    email: client.email || '',
    tin: client.tin || '',
    presentAddress: client.presentAddress || '',
    permanentAddress: client.permanentAddress || '',
    employmentStatus: client.employmentStatus || '',
    employerBusinessName: client.employerBusinessName || '',
    employerBusinessAddress: client.employerBusinessAddress || '',
    natureOfWorkBusiness: client.natureOfWorkBusiness || '',
    occupationPositionTitle: client.occupationPositionTitle || '',
    monthlyIncome: client.monthlyIncome || '',
    secondBuyerName: client.secondBuyerName || '',
    secondBuyerBirthDate: client.secondBuyerBirthDate || '',
    secondBuyerPlaceOfBirth: client.secondBuyerPlaceOfBirth || '',
    secondBuyerCitizenship: client.secondBuyerCitizenship || 'Filipino',
    secondBuyerGender: client.secondBuyerGender || '',
    secondBuyerCivilStatus: client.secondBuyerCivilStatus || '',
    secondBuyerContactNo: client.secondBuyerContactNo || '',
    secondBuyerEmail: client.secondBuyerEmail || '',
    secondBuyerTin: client.secondBuyerTin || '',
    secondBuyerPresentAddress: client.secondBuyerPresentAddress || '',
    secondBuyerPermanentAddress: client.secondBuyerPermanentAddress || '',
    secondBuyerEmploymentStatus: client.secondBuyerEmploymentStatus || '',
    secondBuyerEmployerBusinessName: client.secondBuyerEmployerBusinessName || '',
    secondBuyerEmployerBusinessAddress: client.secondBuyerEmployerBusinessAddress || '',
    secondBuyerNatureOfWorkBusiness: client.secondBuyerNatureOfWorkBusiness || '',
    secondBuyerOccupationPositionTitle: client.secondBuyerOccupationPositionTitle || '',
    secondBuyerMonthlyIncome: client.secondBuyerMonthlyIncome || '',
  })

  const hasSecondBuyer = form.buyerType === 'spouses' || form.buyerType === 'and_account'
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.lastName.trim() && !form.firstName.trim()) return setAlert({ type: 'error', message: 'Buyer name is required.' })
    if (!form.contactNo.trim()) return setAlert({ type: 'error', message: 'Buyer contact number is required.' })
    if (hasSecondBuyer && !form.secondBuyerName.trim()) return setAlert({ type: 'error', message: 'Second buyer name is required for spouses or AND account.' })
    await onSave?.(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">Edit Client Profile</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Complete buyer profile and work/business information.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
          <Section title="Buyer Details">
            <Select label="Buyer Type" value={form.buyerType} onChange={(value) => update('buyerType', value)}><option value="single">Single</option><option value="spouses">Spouses</option><option value="and_account">AND Account</option></Select>
            <Input label="First Name" value={form.firstName} onChange={(value) => update('firstName', value)} placeholder="Example: Juan" />
            <Input label="Middle Name" value={form.middleName} onChange={(value) => update('middleName', value)} placeholder="Example: Cruz" />
            <Input label="Last Name" value={form.lastName} onChange={(value) => update('lastName', value)} placeholder="Example: Dela Cruz" />
            <Input label="Suffix" value={form.suffix} onChange={(value) => update('suffix', value)} placeholder="Jr., Sr., III" />
            <Input label="Birth Date" type="date" value={form.birthDate} onChange={(value) => update('birthDate', value)} />
            <Input label="Place of Birth" value={form.placeOfBirth} onChange={(value) => update('placeOfBirth', value)} placeholder="Example: Cavite" />
            <Input label="Citizenship" value={form.citizenship} onChange={(value) => update('citizenship', value)} />
            <Input label="Gender" value={form.gender} onChange={(value) => update('gender', value)} placeholder="Male / Female" />
            <Input label="Civil Status" value={form.civilStatus} onChange={(value) => update('civilStatus', value)} placeholder="Single / Married" />
            <Input label="Contact Number" value={form.contactNo} onChange={(value) => update('contactNo', value)} placeholder="Example: 0917-000-0000" />
            <Input label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="buyer@email.com" />
            <Input label="TIN" value={form.tin} onChange={(value) => update('tin', value)} placeholder="000-000-000" />
            <TextArea label="Present Address" value={form.presentAddress} onChange={(value) => update('presentAddress', value)} />
            <TextArea label="Permanent Address" value={form.permanentAddress} onChange={(value) => update('permanentAddress', value)} />
          </Section>

          <Section title="Work / Business Information">
            <Input label="Employment Status" value={form.employmentStatus} onChange={(value) => update('employmentStatus', value)} placeholder="Employed / Self-employed" />
            <Input label="Employer / Business Name" value={form.employerBusinessName} onChange={(value) => update('employerBusinessName', value)} />
            <Input label="Nature of Work / Business" value={form.natureOfWorkBusiness} onChange={(value) => update('natureOfWorkBusiness', value)} />
            <Input label="Occupation / Position" value={form.occupationPositionTitle} onChange={(value) => update('occupationPositionTitle', value)} />
            <Input label="Monthly Income" type="number" value={form.monthlyIncome} onChange={(value) => update('monthlyIncome', value)} placeholder="Example: 45000" />
            <TextArea label="Employer / Business Address" value={form.employerBusinessAddress} onChange={(value) => update('employerBusinessAddress', value)} />
          </Section>

          {hasSecondBuyer ? (
            <Section title="Second Buyer / Spouse Information">
              <Input label="Full Name" value={form.secondBuyerName} onChange={(value) => update('secondBuyerName', value)} placeholder="Second buyer full name" />
              <Input label="Birth Date" type="date" value={form.secondBuyerBirthDate} onChange={(value) => update('secondBuyerBirthDate', value)} />
              <Input label="Place of Birth" value={form.secondBuyerPlaceOfBirth} onChange={(value) => update('secondBuyerPlaceOfBirth', value)} />
              <Input label="Citizenship" value={form.secondBuyerCitizenship} onChange={(value) => update('secondBuyerCitizenship', value)} />
              <Input label="Gender" value={form.secondBuyerGender} onChange={(value) => update('secondBuyerGender', value)} />
              <Input label="Civil Status" value={form.secondBuyerCivilStatus} onChange={(value) => update('secondBuyerCivilStatus', value)} />
              <Input label="Contact Number" value={form.secondBuyerContactNo} onChange={(value) => update('secondBuyerContactNo', value)} />
              <Input label="Email" type="email" value={form.secondBuyerEmail} onChange={(value) => update('secondBuyerEmail', value)} />
              <Input label="TIN" value={form.secondBuyerTin} onChange={(value) => update('secondBuyerTin', value)} />
              <TextArea label="Present Address" value={form.secondBuyerPresentAddress} onChange={(value) => update('secondBuyerPresentAddress', value)} />
              <TextArea label="Permanent Address" value={form.secondBuyerPermanentAddress} onChange={(value) => update('secondBuyerPermanentAddress', value)} />
              <Input label="Employment Status" value={form.secondBuyerEmploymentStatus} onChange={(value) => update('secondBuyerEmploymentStatus', value)} />
              <Input label="Employer / Business Name" value={form.secondBuyerEmployerBusinessName} onChange={(value) => update('secondBuyerEmployerBusinessName', value)} />
              <Input label="Nature of Work / Business" value={form.secondBuyerNatureOfWorkBusiness} onChange={(value) => update('secondBuyerNatureOfWorkBusiness', value)} />
              <Input label="Occupation / Position" value={form.secondBuyerOccupationPositionTitle} onChange={(value) => update('secondBuyerOccupationPositionTitle', value)} />
              <Input label="Monthly Income" type="number" value={form.secondBuyerMonthlyIncome} onChange={(value) => update('secondBuyerMonthlyIncome', value)} />
              <TextArea label="Employer / Business Address" value={form.secondBuyerEmployerBusinessAddress} onChange={(value) => update('secondBuyerEmployerBusinessAddress', value)} />
            </Section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditClientProfileModal
