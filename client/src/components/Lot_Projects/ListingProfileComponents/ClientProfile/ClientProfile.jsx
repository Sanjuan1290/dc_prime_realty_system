import { useState } from 'react'
import { FiAlertCircle, FiEdit3, FiLoader, FiUser } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditClientProfileModal from './EditClientProfileModal'

const money = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const DetailBox = ({ label, value, highlight = false, long = false }) => (
  <div className={`${long ? 'md:col-span-2' : ''} rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
    <p className={`text-xs font-black uppercase ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-1 break-words text-sm font-black ${highlight ? 'text-blue-900' : 'text-slate-950'}`}>{value || '-'}</p>
  </div>
)

const Section = ({ title, description, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-black text-slate-950">{title}</h3>
    {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  </div>
)

const ClientProfile = ({ client = {}, onSave, isSaving = false }) => {
  const [showEditModal, setShowEditModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const hasSecondBuyer = client.buyerType === 'spouses' || client.buyerType === 'and_account'
  const isIncomplete = client.profileStatus !== 'complete'

  const handleSave = async (payload) => {
    await onSave?.(payload)
    setShowEditModal(false)
  }

  return (
    <section className="flex flex-col gap-5">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

      {isIncomplete ? (
        <StatusAlert
          type="warning"
          message="Client profile is incomplete. Click Edit to complete buyer, work, and business information."
        />
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FiUser className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Client Profile</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{client.buyerName || 'No buyer profile yet'}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Buyer details, contact information, and work/business information.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiEdit3 className="h-4 w-4" />}
            Edit
          </button>
        </div>
      </div>

      <Section title="Buyer Details" description="Primary buyer identity and contact details.">
        <DetailBox label="Buyer Type" value={client.buyerTypeLabel || client.buyerType} highlight />
        <DetailBox label="Buyer Name" value={client.buyerName} highlight />
        <DetailBox label="Birth Date" value={client.birthDate} />
        <DetailBox label="Place of Birth" value={client.placeOfBirth} />
        <DetailBox label="Citizenship" value={client.citizenship} />
        <DetailBox label="Gender" value={client.gender} />
        <DetailBox label="Civil Status" value={client.civilStatus} />
        <DetailBox label="Contact No." value={client.contactNo} />
        <DetailBox label="Email" value={client.email} />
        <DetailBox label="TIN" value={client.tin} />
        <DetailBox label="Present Address" value={client.presentAddress} long />
        <DetailBox label="Permanent Address" value={client.permanentAddress} long />
      </Section>

      <Section title="Work / Business Information" description="Income source used for buyer qualification.">
        <DetailBox label="Employment Status" value={client.employmentStatus} />
        <DetailBox label="Employer / Business Name" value={client.employerBusinessName} />
        <DetailBox label="Nature of Work / Business" value={client.natureOfWorkBusiness} />
        <DetailBox label="Occupation / Position" value={client.occupationPositionTitle} />
        <DetailBox label="Monthly Income" value={money(client.monthlyIncome)} highlight />
        <DetailBox label="Employer / Business Address" value={client.employerBusinessAddress} long />
      </Section>

      {hasSecondBuyer ? (
        <Section title="Second Buyer / Spouse Details" description="Required for spouses or AND account buyers.">
          <DetailBox label="Second Buyer Role" value={client.secondBuyerRole} />
          <DetailBox label="Second Buyer Name" value={client.secondBuyerName} highlight />
          <DetailBox label="Birth Date" value={client.secondBuyerBirthDate} />
          <DetailBox label="Place of Birth" value={client.secondBuyerPlaceOfBirth} />
          <DetailBox label="Citizenship" value={client.secondBuyerCitizenship} />
          <DetailBox label="Gender" value={client.secondBuyerGender} />
          <DetailBox label="Civil Status" value={client.secondBuyerCivilStatus} />
          <DetailBox label="Contact No." value={client.secondBuyerContactNo} />
          <DetailBox label="Email" value={client.secondBuyerEmail} />
          <DetailBox label="TIN" value={client.secondBuyerTin} />
          <DetailBox label="Present Address" value={client.secondBuyerPresentAddress} long />
          <DetailBox label="Work / Business" value={client.secondBuyerNatureOfWorkBusiness} />
          <DetailBox label="Monthly Income" value={money(client.secondBuyerMonthlyIncome)} highlight />
        </Section>
      ) : null}

      <Section title="Sales Information">
        <DetailBox label="Sales Officer" value={client.salesOfficer || client.seller} />
        <DetailBox label="Date Received" value={client.dateReceived} />
        <DetailBox label="Profile Status" value={client.profileStatus} highlight />
      </Section>

      {isIncomplete ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          Complete the buyer profile before uploading client documents or recording verified payments.
        </div>
      ) : null}

      {showEditModal ? (
        <EditClientProfileModal
          client={client}
          isSaving={isSaving}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  )
}

export default ClientProfile
