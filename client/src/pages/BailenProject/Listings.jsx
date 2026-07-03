import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FiEye, FiGrid, FiPlus, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import AddListingModal from '../../components/BailenProject/ListingComponents/AddListingModal'

const Listings = () => {
  const [showAddListingModal, setShowAddListingModal] = useState(false)

  const overview = [
    { label: 'All Listings', value: '3', note: 'Total Bailen unit inventory' },
    { label: 'Available', value: '1', note: 'Ready for reservation' },
    { label: 'Hold', value: '1', note: 'Temporarily held' },
    { label: 'Sold', value: '1', note: 'With buyer profile' },
    { label: 'Total Value', value: '₱2,113,650', note: 'Committed TCP' },
  ]

  const records = [
    {
      unit: 'LA-0402',
      old: 'Old: LA-0302',
      cadastral: ['CAD-001', 'CAD-002'],
      lotType: 'Inner',
      area: '300 sqm',
      netSelling: '₱960,000.00',
      tcp: '₱1,008,000.00',
      buyer: 'Robert San Juan',
      buyerNote: 'Complete',
      status: 'Sold',
    },
    {
      unit: 'LA-0403',
      old: 'Old: -',
      cadastral: ['CAD-003'],
      lotType: 'Corner',
      area: '150 sqm',
      netSelling: '₱495,000.00',
      tcp: '₱519,750.00',
      buyer: 'No client yet',
      buyerNote: 'Profile missing',
      status: 'Available',
    },
    {
      unit: 'LA-0404',
      old: 'Old: -',
      cadastral: ['CAD-004'],
      lotType: 'Inner',
      area: '180 sqm',
      netSelling: '₱363,600.00',
      tcp: '₱381,900.00',
      buyer: 'No client yet',
      buyerNote: 'Profile missing',
      status: 'Hold',
    },
  ]

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Listings / Units" description="Manage Bailen unit inventory. Open Details to save client profile, SOA, documents, and printouts." icon={FiGrid} />
        <button
          type="button"
          onClick={() => setShowAddListingModal(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FiPlus className="h-4 w-4" />
          Add Listing
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {overview.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">{item.label}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">{item.value}</h3>
            <p className="mt-1 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
        Workflow: Add inventory first, then open Details. Client profile is saved per listing/unit.
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Bailen Unit Records</h2>
            <p className="text-sm text-slate-500">Details open a full page so client profile, SOA, documents, and printouts have enough space.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search unit, buyer, CAD, old ID, or seller"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
              />
            </label>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option>All Lot Types</option>
              <option>Inner</option>
              <option>Corner</option>
            </select>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option>All Status</option>
              <option>Available</option>
              <option>Sold</option>
              <option>Hold</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
              {records.map((record) => (
                <tr key={record.unit} className="align-middle">
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{record.unit}</p>
                    <p className="text-xs font-medium text-slate-500">{record.old}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {record.cadastral.map((lot) => (
                        <span key={lot} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">{lot}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{record.lotType}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{record.area}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{record.netSelling}</td>
                  <td className="px-4 py-4 font-bold text-blue-700">{record.tcp}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{record.buyer}</p>
                    <p className="text-xs font-medium text-slate-500">{record.buyerNote}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        record.status === 'Sold'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : record.status === 'Available'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <NavLink
                      to={`/bailenProject/listings/${record.unit}`}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
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
          <p className="text-sm font-semibold text-slate-500">Showing 1-3 of 3 records</p>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-400">Previous</button>
            <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Page 1 of 1</span>
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-400">Next</button>
          </div>
        </div>
      </section>

      {showAddListingModal ? <AddListingModal setShowAddListingModal={setShowAddListingModal} /> : null}
    </main>
  )
}

export default Listings
