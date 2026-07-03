import { useState } from 'react'
import { FiEdit2, FiUser } from 'react-icons/fi'
import EditClientProfileModal from './EditClientProfileModal'

const ClientProfile = () => {
  const [showEditClientProfileModal, setShowEditClientProfileModal] = useState(false)

  const details = [
    ['Buyer Name', 'Robert San Juan'],
    ['Buyer Type', 'Single'],
    ['Contact Number', '0917 000 0000'],
    ['Email', 'robert@email.com'],
    ['Address', 'Indang, Cavite'],
    ['Civil Status', 'Single'],
    ['Occupation', 'Web Developer'],
    ['Employer / Business', 'D&C Prime Realty'],
    ['Monthly Income', '₱16,000.00'],
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Client Profile</h2>
          <p className="text-sm text-slate-500">Buyer profile attached to LA-0402. This data is used for printouts.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowEditClientProfileModal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <FiEdit2 className="h-4 w-4" />
          Edit
        </button>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <FiUser className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-900">Profile Complete</p>
            <p className="text-sm text-emerald-700">Ready for Offer to Buy and Buyer Profile printout.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">Work / Business Information</h3>
        <p className="mt-1 text-sm text-slate-500">Keep this visible for proof-of-income review and buyer qualification.</p>
      </section>

      {showEditClientProfileModal ? <EditClientProfileModal setShowEditClientProfileModal={setShowEditClientProfileModal} /> : null}
    </div>
  )
}

export default ClientProfile
