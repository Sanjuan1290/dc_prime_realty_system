import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEye, FiFileText, FiGrid, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AddListingModal from '../../components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal'
import { useFetch, useFetchDelete, useFetchPost } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

const statusTone = (status) => {
  if (status === 'Available') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'Hold') return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (status?.includes('Pending')) return 'bg-red-50 text-red-700 ring-red-100'
  if (status === 'Fully Paid') return 'bg-blue-50 text-blue-700 ring-blue-100'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const Listings = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [alert, setAlert] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const queryString = new URLSearchParams({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }).toString()

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['lot-listings', projectSlug, queryString],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(projectSlug),
    keepPreviousData: true,
  })

  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
  })

  const addListingMutation = useMutation({
    mutationFn: (payload) => useFetchPost(`/projects/lot-projects/${projectSlug}/listings`, payload),
    onMutate: (payload) => {
      setAlert({ type: 'loading', message: `Saving ${payload.unitCode || 'listing'}...` })
    },
    onSuccess: (result) => {
      setShowAddModal(false)
      setAlert({ type: 'success', message: result?.message || 'Listing added successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError?.message || 'Failed to add listing.' })
    },
  })

  const deleteListingMutation = useMutation({
    mutationFn: (listingId) => useFetchDelete(`/projects/lot-projects/${projectSlug}/listings/${listingId}`),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Deleting listing...' })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Listing deleted.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError?.message || 'Failed to delete listing.' })
    },
  })

  const listings = data?.data || []
  const totalPages = Math.max(1, Math.ceil(listings.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedListings = listings.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageStart = listings.length ? ((currentPage - 1) * pageSize) + 1 : 0
  const pageEnd = Math.min(currentPage * pageSize, listings.length)
  const project = data?.project || {}
  const overviewData = data?.overview || {
    total: listings.length,
    available: listings.filter((item) => item.status === 'Available').length,
    sold: listings.filter((item) => item.status?.includes('Sold') || item.status === 'Fully Paid').length,
    hold: listings.filter((item) => item.status === 'Hold').length,
  }

  const overview = [
    { label: 'All Listings', value: overviewData.total || 0 },
    { label: 'Available', value: overviewData.available || 0 },
    { label: 'Sold', value: overviewData.sold || 0 },
    { label: 'Hold', value: overviewData.hold || 0 },
  ]

  const handleAddListing = async (payload) => {
    await addListingMutation.mutateAsync(payload)
  }

  const handleDeleteListing = (listing) => {
    const listingKey = listing.routeId || listing.id || listing.unitCode
    const unitLabel = listing.unitCode || 'this listing'

    if (!listingKey) {
      setAlert({ type: 'error', message: 'Listing ID is missing. Please refresh and try again.' })
      return
    }

    if (!window.confirm(`Delete ${unitLabel}? This cannot be undone.`)) return

    deleteListingMutation.mutate(listingKey)
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title={`${project.name || project.lot_project_name || 'Lot Project'} Listings / Units`} description="Database-connected inventory table with price columns, document setup, and unit profile links." icon={FiGrid} />
        <button type="button" onClick={() => setShowAddModal(true)} disabled={isLoading || isDocumentsLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FiPlus className="h-4 w-4" />Add Listing</button>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading listings from database..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing listings..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load listings.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{overview.map((item) => <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-black text-slate-950">{isLoading ? '...' : item.value}</p></div>)}</section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-black text-slate-950">Unit Inventory</h2><p className="text-sm font-semibold text-slate-500">Showing {pageStart}-{pageEnd} of {listings.length} database record(s).</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative"><FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search unit, buyer, cadastral..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 sm:w-80" /></label>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="available">Available</option><option value="sold">Sold / Active</option><option value="fully_paid">Fully Paid</option><option value="hold">Hold</option><option value="pending_for_cancellation">Pending Cancellation</option><option value="cancelled">Cancelled</option></select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1300px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{['Unit ID','Old Unit IDs','Cadastral Lots','Lot Type','Area','Price / SQM','Net Selling','LMF','TCP','RS','Buyer','Documents','Status','Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <tr><td colSpan={14} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading listings...</td></tr> : null}
              {!isLoading && listings.length === 0 ? <tr><td colSpan={14} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No listings found. Add your first listing for this project.</td></tr> : null}
              {!isLoading && paginatedListings.map((listing) => <tr key={listing.id || listing.unitCode} className="transition hover:bg-slate-50">
                <td className="px-4 py-4 font-black text-slate-950">{listing.unitCode}</td><td className="px-4 py-4 font-semibold text-slate-600">{listing.oldUnitIds}</td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{(listing.cadastralLots || []).length ? listing.cadastralLots.map((lot) => <span key={lot} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{lot}</span>) : <span className="text-slate-400">-</span>}</div></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{listing.lotType}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.area} sqm</td><td className="px-4 py-4 font-semibold text-slate-700">{money(listing.pricePerSqm)}</td><td className="px-4 py-4 font-black text-slate-900">{money(listing.netSellingPrice)}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.lmfRate}%</td><td className="px-4 py-4 font-black text-slate-900">{money(listing.tcp)}</td><td className="px-4 py-4 font-semibold text-slate-700">{money(listing.reservationFee)}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.buyer}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100"><FiFileText className="h-3.5 w-3.5" />{listing.documentStatus}</span></td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(listing.status)}`}>{listing.status}</span></td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link to={`/lot-projects/${projectSlug}/listings/${listing.routeId || listing.id || listing.unitCode}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"><FiEye className="h-4 w-4" />Details</Link><button type="button" onClick={() => handleDeleteListing(listing)} disabled={deleteListingMutation.isPending} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"><FiTrash2 className="h-4 w-4" />Delete</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">Showing {pageStart}-{pageEnd} of {listings.length} records</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
              {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Previous</button>
            <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">Page {currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Next</button>
          </div>
        </div>
      </section>

      {showAddModal ? <AddListingModal project={project} projectDefaultDocuments={project.defaultDocuments || []} libraryDocuments={documentsData?.documents || []} isLoadingDefaults={isDocumentsLoading} onClose={() => setShowAddModal(false)} onSave={handleAddListing} isSaving={addListingMutation.isPending} /> : null}
    </main>
  )
}

export default Listings

