import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FiArrowLeft, FiCreditCard, FiFileText, FiHome, FiPrinter, FiSave, FiUser } from 'react-icons/fi'
import UnitStatus from '../../components/BailenProject/ListingProfileComponents/UnitStatus/UnitStatus'
import ClientProfile from '../../components/BailenProject/ListingProfileComponents/ClientProfile/ClientProfile'
import PaymentsSOA from '../../components/BailenProject/ListingProfileComponents/PaymentsSOA/Payments_SOA'
import Documents from '../../components/BailenProject/ListingProfileComponents/Documents/Documents'
import Printouts from '../../components/BailenProject/ListingProfileComponents/Printouts/Printouts'

const ListingProfile = () => {
  const [activeTab, setActiveTab] = useState('unit')

  const tabs = [
    { id: 'unit', label: 'Unit & Status', icon: FiHome, component: <UnitStatus /> },
    { id: 'client', label: 'Client Profile', icon: FiUser, component: <ClientProfile /> },
    { id: 'payments', label: 'Payments & SOA', icon: FiCreditCard, component: <PaymentsSOA /> },
    { id: 'documents', label: 'Documents', icon: FiFileText, component: <Documents /> },
    { id: 'printouts', label: 'Printouts', icon: FiPrinter, component: <Printouts /> },
  ]

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0]

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <NavLink to="/bailenProject/listings" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
            <FiArrowLeft className="h-4 w-4" />
            Back to Listings
          </NavLink>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FiHome className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">LA-0402 Listing Details</h1>
              <p className="text-sm text-slate-500">Edit the unit, save the buyer profile per listing, manage SOA, upload documents, and prepare printouts.</p>
            </div>
          </div>
        </div>

        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
          <FiSave className="h-4 w-4" />
          Save Listing Changes
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Unit</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">LA-0402</h3>
          <p className="mt-1 text-sm text-slate-500">300 sqm</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500">TCP</p>
          <h3 className="mt-2 text-2xl font-bold text-blue-700">₱1,008,000.00</h3>
          <p className="mt-1 text-sm text-slate-500">Includes LMF</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('client')}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <p className="text-sm font-bold text-slate-500">Client Profile</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Complete</h3>
          <p className="mt-1 text-sm text-slate-500">Needed for printouts</p>
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-bold text-slate-500">Status</label>
          <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
            <option>Sold</option>
            <option>Available</option>
            <option>Hold</option>
            <option>Pending for Cancellation</option>
            <option>Cancelled</option>
          </select>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition last:mb-0 ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {currentTab.component}
        </section>
      </section>
    </main>
  )
}

export default ListingProfile
