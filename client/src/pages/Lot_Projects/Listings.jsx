import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiEye, FiFileText, FiGrid, FiPlus, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AddListingModal from '../../components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

const initialListings = [
  { id: 'LA-0402', unitCode: 'LA-0402', oldUnitIds: 'LA-0302', lotType: 'Inner', cadastralLots: ['CAD-001','CAD-002'], area: 300, pricePerSqm: 3200, netSellingPrice: 960000, lmfRate: 5, lmfAmount: 48000, tcp: 1008000, reservationFee: 50000, buyer: 'Robert San Juan', documentStatus: 'Complete', status: 'Sold / Active' },
  { id: 'LA-0403', unitCode: 'LA-0403', oldUnitIds: '-', lotType: 'Corner', cadastralLots: ['CAD-003'], area: 150, pricePerSqm: 3000, netSellingPrice: 450000, lmfRate: 10, lmfAmount: 45000, tcp: 495000, reservationFee: 50000, buyer: 'No buyer yet', documentStatus: 'Project Default', status: 'Available' },
  { id: 'LA-0404', unitCode: 'LA-0404', oldUnitIds: '-', lotType: 'Inner', cadastralLots: ['CAD-004'], area: 180, pricePerSqm: 2950, netSellingPrice: 531000, lmfRate: 10, lmfAmount: 53100, tcp: 584100, reservationFee: 50000, buyer: 'No buyer yet', documentStatus: 'Project Default', status: 'Hold' },
  { id: 'LA-0501', unitCode: 'LA-0501', oldUnitIds: '-', lotType: 'Inner', cadastralLots: ['CAD-005'], area: 220, pricePerSqm: 3250, netSellingPrice: 715000, lmfRate: 8, lmfAmount: 57200, tcp: 772200, reservationFee: 50000, buyer: 'Nico Reyes', documentStatus: 'Complete', status: 'Fully Paid' },
  { id: 'LA-0502', unitCode: 'LA-0502', oldUnitIds: '-', lotType: 'Corner', cadastralLots: ['CAD-006'], area: 240, pricePerSqm: 3400, netSellingPrice: 816000, lmfRate: 8, lmfAmount: 65280, tcp: 881280, reservationFee: 50000, buyer: 'Mika Fernandez', documentStatus: 'Custom', status: 'Pending Cancellation' },
]

const statusTone = (status) => {
  if (status === 'Available') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'Hold') return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (status.includes('Pending')) return 'bg-red-50 text-red-700 ring-red-100'
  if (status === 'Fully Paid') return 'bg-blue-50 text-blue-700 ring-blue-100'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const Listings = () => {
  const [listings, setListings] = useState(initialListings)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const overview = [
    { label: 'All Listings', value: listings.length },
    { label: 'Available', value: listings.filter((item) => item.status === 'Available').length },
    { label: 'Sold', value: listings.filter((item) => item.status.includes('Sold') || item.status === 'Fully Paid').length },
    { label: 'Hold', value: listings.filter((item) => item.status === 'Hold').length },
  ]

  const filteredListings = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return listings.filter((listing) => {
      const matchesKeyword = !keyword || listing.unitCode.toLowerCase().includes(keyword) || listing.lotType.toLowerCase().includes(keyword) || listing.buyer.toLowerCase().includes(keyword) || listing.cadastralLots.join(' ').toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'all' || listing.status === statusFilter
      return matchesKeyword && matchesStatus
    })
  }, [listings, search, statusFilter])

  const handleAddListing = (payload) => {
    setListings((current) => [{ ...payload, id: payload.unitCode, buyer: 'No buyer yet', documentStatus: payload.documentMode === 'custom' ? 'Custom' : 'Project Default', status: 'Available' }, ...current])
    setShowAddModal(false)
    setAlert({ type: 'success', message: `${payload.unitCode} added to mock listings.` })
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Bailen Listings / Units" description="Mock inventory table with price columns, document setup, and unit profile links." icon={FiGrid} />
        <button type="button" onClick={() => setShowAddModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><FiPlus className="h-4 w-4" />Add Listing</button>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{overview.map((item) => <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-black text-slate-950">{item.value}</p></div>)}</section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-black text-slate-950">Unit Inventory</h2><p className="text-sm font-semibold text-slate-500">Showing {filteredListings.length} mock records.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative"><FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unit, buyer, cadastral..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 sm:w-80" /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="Available">Available</option><option value="Sold / Active">Sold / Active</option><option value="Fully Paid">Fully Paid</option><option value="Hold">Hold</option><option value="Pending Cancellation">Pending Cancellation</option></select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1300px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{['Unit ID','Old Unit IDs','Cadastral Lots','Lot Type','Area','Price / SQM','Net Selling','LMF','TCP','RS','Buyer','Documents','Status','Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredListings.map((listing) => <tr key={listing.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-4 font-black text-slate-950">{listing.unitCode}</td><td className="px-4 py-4 font-semibold text-slate-600">{listing.oldUnitIds}</td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{listing.cadastralLots.map((lot) => <span key={lot} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{lot}</span>)}</div></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{listing.lotType}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.area} sqm</td><td className="px-4 py-4 font-semibold text-slate-700">{money(listing.pricePerSqm)}</td><td className="px-4 py-4 font-black text-slate-900">{money(listing.netSellingPrice)}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.lmfRate}%</td><td className="px-4 py-4 font-black text-slate-900">{money(listing.tcp)}</td><td className="px-4 py-4 font-semibold text-slate-700">{money(listing.reservationFee)}</td><td className="px-4 py-4 font-semibold text-slate-700">{listing.buyer}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100"><FiFileText className="h-3.5 w-3.5" />{listing.documentStatus}</span></td>
                <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(listing.status)}`}>{listing.status}</span></td>
                <td className="px-4 py-4"><Link to={`/Bailen-Lot-Project/listings/${listing.unitCode}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"><FiEye className="h-4 w-4" />Details</Link></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal ? <AddListingModal onClose={() => setShowAddModal(false)} onSave={handleAddListing} /> : null}
    </main>
  )
}

export default Listings
