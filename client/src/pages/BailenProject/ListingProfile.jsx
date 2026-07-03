import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiArrowLeft, FiCreditCard, FiFileText, FiHome, FiPrinter, FiSave, FiUser } from 'react-icons/fi'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'
import { formatMoney, formatNumber } from '../../utils/formatMoney'
import UnitStatus from '../../components/BailenProject/ListingProfileComponents/UnitStatus/UnitStatus'
import ClientProfile from '../../components/BailenProject/ListingProfileComponents/ClientProfile/ClientProfile'
import Payments_SOA from '../../components/BailenProject/ListingProfileComponents/PaymentsSOA/Payments_SOA'
import Documents from '../../components/BailenProject/ListingProfileComponents/Documents/Documents'
import Printouts from '../../components/BailenProject/ListingProfileComponents/Printouts/Printouts'

const tabs = [
  { key: 'unit', label: 'Unit & Status', icon: FiHome },
  { key: 'client', label: 'Client Profile', icon: FiUser },
  { key: 'payments', label: 'Payments & SOA', icon: FiCreditCard },
  { key: 'documents', label: 'Documents', icon: FiFileText },
  { key: 'printouts', label: 'Printouts', icon: FiPrinter },
]

const ListingProfile = () => {
  const { listingId } = useParams()
  const [activeTab, setActiveTab] = useState('unit')

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['bailen-listing-profile', listingId],
    queryFn: () => useFetch(`/bailen/listing-profile/${listingId}`),
    enabled: Boolean(listingId),
  })

  const listing = data?.listing
  const client = data?.client_profile
  const soaRows = data?.soa_rows || []
  const payments = data?.payments || []
  const documents = data?.documents || []

  const completeDocs = documents.filter((doc) => doc.document_review_status === 'approved').length

  const renderTab = () => {
    if (!listing) return null
    if (activeTab === 'unit') return <UnitStatus listing={listing} />
    if (activeTab === 'client') return <ClientProfile listing={listing} client={client} />
    if (activeTab === 'payments') return <Payments_SOA listing={listing} soaRows={soaRows} payments={payments} />
    if (activeTab === 'documents') return <Documents listing={listing} documents={documents} />
    if (activeTab === 'printouts') return <Printouts listing={listing} client={client} soaRows={soaRows} />
    return null
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <NavLink to="/bailenProject/listings" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"><FiArrowLeft />Back to Listings</NavLink>
          <h1 className="text-3xl font-black text-slate-950">{listing?.unit_code || 'Listing'} Details</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Edit the unit, save the buyer profile, manage SOA, upload documents, and prepare printouts.</p>
        </div>
        <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm"><FiSave />Save Listing Changes</button>
      </div>

      {isLoading ? <StatusAlert type="loading" message="Loading listing details..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing listing details..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load listing profile.'} /> : null}

      {listing ? (
        <>
          <section className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Unit</p><h3 className="mt-2 text-2xl font-black text-slate-950">{listing.unit_code}</h3><p className="text-sm font-semibold text-slate-500">{formatNumber(listing.lot_area_sqm)} sqm</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">TCP</p><h3 className="mt-2 text-2xl font-black text-blue-700">{formatMoney(listing.tcp)}</h3><p className="text-sm font-semibold text-slate-500">Includes LMF</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Client Profile</p><h3 className="mt-2 text-2xl font-black capitalize text-slate-950">{listing.buyer_profile_status}</h3><p className="text-sm font-semibold text-slate-500">Needed for printouts</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Documents</p><h3 className="mt-2 text-2xl font-black text-slate-950">{completeDocs}/{documents.length}</h3><p className="text-sm font-semibold text-slate-500">Approved documents</p></div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.key
                return <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><Icon className="h-4 w-4" />{tab.label}</button>
              })}
            </aside>
            <div>{renderTab()}</div>
          </section>
        </>
      ) : null}
    </main>
  )
}

export default ListingProfile
