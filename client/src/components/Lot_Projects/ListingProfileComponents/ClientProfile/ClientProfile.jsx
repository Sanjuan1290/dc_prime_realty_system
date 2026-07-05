import { useMemo, useState } from 'react'
import { FiAlertCircle, FiEdit3, FiUser } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditClientProfileModal from './EditClientProfileModal'

const fallbackClient = {
  profileStatus: 'incomplete',

  buyerType: 'spouses',

  buyerRole: 'Principal Buyer',
  buyerName: 'robert',
  birthDate: '',
  placeOfBirth: '',
  computedAge: '-',
  citizenship: '',
  gender: '',
  civilStatus: '',
  contactNo: '0957567575',
  residencePhoneNumber: '',
  email: 'robert@gmail.cmo',
  tin: '',
  presentAddress: 'b70 l44 cremonia st. cluster 5, bella vista, brgy. santiago, general trias, cavite',
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

  seller: 'Rowena Cortez',
}

const buyerTypeLabels = {
  single: 'Single',
  spouses: 'Spouses',
  and_account: 'And Account',
}

const Field = ({ label, value, placeholder = '', type = 'text', disabled = true }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <input
      type={type}
      value={value || ''}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={disabled}
      className={`h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${
        disabled
          ? 'bg-slate-50'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    />
  </label>
)

const SelectPreview = ({ label, value, placeholder = 'Select' }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label}</span>
    <select
      value={value || ''}
      disabled
      className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 outline-none"
    >
      <option value="">{placeholder}</option>
      {value ? <option value={value}>{value}</option> : null}
    </select>
  </label>
)

const Section = ({ title, children, right }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-black text-slate-800">{title}</h3>
      {right}
    </div>
    {children}
  </section>
)

const WorkBusinessCard = ({ title, data, prefix = '' }) => {
  const get = (key) => data?.[`${prefix}${key}`]

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-black text-slate-800">{title}</h4>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectPreview
          label="Employment Status"
          value={get('EmploymentStatus')}
          placeholder="Select status"
        />

        <Field
          label="Employer / Business Name"
          value={get('EmployerBusinessName')}
        />

        <Field
          label="Employer ZIP Code"
          value={get('EmployerZipCode')}
        />

        <Field
          label="Nature of Work / Business"
          value={get('NatureOfWorkBusiness')}
        />

        <Field
          label="Occupation / Position / Title"
          value={get('OccupationPositionTitle')}
        />

        <Field
          label="Monthly Income"
          value={get('MonthlyIncome')}
        />

        <div className="md:col-span-2">
          <Field
            label="Employer / Business Address"
            value={get('EmployerBusinessAddress')}
          />
        </div>
      </div>
    </div>
  )
}

const PersonDetails = ({ title, data, second = false }) => {
  const p = second ? 'secondBuyer' : ''

  const value = (field) => {
    if (!second) return data[field]
    return data[`${p}${field.charAt(0).toUpperCase()}${field.slice(1)}`]
  }

  return (
    <Section title={title}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {second ? (
          <SelectPreview
            label="Buyer Role"
            value={data.secondBuyerRole}
            placeholder="Select buyer role"
          />
        ) : null}

        <Field
          label="Full Name"
          value={second ? data.secondBuyerName : data.buyerName}
        />

        <Field
          label="Birth Date"
          type="date"
          value={value('birthDate')}
          placeholder="dd/mm/yyyy"
        />

        <Field
          label="Computed Age"
          value={value('computedAge')}
        />

        <Field
          label="Place of Birth"
          value={value('placeOfBirth')}
        />

        <Field
          label="Citizenship"
          value={value('citizenship')}
        />

        <SelectPreview
          label="Gender"
          value={value('gender')}
          placeholder="Select gender"
        />

        <SelectPreview
          label="Civil Status"
          value={value('civilStatus')}
          placeholder="Select civil status"
        />

        <Field
          label="Mobile Number / Contact Number"
          value={second ? data.secondBuyerContactNo : data.contactNo}
        />

        <Field
          label="Residence Phone Number"
          value={value('residencePhoneNumber')}
        />

        <Field
          label="Email"
          value={second ? data.secondBuyerEmail : data.email}
        />

        <Field
          label="TIN"
          value={second ? data.secondBuyerTin : data.tin}
        />

        <Field
          label="Present Address"
          value={value('presentAddress')}
        />

        <Field
          label="Present ZIP Code"
          value={value('presentZipCode')}
        />

        <Field
          label="Permanent Address"
          value={value('permanentAddress')}
        />

        <Field
          label="Permanent ZIP Code"
          value={value('permanentZipCode')}
        />
      </div>
    </Section>
  )
}

const ClientProfile = ({ client = fallbackClient }) => {
  const [profile, setProfile] = useState({ ...fallbackClient, ...client })
  const [showEditModal, setShowEditModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const hasSecondBuyer = profile.buyerType === 'spouses' || profile.buyerType === 'and_account'

  const profileIsIncomplete = useMemo(() => {
    const requiredPrincipalFields = [
      profile.buyerName,
      profile.contactNo,
      profile.email,
      profile.presentAddress,
    ]

    const secondBuyerFields = hasSecondBuyer
      ? [
          profile.secondBuyerName,
          profile.secondBuyerContactNo,
          profile.secondBuyerEmail,
        ]
      : []

    return [...requiredPrincipalFields, ...secondBuyerFields].some((value) => !String(value || '').trim())
  }, [profile, hasSecondBuyer])

  const handleSave = (nextProfile) => {
    setProfile(nextProfile)
    setShowEditModal(false)
    setAlert({
      type: 'success',
      message: 'Buyer profile updated in mock mode.',
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Buyer Profile</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Offer to Buy and buyer profile source data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              profileIsIncomplete
                ? 'bg-slate-100 text-slate-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {profileIsIncomplete ? 'Incomplete' : 'Complete'}
          </span>

          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiEdit3 className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
          className="mb-4"
        />
      ) : null}

      {profileIsIncomplete ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Buyer profile is incomplete</p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase text-blue-700">Buyer Type</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {buyerTypeLabels[profile.buyerType] || '-'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Sales Officer</p>
          <p className="mt-1 text-sm font-black text-slate-950">{profile.seller || '-'}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Offer to Buy Ready</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {profileIsIncomplete ? 'No' : 'Yes'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <PersonDetails title="Principal Buyer" data={profile} />

        {hasSecondBuyer ? (
          <PersonDetails
            title={profile.buyerType === 'spouses' ? 'Spouse Details' : 'Second Buyer / Co-owner Details'}
            data={profile}
            second
          />
        ) : null}

        <Section title="Work / Business Information">
          <div className={`grid gap-4 ${hasSecondBuyer ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
            <WorkBusinessCard title="Principal Buyer" data={profile} />
            {hasSecondBuyer ? (
              <WorkBusinessCard
                title={profile.buyerType === 'spouses' ? 'Spouse / Second Buyer' : 'Co-owner / Second Buyer'}
                data={profile}
                prefix="secondBuyer"
              />
            ) : null}
          </div>
        </Section>

        <Section title="Income Details (Monthly)">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-black uppercase text-slate-500">Principal</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {profile.monthlyIncome || '₱0.00'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-black uppercase text-slate-500">Spouse / Second Buyer</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {hasSecondBuyer ? profile.secondBuyerMonthlyIncome || '₱0.00' : '₱0.00'}
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-xs font-black uppercase text-blue-700">Total</p>
              <p className="mt-1 text-sm font-black text-blue-900">
                ₱0.00
              </p>
            </div>
          </div>
        </Section>
      </div>

      {showEditModal ? (
        <EditClientProfileModal
          client={profile}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  )
}

export default ClientProfile