import { useMemo, useState } from 'react'
import { FiAlertCircle, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const emptyProfile = {
  profileStatus: 'incomplete',
  buyerType: 'single',

  buyerFirstName: '',
  buyerMiddleName: '',
  buyerLastName: '',
  buyerSuffix: '',
  buyerName: '',
  birthDate: '',
  placeOfBirth: '',
  computedAge: '-',
  citizenship: '',
  gender: '',
  civilStatus: '',
  contactNo: '',
  residencePhoneNumber: '',
  email: '',
  tin: '',
  presentAddress: '',
  presentZipCode: '',
  permanentAddress: '',
  permanentZipCode: '',

  employmentStatus: '',
  employerBusinessName: '',
  employerZipCode: '',
  natureOfWorkBusiness: '',
  occupationPositionTitle: '',
  monthlyIncome: '',
  employerBusinessAddress: '',

  secondBuyerRole: 'spouse',
  secondBuyerFirstName: '',
  secondBuyerMiddleName: '',
  secondBuyerLastName: '',
  secondBuyerSuffix: '',
  secondBuyerName: '',
  secondBuyerBirthDate: '',
  secondBuyerPlaceOfBirth: '',
  secondBuyerComputedAge: '-',
  secondBuyerCitizenship: '',
  secondBuyerGender: '',
  secondBuyerCivilStatus: '',
  secondBuyerContactNo: '',
  secondBuyerResidencePhoneNumber: '',
  secondBuyerEmail: '',
  secondBuyerTin: '',
  secondBuyerPresentAddress: '',
  secondBuyerPresentZipCode: '',
  secondBuyerPermanentAddress: '',
  secondBuyerPermanentZipCode: '',

  secondBuyerEmploymentStatus: '',
  secondBuyerEmployerBusinessName: '',
  secondBuyerEmployerZipCode: '',
  secondBuyerNatureOfWorkBusiness: '',
  secondBuyerOccupationPositionTitle: '',
  secondBuyerMonthlyIncome: '',
  secondBuyerEmployerBusinessAddress: '',
}

const buildDisplayName = ({ firstName = '', middleName = '', lastName = '', suffix = '' } = {}) =>
  [firstName, middleName, lastName, suffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

const computeAge = (birthDate) => {
  if (!birthDate) return '-'

  const birth = new Date(birthDate)
  const today = new Date()

  if (Number.isNaN(birth.getTime())) return '-'

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return age >= 0 ? String(age) : '-'
}

const Input = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  disabled = false,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <input
      type={type}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    />
  </label>
)

const Select = ({ label, value, onChange, children, disabled = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      {children}
    </select>
  </label>
)

const Section = ({ title, children }) => (
  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="mb-4 text-sm font-black text-slate-800">{title}</h3>
    {children}
  </section>
)

const PersonForm = ({ title, form, setForm, second = false }) => {
  const key = (field) => {
    if (!second) return field
    return `secondBuyer${field.charAt(0).toUpperCase()}${field.slice(1)}`
  }

  const getValue = (field) => form[key(field)]

  const updateValue = (field, value) => {
    const targetKey = key(field)

    setForm((current) => {
      const next = {
        ...current,
        [targetKey]: value,
      }

      if (['firstName', 'middleName', 'lastName', 'suffix'].includes(field)) {
        next[second ? 'secondBuyerName' : 'buyerName'] = buildDisplayName({
          firstName: next[key('firstName')],
          middleName: next[key('middleName')],
          lastName: next[key('lastName')],
          suffix: next[key('suffix')],
        })
      }

      if (field === 'birthDate') {
        next[key('computedAge')] = computeAge(value)
      }

      return next
    })
  }

  return (
    <Section title={title}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {second ? (
          <Select
            label="Buyer Role"
            value={form.secondBuyerRole}
            onChange={(value) => setForm((current) => ({ ...current, secondBuyerRole: value }))}
          >
            <option value="spouse">Spouse</option>
            <option value="co_owner">Co-owner</option>
            <option value="second_buyer">Second Buyer</option>
          </Select>
        ) : null}

        <Input
          label="Last Name"
          value={getValue('lastName')}
          onChange={(value) => updateValue('lastName', value)}
        />

        <Input
          label="First Name"
          value={getValue('firstName')}
          onChange={(value) => updateValue('firstName', value)}
        />

        <Input
          label="Middle Name"
          value={getValue('middleName')}
          onChange={(value) => updateValue('middleName', value)}
        />

        <Input
          label="Suffix"
          value={getValue('suffix')}
          onChange={(value) => updateValue('suffix', value)}
          placeholder="Jr., Sr., III"
        />

        <Input
          label="Birth Date"
          type="date"
          value={getValue('birthDate')}
          onChange={(value) => updateValue('birthDate', value)}
        />

        <Input
          label="Computed Age"
          value={getValue('computedAge')}
          onChange={() => null}
          disabled
        />

        <Input
          label="Place of Birth"
          value={getValue('placeOfBirth')}
          onChange={(value) => updateValue('placeOfBirth', value)}
        />

        <Input
          label="Citizenship"
          value={getValue('citizenship')}
          onChange={(value) => updateValue('citizenship', value)}
        />

        <Select
          label="Gender"
          value={getValue('gender')}
          onChange={(value) => updateValue('gender', value)}
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </Select>

        <Select
          label="Civil Status"
          value={getValue('civilStatus')}
          onChange={(value) => updateValue('civilStatus', value)}
        >
          <option value="">Select civil status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Separated">Separated</option>
          <option value="Annulled/Divorced">Annulled/Divorced</option>
          <option value="Widow/er">Widow/er</option>
        </Select>

        <Input
          label="Mobile Number / Contact Number"
          value={second ? form.secondBuyerContactNo : form.contactNo}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerContactNo' : 'contactNo']: value,
            }))
          }
        />

        <Input
          label="Residence Phone Number"
          value={getValue('residencePhoneNumber')}
          onChange={(value) => updateValue('residencePhoneNumber', value)}
        />

        <Input
          label="Email"
          value={second ? form.secondBuyerEmail : form.email}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerEmail' : 'email']: value,
            }))
          }
        />

        <Input
          label="TIN"
          value={second ? form.secondBuyerTin : form.tin}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerTin' : 'tin']: value,
            }))
          }
        />

        <Input
          label="Present Address"
          value={getValue('presentAddress')}
          onChange={(value) => updateValue('presentAddress', value)}
        />

        <Input
          label="Present ZIP Code"
          value={getValue('presentZipCode')}
          onChange={(value) => updateValue('presentZipCode', value)}
        />

        <Input
          label="Permanent Address"
          value={getValue('permanentAddress')}
          onChange={(value) => updateValue('permanentAddress', value)}
        />

        <Input
          label="Permanent ZIP Code"
          value={getValue('permanentZipCode')}
          onChange={(value) => updateValue('permanentZipCode', value)}
        />
      </div>
    </Section>
  )
}

