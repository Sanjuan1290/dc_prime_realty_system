import { useState } from 'react'
import {
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiEdit3,
  FiFileText,
  FiHome,
  FiLoader,
  FiSettings,
  FiUser,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditUnitStatusModal from './EditUnitStatusModal'

const StatusPill = ({ status }) => {
  const text = String(status || '-').toLowerCase()
  const tone = text.includes('available') || text.includes('complete') || text.includes('paid')
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : text.includes('pending') || text.includes('partial')
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : text.includes('cancel') || text.includes('missing') || text.includes('incomplete')
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || '-'}
    </span>
  )
}

const DetailBox = ({ label, value, highlight = false, long = false }) => (
  <div className={`${long ? 'md:col-span-2 xl:col-span-3' : ''} rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
    <p className={`text-xs font-black uppercase ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-1 break-words text-sm font-black ${highlight ? 'text-blue-900' : 'text-slate-950'}`}>{value || '-'}</p>
  </div>
)

const SectionBlock = ({ title, description, icon: Icon, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
      </div>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
  </section>
)

const UnitStatus = ({ listing = {}, onSave, isSaving = false }) => {
  const [showEditModal, setShowEditModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const handleSave = async (payload) => {
    await onSave?.(payload)
    setShowEditModal(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Unit & Status</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Listing Details - {listing.unit_id || '-'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Main listing information. Click edit to update the unit, pricing, and status.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={listing.listing_status} />
            <StatusPill status={listing.document_status} />
            <StatusPill status={listing.payment_status} />

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiEdit3 className="h-4 w-4" />}
              Edit
            </button>
          </div>
        </div>
      </section>

      <SectionBlock title="Unit / Project Information" description="Project, unit ID history, source IDs, and current listing status." icon={FiHome}>
        <DetailBox label="Project" value={listing.project_name} />
        <DetailBox label="Project Location" value={listing.project_location} />
        <DetailBox label="Administrator" value={listing.administrator} />
        <DetailBox label="Cadastral Lot No." value={listing.cadastral_lot_no} />
        <DetailBox label="Unit ID" value={listing.unit_id} highlight />
        <DetailBox label="Old Unit IDs" value={listing.old_unit_ids} />
        <DetailBox label="Source Unit IDs" value={listing.source_unit_ids} />
        <DetailBox label="Derived Unit IDs" value={listing.derived_unit_ids} />
        <DetailBox label="Lot Type" value={listing.lot_type} />
        <DetailBox label="Listing Status" value={listing.listing_status} highlight />
      </SectionBlock>

      <SectionBlock title="Lot Pricing" description="Price per SQM, lot area, LMF, TCP, reservation fee, and interest rate." icon={FiDollarSign}>
        <DetailBox label="Lot Area SQM" value={listing.lot_area_sqm} />
        <DetailBox label="Price / SQM" value={listing.price_per_sqm} />
        <DetailBox label="Net Selling Price" value={listing.net_selling_price} />
        <DetailBox label="LMF Rate" value={listing.lmf_rate} />
        <DetailBox label="LMF Amount" value={listing.lmf_amount} />
        <DetailBox label="TCP" value={listing.tcp} highlight />
        <DetailBox label="Reservation Fee" value={typeof listing.reservationFee === 'number' ? `₱${listing.reservationFee.toLocaleString('en-PH')}.00` : listing.reservationFee} />
        <DetailBox label="Annual Interest Rate" value={listing.interestRate || `${listing.annualInterestRate || 0}%`} />
      </SectionBlock>

      <SectionBlock title="Buyer Information" description="Buyer profile and assigned account details." icon={FiUser}>
        <DetailBox label="Buyer Name" value={listing.buyer_name} />
        <DetailBox label="Email" value={listing.email} />
        <DetailBox label="Contact No." value={listing.contact_no} />
        <DetailBox label="Address" value={listing.address} long />
        <DetailBox label="Region" value={listing.region} />
        <DetailBox label="Assigned User" value={listing.assigned_user} />
        <DetailBox label="Due Day" value={listing.due_day} />
      </SectionBlock>

      <SectionBlock title="Payment Information" description="Current payment progress and balance." icon={FiCreditCard}>
        <DetailBox label="Total Paid" value={listing.total_paid} />
        <DetailBox label="Balance" value={listing.balance} highlight />
        <DetailBox label="Payment Status" value={listing.payment_status} />
        <DetailBox label="Payment Count" value={listing.payment_count} />
        <DetailBox label="Latest Payment Date" value={listing.latest_payment_date} />
        <DetailBox label="Latest Payment Amount" value={listing.latest_payment_amount} />
      </SectionBlock>

      <SectionBlock title="Seller / Commission" description="Seller assignment and commission summary." icon={FiBriefcase}>
        <DetailBox label="Seller" value={listing.seller} />
        <DetailBox label="Seller Role" value={listing.seller_role} />
        <DetailBox label="Reports Under" value={listing.reports_under} />
        <DetailBox label="Commission Amount" value={listing.commission_amount} highlight />
        <DetailBox label="Released Amount" value={listing.released_amount} />
        <DetailBox label="Remaining Commission" value={listing.remaining_commission} />
        <DetailBox label="Commission Status" value={listing.commission_status} />
      </SectionBlock>

      <SectionBlock title="Documents" description="Document checklist progress." icon={FiFileText}>
        <DetailBox label="Total Documents" value={listing.total_documents} />
        <DetailBox label="Required Documents" value={listing.required_documents} />
        <DetailBox label="Submitted Documents" value={listing.submitted_documents} />
        <DetailBox label="Approved Documents" value={listing.approved_documents} />
        <DetailBox label="Missing Required" value={listing.missing_required} />
        <DetailBox label="Document Status" value={listing.document_status} highlight />
      </SectionBlock>

      <SectionBlock title="System Information" description="Created and updated timestamps." icon={FiSettings}>
        <DetailBox label="Created At" value={listing.created_at} />
        <DetailBox label="Updated At" value={listing.updated_at} />
        <DetailBox label="Client Unit Created" value={listing.client_unit_created} />
        <DetailBox label="Client Unit Updated" value={listing.client_unit_updated} />
      </SectionBlock>

      {showEditModal ? (
        <EditUnitStatusModal
          listing={listing}
          isSaving={isSaving}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  )
}

export default UnitStatus
