import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEye, FiGrid, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AddListingModal from '../../components/BailenProject/ListingComponents/AddListingModal/AddListingModal'
import { useFetch } from '../../utils/useFetch'
import { formatMoney, formatNumber } from '../../utils/formatMoney'

const badgeClass = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  sold: 'border-blue-200 bg-blue-50 text-blue-700',
  hold: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_for_cancellation: 'border-orange-200 bg-orange-50 text-orange-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
  superseded: 'border-slate-200 bg-slate-50 text-slate-600',
}

const StatCard = ({ label, value, note }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <h3 className="mt-2 text-2xl font-black text-slate-950">{value}</h3>
    <p className="mt-2 text-xs font-semibold text-slate-500">{note}</p>
  </div>
)

const Listings = () => {
  const queryClient = useQueryClient()
  const [showAddListingModal, setShowAddListingModal] = useState(false)
  const [search, setSearch] = useState('')
  const [lotType, setLotType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const queryString = new URLSearchParams({
    page: String(page),
    limit: '10',
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(lotType !== 'all' ? { lot_type: lotType } : {}),
    ...(status !== 'all' ? { status } : {}),
  }).toString()

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['bailen-listings', queryString],
    queryFn: () => useFetch(`/bailen/listings?${queryString}`),
    keepPreviousData: true,
  })

  const listings = data?.data || []
  const summary = data?.summary || {}
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0, hasPrev: false, hasNext: false }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Listings / Units" description="Manage Bailen unit inventory. Open Details to save client profile, SOA, documents, and printouts." icon={FiGrid} />
        <button type="button" onClick={() => setShowAddListingModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
          <FiPlus className="h-4 w-4" />
          Add Listing
        </button>
      </div>

      {isLoading ? <StatusAlert type="loading" message="Loading listings..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing listings..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load listings.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="All Listings" value={formatNumber(summary.total)} note="Total Bailen unit inventory" />
        <StatCard label="Available" value={formatNumber(summary.available)} note="Ready for reservation" />
        <StatCard label="Hold" value={formatNumber(summary.hold)} note="Temporarily held" />
        <StatCard label="Sold" value={formatNumber(summary.sold)} note="With buyer profile" />
        <StatCard label="Total Value" value={formatMoney(summary.total_tcp)} note="Committed TCP" />
      </section>

      <StatusAlert type="info" message="Workflow: Add inventory first. Open Details to manage the client profile, SOA, documents, payments, and printouts." />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Bailen Unit Records</h2>
            <p className="text-sm font-semibold text-slate-500">Open a unit record for client profile, SOA, documents, and printouts.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search unit, buyer, CAD, old ID, or seller" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
            <select value={lotType} onChange={(event) => { setLotType(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="all">All Lot Types</option>
              <option value="inner">Inner</option>
              <option value="corner">Corner</option>
              <option value="commercial">Commercial</option>
              <option value="other">Other</option>
            </select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="hold">Hold</option>
              <option value="sold">Sold</option>
              <option value="pending_for_cancellation">Pending Cancellation</option>
              <option value="cancelled">Cancelled</option>
              <option value="superseded">Superseded</option>
            </select>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['bailen-listings'] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Cadastral Lot Nos.</th>
                <th className="px-4 py-3">Lot Type</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Net Selling</th>
                <th className="px-4 py-3">TCP</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.length === 0 ? (
                <tr><td colSpan="9" className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No listings found.</td></tr>
              ) : listings.map((listing) => (
                <tr key={listing.bailen_listing_id} className={listing.status === 'sold' ? 'bg-blue-50/30' : ''}>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{listing.unit_code}</p>
                    <p className="text-xs font-semibold text-slate-500">Old: {listing.old_unit_ids || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(listing.cadastral_lot_numbers || '').split(',').filter(Boolean).map((lot) => <span key={lot} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600">{lot}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold capitalize text-slate-700">{listing.lot_type}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{formatNumber(listing.lot_area_sqm)} sqm</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{formatMoney(listing.net_selling_price)}</td>
                  <td className="px-4 py-4 font-black text-blue-700">{formatMoney(listing.tcp)}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{listing.buyer_name || 'No client yet'}</p>
                    <p className="text-xs font-semibold text-slate-500">profile {listing.buyer_profile_status || 'missing'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${badgeClass[listing.status] || badgeClass.available}`}>{listing.status?.replaceAll('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <NavLink to={`${listing.bailen_listing_id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                      <FiEye className="h-3.5 w-3.5" />
                      Details
                    </NavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-slate-500">Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>

      {showAddListingModal ? <AddListingModal setShowAddListingModal={setShowAddListingModal} /> : null}
    </main>
  )
}

export default Listings