const WorkBusinessForm = ({ title, form, setForm, second = false }) => {
  const prefix = second ? 'secondBuyer' : ''

  const key = (field) => {
    if (!second) return field
    return `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`
  }

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [key(field)]: value,
    }))
  }

  const value = (field) => form[key(field)] || ''

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-black text-slate-800">{title}</h4>

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Employment Status"
          value={value('employmentStatus')}
          onChange={(nextValue) => update('employmentStatus', nextValue)}
        >
          <option value="">Select status</option>
          <option value="Employed - Private">Employed - Private</option>
          <option value="Self-Employed">Self-Employed</option>
          <option value="Employed - Government">Employed - Government</option>
          <option value="Professional">Professional</option>
          <option value="OFW">OFW</option>
          <option value="Other">Other</option>
        </Select>

        <Input
          label="Employer / Business Name"
          value={value('employerBusinessName')}
          onChange={(nextValue) => update('employerBusinessName', nextValue)}
        />

        <Input
          label="Employer ZIP Code"
          value={value('employerZipCode')}
          onChange={(nextValue) => update('employerZipCode', nextValue)}
        />

        <Input
          label="Nature of Work / Business"
          value={value('natureOfWorkBusiness')}
          onChange={(nextValue) => update('natureOfWorkBusiness', nextValue)}
        />

        <Input
          label="Occupation / Position / Title"
          value={value('occupationPositionTitle')}
          onChange={(nextValue) => update('occupationPositionTitle', nextValue)}
        />

        <Input
          label="Monthly Income"
          value={value('monthlyIncome')}
          onChange={(nextValue) => update('monthlyIncome', nextValue)}
          placeholder="₱0.00"
        />

        <div className="md:col-span-2">
          <Input
            label="Employer / Business Address"
            value={value('employerBusinessAddress')}
            onChange={(nextValue) => update('employerBusinessAddress', nextValue)}
          />
        </div>
      </div>
    </section>
  )
}

