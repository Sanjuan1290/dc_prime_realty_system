import { useState } from 'react'
import { FiEdit2, FiUser } from 'react-icons/fi'
import EditClientProfileModal from './EditClientProfileModal'

const Info = ({ label, value }) => <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-950">{value || '-'}</p></div>

const ClientProfile = ({ listing, client }) => {
  const [showEdit, setShowEdit] = useState(false)
  const fullName = client?.buyer_name || 'No client profile yet'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><FiUser className="h-5 w-5 text-blue-600" />Client Profile</h2>
          <p className="text-sm font-semibold text-slate-500">Save buyer details, seller, and work/business information.</p>
        </div>
        <button type="button" onClick={() => setShowEdit(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"><FiEdit2 className="h-4 w-4" />{client ? 'Edit Client' : 'Add Client'}</button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Info label="Buyer" value={fullName} />
        <Info label="Buyer Type" value={client?.buyer_type?.replaceAll('_', ' ')} />
        <Info label="Contact No." value={client?.contact_no} />
        <Info label="Email" value={client?.email} />
        <Info label="Seller" value={client?.seller_name} />
        <Info label="Profile Status" value={listing?.buyer_profile_status} />
        <Info label="Address" value={client?.address} />
        <Info label="Occupation" value={client?.occupation} />
        <Info label="Employer / Business" value={client?.employer_business_name} />
      </div>

      {client?.second_buyer_name ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-950">Second Buyer</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Info label="Name" value={client.second_buyer_name} />
            <Info label="Contact No." value={client.second_buyer_contact_no} />
            <Info label="Work / Business" value={client.second_buyer_employer_business_name} />
          </div>
        </div>
      ) : null}

      {showEdit ? <EditClientProfileModal listing={listing} client={client} onClose={() => setShowEdit(false)} /> : null}
    </section>
  )
}

export default ClientProfile
