import { useState } from 'react'
import {
  FiArrowLeft,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiPrinter,
  FiUser,
} from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'
import StatusAlert from '../../components/Shared/StatusAlert'
import UnitStatus from '../../components/BailenProject/ListingProfileComponents/UnitStatus/UnitStatus'

const mockListing = {
  unit_id: 'LA-0402',
  project_name: 'Bailen Project',
  project_location: 'Bailen, Cavite',
  administrator: 'IMELDA B. VILLALOBOS',
  cadastral_lot_no: '-',
  old_unit_ids: '-',
  source_unit_ids: '-',
  derived_unit_ids: '-',
  lot_type: 'Inner',
  listing_status: 'Pending Cancellation',

  lot_area_sqm: '300 sqm',
  price_per_sqm: '₱1,200.00',
  net_selling_price: '₱360,000.00',
  lmf_rate: '10%',
  lmf_amount: '₱36,000.00',
  tcp: '₱396,000.00',

  buyer_name: 'robert',
  spouse_co_owner: '-',
  email: 'robert@gmail.com',
  contact_no: '09575857575',
  address: 'b70 l44 sampaguita st. cluster 5 bella vista, brgy. santiago, general trias, cavite',
  region: 'REGION 4A',
  assigned_user: 'Super Admin',
  due_day: '1',

  total_paid: '₱0.00',
  balance: '₱396,000.00',
  payment_status: 'Unpaid',
  payment_count: '0',
  latest_payment_date: '-',
  latest_payment_amount: '₱0.00',

  seller: 'Rowena Cortez',
  seller_role: 'Broker Network Manager',
  reports_under: 'None',
  commission_rate: '8%',
  commission_amount: '₱28,800.00',
  released_amount: '₱0.00',
  remaining_commission: '₱28,800.00',
  commission_status: 'On Hold',

  total_documents: '14',
  required_documents: '14',
  submitted_documents: '0',
  approved_documents: '0',
  missing_required: '14',
  document_status: 'Incomplete',

  created_at: '2026-06-28',
  updated_at: '2026-07-01',
  client_unit_created: '2026-07-01',
  client_unit_updated: '2026-07-01',
}

const tabs = [
  { key: 'unit', label: 'Unit & Status', icon: FiHome },
  { key: 'client', label: 'Client Profile', icon: FiUser },
  { key: 'payments', label: 'Payments / SOA', icon: FiCreditCard },
  { key: 'documents', label: 'Documents', icon: FiFileText },
  { key: 'printouts', label: 'Printouts', icon: FiPrinter },
]

const PlaceholderSection = ({ title, description }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
      >
        Edit
      </button>
    </div>
  </section>
)

const ListingProfile = () => {
  const navigate = useNavigate()
  const { listingId } = useParams()

  const [activeTab, setActiveTab] = useState('unit')
  const [alert, setAlert] = useState({
    type: 'info',
    message: 'Mock listing profile only. Each section now has its own edit action.',
  })

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate('/bailenProject/listings')}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98]"
              aria-label="Back to listings"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Listing Details
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                {mockListing.unit_id}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {mockListing.project_name} • {mockListing.listing_status}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Mock route id: {listingId || 'sample'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">TCP</p>
              <p className="mt-1 text-sm font-black text-slate-950">{mockListing.tcp}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">Balance</p>
              <p className="mt-1 text-sm font-black text-slate-950">{mockListing.balance}</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-amber-700">Status</p>
              <p className="mt-1 text-sm font-black text-amber-800">{mockListing.listing_status}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {activeTab === 'unit' ? <UnitStatus listing={mockListing} /> : null}

      {activeTab === 'client' ? (
        <PlaceholderSection
          title="Client Profile"
          description="Client-specific edit action will be placed here. No global save button."
        />
      ) : null}

      {activeTab === 'payments' ? (
        <PlaceholderSection
          title="Payments / SOA"
          description="Payment and SOA edit actions will be handled inside this section."
        />
      ) : null}

      {activeTab === 'documents' ? (
        <PlaceholderSection
          title="Documents"
          description="Document upload and review actions will be handled inside this section."
        />
      ) : null}

      {activeTab === 'printouts' ? (
        <PlaceholderSection
          title="Printouts"
          description="Offer to Buy, SOA, Buyer Profile, and printable forms will be here."
        />
      ) : null}
    </main>
  )
}

export default ListingProfile