const EditClientProfileModal = ({ client, onClose, onSave, isParentSaving = false }) => {
  const [form, setForm] = useState({
    ...emptyProfile,
    ...client,
  })

  const [alert, setAlert] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const saving = isSaving || isParentSaving
  const hasSecondBuyer = form.buyerType === 'spouses' || form.buyerType === 'and_account'

  const status = useMemo(() => {
    const required = [form.buyerFirstName, form.buyerLastName, form.contactNo, form.email, form.presentAddress]

    if (hasSecondBuyer) {
      required.push(form.secondBuyerFirstName, form.secondBuyerLastName, form.secondBuyerContactNo, form.secondBuyerEmail)
    }

    return required.some((value) => !String(value || '').trim()) ? 'incomplete' : 'complete'
  }, [form, hasSecondBuyer])

  const updateBuyerType = (buyerType) => {
    setForm((current) => ({
      ...current,
      buyerType,
      secondBuyerRole: buyerType === 'spouses' ? 'spouse' : 'co_owner',
    }))

    setAlert({
      type: 'info',
      message:
        buyerType === 'single'
          ? 'Second buyer form hidden.'
          : 'Second buyer form shown for Offer to Buy.',
    })
  }

  const handleSave = async () => {
    if (!form.buyerFirstName.trim() || !form.buyerLastName.trim()) {
      setAlert({ type: 'error', message: 'Principal buyer first name and last name are required.' })
      return
    }

    if (hasSecondBuyer && (!form.secondBuyerFirstName.trim() || !form.secondBuyerLastName.trim())) {
      setAlert({ type: 'error', message: 'Second buyer / spouse first name and last name are required.' })
      return
    }

    setIsSaving(true)
    setAlert({ type: 'loading', message: 'Saving buyer profile to database...' })

    try {
      await onSave?.({
        ...form,
        profileStatus: status,
      })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save buyer profile.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Edit Buyer Profile</h2>
            <p className="text-xs font-semibold text-slate-500">
              Used for Offer to Buy and Buyer&apos;s Profile printout.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit client profile"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Select
                label="Buyer Type"
                value={form.buyerType}
                onChange={updateBuyerType}
                disabled={saving}
              >
                <option value="single">Single</option>
                <option value="spouses">Spouses</option>
                <option value="and_account">And Account</option>
              </Select>

              <div className="rounded-lg bg-white px-4 py-3">
                <p className="text-xs font-black uppercase text-slate-500">Profile Status</p>
                <p
                  className={`mt-1 text-sm font-black ${
                    status === 'complete' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {status === 'complete' ? 'Complete' : 'Incomplete'}
                </p>
              </div>
            </div>

            {hasSecondBuyer ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Since buyer type is {form.buyerType === 'spouses' ? 'Spouses' : 'And Account'}, the spouse/co-buyer form is shown for the Offer to Buy printout.
                </p>
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-4">
            <PersonForm title="Principal Buyer" form={form} setForm={setForm} />

            {hasSecondBuyer ? (
              <PersonForm
                title={form.buyerType === 'spouses' ? 'Spouse Details' : 'Second Buyer / Co-owner Details'}
                form={form}
                setForm={setForm}
                second
              />
            ) : null}

            <Section title="Work / Business Information">
              <div className={`grid gap-4 ${hasSecondBuyer ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
                <WorkBusinessForm
                  title="Principal Buyer"
                  form={form}
                  setForm={setForm}
                />

                {hasSecondBuyer ? (
                  <WorkBusinessForm
                    title={form.buyerType === 'spouses' ? 'Spouse Details — Work / Business Information' : 'Second Buyer — Work / Business Information'}
                    form={form}
                    setForm={setForm}
                    second
                  />
                ) : null}
              </div>
            </Section>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Buyer Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditClientProfileModal


