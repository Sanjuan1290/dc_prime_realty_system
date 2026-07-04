import { useState } from 'react'
import {
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiEdit3,
  FiFileText,
  FiHome,
  FiInfo,
  FiSettings,
  FiUser,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const fallbackListing = {
  unit_id: 'LA-0402',
  project_name: 'Bailen Project',
  project_location: 'Bailen, Cavite',
  administrator: 'IMELDA B. VILLALOBOS',
  cadastral_lot_no: '-',
  old_unit_ids: '-',
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

const statusStyles = {
  Available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Sold: 'border-blue-200 bg-blue-50 text-blue-700',
  'Pending Cancellation': 'border-amber-200 bg-amber-50 text-amber-700',
  Cancelled: 'border-red-200 bg-red-50 text-red-700',
  Superseded: 'border-slate-200 bg-slate-100 text-slate-700',
  Incomplete: 'border-red-200 bg-red-50 text-red-700',
  Complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Unpaid: 'border-red-200 bg-red-50 text-red-700',
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'On Hold': 'border-amber-200 bg-amber-50 text-amber-700',
}

const DetailBox = ({ label, value, highlight = false, long = false }) => (
  <div
    className={`min-h-[70px] rounded-xl border p-3 ${
      highlight
        ? 'border-blue-200 bg-blue-50'
        : 'border-slate-200 bg-slate-50'
    } ${long ? 'sm:col-span-2 xl:col-span-2' : ''}`}
  >
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className={`mt-1 break-words text-sm font-black ${highlight ? 'text-blue-700' : 'text-slate-950'}`}>
      {value || '-'}
    </p>
  </div>
)

const StatusPill = ({ status }) => (
  <span
    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${
      statusStyles[status] || 'border-slate-200 bg-slate-50 text-slate-700'
    }`}
  >
    {status || '-'}
  </span>
)

const SectionCard = ({ title, description, icon: Icon, children, onEdit, active }) => (
  <section
    className={`rounded-2xl border bg-white shadow-sm transition ${
      active ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'
    }`}
  >
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] ${
          active
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <FiEdit3 className="h-4 w-4" />
        {active ? 'Editing' : 'Edit'}
      </button>
    </div>

    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  </section>
)

const UnitStatus = ({ listing = fallbackListing }) => {
  const [activeEditSection, setActiveEditSection] = useState(null)
  const [alert, setAlert] = useState(null)

  const openSectionEdit = (sectionName) => {
    setActiveEditSection(sectionName)
    setAlert({
      type: 'info',
      message: `${sectionName} edit action selected. This is mock UI only.`,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">
              Unit & Status
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Listing Details - {listing.unit_id}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Details are separated by section. Each section has its own edit button.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={listing.listing_status} />
            <StatusPill status={listing.document_status} />
            <StatusPill status={listing.payment_status} />
          </div>
        </div>
      </section>

      <SectionCard
        title="Unit / Project Information"
        description="Project, unit ID history, source IDs, and status."
        icon={FiHome}
        active={activeEditSection === 'Unit / Project Information'}
        onEdit={() => openSectionEdit('Unit / Project Information')}
      >
        <DetailBox label="Project" value={listing.project_name} />
        <DetailBox label="Project Location" value={listing.project_location} />
        <DetailBox label="Administrator" value={listing.administrator} />
        <DetailBox label="Cadastral Lot No." value={listing.cadastral_lot_no} />
        <DetailBox label="Unit ID" value={listing.unit_id} highlight />
        <DetailBox label="Old Unit IDs" value={listing.old_unit_ids} />
        <DetailBox label="Lot Type" value={listing.lot_type} />
        <DetailBox label="Listing Status" value={listing.listing_status} highlight />
      </SectionCard>

      <SectionCard
        title="Lot Pricing"
        description="Price per SQM, lot area, LMF, and TCP."
        icon={FiDollarSign}
        active={activeEditSection === 'Lot Pricing'}
        onEdit={() => openSectionEdit('Lot Pricing')}
      >
        <DetailBox label="Lot Area SQM" value={listing.lot_area_sqm} />
        <DetailBox label="Price / SQM" value={listing.price_per_sqm} />
        <DetailBox label="Net Selling Price" value={listing.net_selling_price} />
        <DetailBox label="LMF Rate" value={listing.lmf_rate} />
        <DetailBox label="LMF Amount" value={listing.lmf_amount} />
        <DetailBox label="TCP" value={listing.tcp} highlight />
      </SectionCard>

      <SectionCard
        title="Buyer Information"
        description="Buyer profile and assigned account details."
        icon={FiUser}
        active={activeEditSection === 'Buyer Information'}
        onEdit={() => openSectionEdit('Buyer Information')}
      >
        <DetailBox label="Buyer Name" value={listing.buyer_name} />
        <DetailBox label="Spouse / Co-owner" value={listing.spouse_co_owner} />
        <DetailBox label="Email" value={listing.email} />
        <DetailBox label="Contact No." value={listing.contact_no} />
        <DetailBox label="Address" value={listing.address} long />
        <DetailBox label="Region" value={listing.region} />
        <DetailBox label="Assigned User" value={listing.assigned_user} />
        <DetailBox label="Due Day" value={listing.due_day} />
      </SectionCard>

      <SectionCard
        title="Payment Information"
        description="Current payment progress and balance."
        icon={FiCreditCard}
        active={activeEditSection === 'Payment Information'}
        onEdit={() => openSectionEdit('Payment Information')}
      >
        <DetailBox label="Total Paid" value={listing.total_paid} />
        <DetailBox label="Balance" value={listing.balance} highlight />
        <DetailBox label="Payment Status" value={listing.payment_status} />
        <DetailBox label="Payment Count" value={listing.payment_count} />
        <DetailBox label="Latest Payment Date" value={listing.latest_payment_date} />
        <DetailBox label="Latest Payment Amount" value={listing.latest_payment_amount} />
      </SectionCard>

      <SectionCard
        title="Seller / Commission"
        description="Seller assignment and commission summary."
        icon={FiBriefcase}
        active={activeEditSection === 'Seller / Commission'}
        onEdit={() => openSectionEdit('Seller / Commission')}
      >
        <DetailBox label="Seller" value={listing.seller} />
        <DetailBox label="Seller Role" value={listing.seller_role} />
        <DetailBox label="Reports Under" value={listing.reports_under} />
        <DetailBox label="Commission Rate" value={listing.commission_rate} />
        <DetailBox label="Commission Amount" value={listing.commission_amount} highlight />
        <DetailBox label="Released Amount" value={listing.released_amount} />
        <DetailBox label="Remaining Commission" value={listing.remaining_commission} />
        <DetailBox label="Commission Status" value={listing.commission_status} />
      </SectionCard>

      <SectionCard
        title="Documents"
        description="Document checklist progress."
        icon={FiFileText}
        active={activeEditSection === 'Documents'}
        onEdit={() => openSectionEdit('Documents')}
      >
        <DetailBox label="Total Documents" value={listing.total_documents} />
        <DetailBox label="Required Documents" value={listing.required_documents} />
        <DetailBox label="Submitted Documents" value={listing.submitted_documents} />
        <DetailBox label="Approved Documents" value={listing.approved_documents} />
        <DetailBox label="Missing Required" value={listing.missing_required} />
        <DetailBox label="Document Status" value={listing.document_status} highlight />
      </SectionCard>

      <SectionCard
        title="System Information"
        description="Created and updated timestamps."
        icon={FiSettings}
        active={activeEditSection === 'System Information'}
        onEdit={() => openSectionEdit('System Information')}
      >
        <DetailBox label="Created At" value={listing.created_at} />
        <DetailBox label="Updated At" value={listing.updated_at} />
        <DetailBox label="Client Unit Created" value={listing.client_unit_created} />
        <DetailBox label="Client Unit Updated" value={listing.client_unit_updated} />
      </SectionCard>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <FiInfo className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <h3 className="text-sm font-black text-blue-950">
              No global save button here
            </h3>
            <p className="mt-1 text-sm font-semibold text-blue-800">
              Unit details, pricing, buyer info, payments, commissions, documents, and system info should each handle their own edit modal or section action.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default UnitStatus