import { useMemo, useState } from 'react'
import {
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiEdit3,
  FiFileText,
  FiHome,
  FiRefreshCw,
  FiRotateCcw,
  FiSettings,
  FiUser,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditUnitStatusModal from './EditUnitStatusModal'
import RecalculateCommissionModal from './RecalculateCommissionModal'
import CommissionDistribution from './CommissionDistribution'
import CancellationSettlementModal from './CancellationSettlementModal'
import ConfirmActionModal from '../../../Shared/ConfirmActionModal'

const fallbackListing = {
  unit_id: '-',
  project_name: 'Lot Project',
  project_location: '-',
  administrator: '-',
  cadastral_lot_no: '-',
  old_unit_ids: '-',
  lot_type: '-',
  listing_status: '-',
  lot_area_sqm: '0 sqm',
  price_per_sqm: '₱0.00',
  net_selling_price: '₱0.00',
  lmf_rate: '0%',
  lmf_amount: '₱0.00',
  tcp: '₱0.00',
  buyer_name: '-',
  spouse_co_owner: '-',
  email: '-',
  contact_no: '-',
  address: '-',
  assigned_user: '-',
  due_day: '-',
  total_paid: '₱0.00',
  balance: '₱0.00',
  payment_status: '-',
  payment_count: '0',
  latest_payment_date: '-',
  latest_payment_amount: '₱0.00',
  seller: '-',
  seller_role: '-',
  seller_email: '-',
  seller_contact_no: '-',
  seller_group: '-',
  seller_status: '-',
  seller_accreditation_date: '-',
  reports_under: '-',
  sale_channel: '-',
  commission_rate: '-',
  commission_amount: '₱0.00',
  released_amount: '₱0.00',
  remaining_commission: '₱0.00',
  commission_status: '-',
  total_documents: '0',
  required_documents: '0',
  submitted_documents: '0',
  approved_documents: '0',
  missing_required: '0',
  document_status: '-',
  created_at: '-',
  updated_at: '-',
  client_unit_created: '-',
  client_unit_updated: '-',
}

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const statusStyles = {
  Available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Hold: 'border-amber-200 bg-amber-50 text-amber-700',
  'Sold / Active': 'border-blue-200 bg-blue-50 text-blue-700',
  'Fully Paid': 'border-blue-200 bg-blue-50 text-blue-700',
  'Pending Cancellation': 'border-orange-200 bg-orange-50 text-orange-700',
  'Pending for Cancellation': 'border-orange-200 bg-orange-50 text-orange-700',
  Cancelled: 'border-red-200 bg-red-50 text-red-700',
  Incomplete: 'border-red-200 bg-red-50 text-red-700',
  Complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Unpaid: 'border-red-200 bg-red-50 text-red-700',
  Partial: 'border-amber-200 bg-amber-50 text-amber-700',
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Eligible: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'On Hold': 'border-amber-200 bg-amber-50 text-amber-700',
}

const DetailBox = ({ label, value, highlight = false, long = false }) => (
  <div
    className={`min-h-[70px] rounded-xl border p-3 ${
      highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
    } ${long ? 'sm:col-span-2 xl:col-span-2' : ''}`}
  >
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
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

const SectionBlock = ({ title, description, icon: Icon, action = null, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>

    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  </section>
)

const UnitStatus = ({
  listing = fallbackListing,
  project = {},
  onSave,
  canRecalculateCommission = false,
  onRecalculateCommission,
  isSaving = false,
  isRecalculatingCommission = false,
}) => {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRecalculateModal, setShowRecalculateModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [alert, setAlert] = useState(null)

  const unitData = useMemo(() => ({ ...fallbackListing, ...listing }), [listing])
  const commissionRows = useMemo(
    () => (Array.isArray(unitData.commissionRecalculation?.currentHierarchy)
      ? unitData.commissionRecalculation.currentHierarchy
      : []),
    [unitData.commissionRecalculation]
  )

  const handleSave = async (payload) => {
    try {
      await onSave?.(payload)
      setShowEditModal(false)
      setAlert({ type: 'success', message: 'Listing details saved to database.' })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save listing details.' })
      throw error
    }
  }

  const handleSettleCancellation = async (settlement) => {
    await handleSave({
      ...unitData,
      ...settlement,
      unitCode: unitData.unit_id || unitData.unitCode,
      lotType: unitData.lot_type,
      pricePerSqm: unitData.installmentPricePerSqm ?? unitData.pricePerSqm,
      installmentPricePerSqm: unitData.installmentPricePerSqm ?? unitData.pricePerSqm,
      cashPricePerSqm: unitData.cashPricePerSqm ?? unitData.pricePerSqm,
      lotAreaSqm: unitData.lotAreaSqm,
      legalMiscRate: unitData.legalMiscRate,
      annualInterestRate: unitData.annualInterestRate,
      reservationFee: unitData.reservationFee,
      oldUnitIds: unitData.old_unit_ids === '-' ? '' : unitData.old_unit_ids,
      cadastralLots: String(unitData.cadastral_lot_no || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      status: 'cancelled',
      statusTransitionAction: 'settle_cancellation',
    })
    setShowSettlementModal(false)
  }

  const submitCancelCancellation = async () => {
    try {
      setAlert({ type: 'loading', message: 'Returning the buyer account to Sold / Active...' })
      await handleSave({
        ...unitData,
        unitCode: unitData.unit_id || unitData.unitCode,
        lotType: unitData.lot_type,
        installmentPricePerSqm: unitData.installmentPricePerSqm ?? unitData.pricePerSqm,
        cashPricePerSqm: unitData.cashPricePerSqm ?? unitData.pricePerSqm,
        lotAreaSqm: unitData.lotAreaSqm,
        legalMiscRate: unitData.legalMiscRate,
        annualInterestRate: unitData.annualInterestRate,
        reservationFee: unitData.reservationFee,
        oldUnitIds: unitData.old_unit_ids === '-' ? '' : unitData.old_unit_ids,
        cadastralLots: String(unitData.cadastral_lot_no || '').split(',').map((item) => item.trim()).filter(Boolean),
        status: 'sold',
        statusTransitionAction: 'cancel_cancellation',
      })
      setConfirmAction(null)
    } catch {}
  }

  const submitMakeAvailable = async () => {
    try {
      setAlert({ type: 'loading', message: 'Closing the cancelled buyer account and returning the unit to Available...' })
      await handleSave({
        ...unitData,
        unitCode: unitData.unit_id || unitData.unitCode,
        lotType: unitData.lot_type,
        installmentPricePerSqm: unitData.installmentPricePerSqm ?? unitData.pricePerSqm,
        cashPricePerSqm: unitData.cashPricePerSqm ?? unitData.pricePerSqm,
        lotAreaSqm: unitData.lotAreaSqm,
        legalMiscRate: unitData.legalMiscRate,
        annualInterestRate: unitData.annualInterestRate,
        reservationFee: unitData.reservationFee,
        oldUnitIds: unitData.old_unit_ids === '-' ? '' : unitData.old_unit_ids,
        cadastralLots: String(unitData.cadastral_lot_no || '').split(',').map((item) => item.trim()).filter(Boolean),
        status: 'available',
        statusTransitionAction: 'reset_to_available',
        confirmSaleDataDeletion: true,
      })
      setConfirmAction(null)
    } catch {}
  }

  const showSettlementButton =
    unitData.listing_status === 'Pending Cancellation' ||
    unitData.listing_status === 'Pending for Cancellation'

  const showAvailableButton = unitData.listing_status === 'Cancelled'

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
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Unit & Status</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Listing Details - {unitData.unit_id || unitData.unitCode || '-'}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Main listing information from the database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={unitData.listing_status} />
            <StatusPill status={unitData.document_status} />

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              <FiEdit3 className="h-4 w-4" />
              Edit
            </button>

            {showSettlementButton ? (
              <button
                type="button"
                onClick={() => setShowSettlementModal(true)}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-black text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              >
                Settlement
              </button>
            ) : null}

            {showSettlementButton ? (
              <button
                type="button"
                onClick={() => setConfirmAction('cancel-cancellation')}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              >
                <FiRotateCcw className="h-4 w-4" />
                Cancel Cancellation
              </button>
            ) : null}

            {showAvailableButton ? (
              <button
                type="button"
                onClick={() => setConfirmAction('make-available')}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              >
                Close Account & Make Available
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <SectionBlock
        title="Unit / Project Information"
        description="Project, unit ID history, cadastral lots, and current listing status."
        icon={FiHome}
      >
        <DetailBox label="Project" value={unitData.project_name} />
        <DetailBox label="Project Location" value={unitData.project_location} />
        <DetailBox label="Administrator" value={unitData.administrator} />
        <DetailBox label="Cadastral Lot No." value={unitData.cadastral_lot_no} />
        <DetailBox label="Unit ID" value={unitData.unit_id || unitData.unitCode} highlight />
        <DetailBox label="Old Unit IDs" value={unitData.old_unit_ids} />
        <DetailBox label="Lot Type" value={unitData.lot_type} />
        <DetailBox label="Listing Status" value={unitData.listing_status} highlight />
      </SectionBlock>

      <SectionBlock
        title="Lot Pricing"
        description="Installment and cash pricing, lot area, LMF, selected contract price, reservation fee, and interest rate."
        icon={FiDollarSign}
      >
        <DetailBox label="Lot Area SQM" value={unitData.lot_area_sqm} />
        <DetailBox label="Installment Price / SQM" value={money(unitData.installmentPricePerSqm ?? unitData.pricePerSqm)} />
        <DetailBox label="Cash Price / SQM" value={money(unitData.cashPricePerSqm ?? unitData.pricePerSqm)} />
        <DetailBox label="Installment TCP" value={money(unitData.installmentTcp ?? unitData.tcpAmount)} />
        <DetailBox label="Cash TCP" value={money(unitData.cashTcp ?? unitData.tcpAmount)} />
        <DetailBox label="LMF Rate" value={unitData.lmf_rate} />
        {unitData.hasClientProfile ? <DetailBox label="Selected Pricing" value={String(unitData.selectedPricingMode || unitData.modeOfPayment || 'installment').toUpperCase()} highlight /> : null}
        {unitData.hasClientProfile ? <DetailBox label="Sale Discount" value={`${Number(unitData.saleDiscountPercentage || 0)}% (${money(unitData.saleDiscountAmount)})`} /> : null}
        <DetailBox label={unitData.hasClientProfile ? "Contract Net Selling Price" : "Installment Net Selling Price"} value={unitData.net_selling_price} />
        <DetailBox label={unitData.hasClientProfile ? "Contract LMF Amount" : "Installment LMF Amount"} value={unitData.lmf_amount} />
        <DetailBox label={unitData.hasClientProfile ? "Contract TCP" : "Installment TCP"} value={unitData.tcp} highlight />
        <DetailBox
          label="Reservation Fee"
          value={typeof unitData.reservationFee === 'number' ? `₱${unitData.reservationFee.toLocaleString('en-PH')}.00` : unitData.reservationFee || '₱0.00'}
        />
        <DetailBox label="Annual Interest Rate" value={unitData.interestRate || `${unitData.annualInterestRate || 0}%`} />
      </SectionBlock>

      <SectionBlock title="Buyer Information" description="Buyer profile and assigned account details." icon={FiUser}>
        <DetailBox label="Buyer Name" value={unitData.buyer_name} />
        <DetailBox label="Spouse / Co-owner" value={unitData.spouse_co_owner} />
        <DetailBox label="Email" value={unitData.email} />
        <DetailBox label="Contact No." value={unitData.contact_no} />
        <DetailBox label="Address" value={unitData.address} long />
        <DetailBox label="Assigned User" value={unitData.assigned_user} />
        <DetailBox label="First Due Date" value={unitData.due_day} />
      </SectionBlock>

      <SectionBlock title="Payment Information" description="Current payment progress and balance." icon={FiCreditCard}>
        <DetailBox label="Total Paid" value={unitData.total_paid} />
        <DetailBox label="Balance" value={unitData.balance} highlight />
        <DetailBox label="Payment Status" value={unitData.payment_status} />
        <DetailBox label="Payment Count" value={unitData.payment_count} />
        <DetailBox label="Latest Payment Date" value={unitData.latest_payment_date} />
        <DetailBox label="Latest Payment Amount" value={unitData.latest_payment_amount} />
      </SectionBlock>

      {unitData.hasCancellationSettlement && ['Cancelled', 'Available'].includes(unitData.listing_status) ? (
        <SectionBlock title="Cancellation Settlement" description="Saved refund, retained amount, and commission history for the cancelled sale." icon={FiDollarSign}>
          <DetailBox label="Refund Type" value={String(unitData.cancellationRefundType || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} />
          <DetailBox label="Cash Collected at Cancellation" value={unitData.cancellationCashCollectedLabel} />
          <DetailBox label="Refunded Amount" value={unitData.refundAmountLabel} highlight />
          <DetailBox label="Discontinued Amount" value={unitData.discontinuedAmountLabel} />
          <DetailBox label="Released Commission" value={unitData.releasedCommissionAtCancellationLabel} />
          <DetailBox label="Refund Date" value={unitData.refundDate} />
          <DetailBox label="Refund Reference" value={unitData.refundReference} />
          <DetailBox label="Cancelled At" value={unitData.cancelledAt} />
          <DetailBox label="Cancellation Reason" value={unitData.cancellationReason} long />
          <DetailBox label="Settlement Notes" value={unitData.cancellationSettlementNotes} long />
          <DetailBox label="Account History" value={unitData.saleDataArchivedAt === '-' ? 'Will remain after returning the unit to Available' : `Retained since ${unitData.saleDataArchivedAt}`} long />
        </SectionBlock>
      ) : null}

      <SectionBlock
        title="Seller / Commission"
        description="Assigned seller details and the saved commission distribution for this sale."
        icon={FiBriefcase}
        action={canRecalculateCommission && (unitData.hasClientProfile || unitData.rawStatus === 'sold') ? (
          <button
            type="button"
            onClick={() => setShowRecalculateModal(true)}
            disabled={isRecalculatingCommission}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <FiRefreshCw className={`h-4 w-4 ${isRecalculatingCommission ? 'animate-spin' : ''}`} />
            {isRecalculatingCommission ? 'Recalculating...' : 'Recalculate Commission'}
          </button>
        ) : null}
      >
        <DetailBox label="Assigned Seller" value={unitData.seller} />
        <DetailBox label="Seller Role" value={unitData.seller_role} />
        <DetailBox label="Seller Group" value={unitData.seller_group} />
        <DetailBox label="Sale Channel" value={unitData.sale_channel} />
        <DetailBox label="Seller Email" value={unitData.seller_email} />
        <DetailBox label="Seller Contact No." value={unitData.seller_contact_no} />
        <DetailBox label="Seller Status" value={unitData.seller_status} />
        <DetailBox label="Accreditation Date" value={unitData.seller_accreditation_date} />

        <div className="sm:col-span-2 xl:col-span-4">
          <CommissionDistribution rows={commissionRows} />
        </div>
      </SectionBlock>

      <SectionBlock title="Documents" description="Document checklist progress." icon={FiFileText}>
        <DetailBox label="Total Documents" value={unitData.total_documents} />
        <DetailBox label="Required Documents" value={unitData.required_documents} />
        <DetailBox label="Submitted Documents" value={unitData.submitted_documents} />
        <DetailBox label="Approved Documents" value={unitData.approved_documents} />
        <DetailBox label="Missing Required" value={unitData.missing_required} />
        <DetailBox label="Document Status" value={unitData.document_status} highlight />
      </SectionBlock>

      <SectionBlock title="System Information" description="Created and updated timestamps." icon={FiSettings}>
        <DetailBox label="Created At" value={unitData.created_at} />
        <DetailBox label="Updated At" value={unitData.updated_at} />
        <DetailBox label="Client Unit Created" value={unitData.client_unit_created} />
        <DetailBox label="Client Unit Updated" value={unitData.client_unit_updated} />
      </SectionBlock>

      <ConfirmActionModal
        open={confirmAction === 'cancel-cancellation'}
        title="Cancel Pending Cancellation?"
        message="The buyer account returns to Sold / Active. Buyer, payment, SOA, document, and commission records remain unchanged."
        confirmLabel="Return to Sold / Active"
        tone="primary"
        isPending={isSaving}
        onClose={() => setConfirmAction(null)}
        onConfirm={submitCancelCancellation}
      />

      <ConfirmActionModal
        open={confirmAction === 'make-available'}
        title="Close Account and Return Unit to Available?"
        message="The cancelled buyer account remains in Account History with its payments, logs, SOA, documents, commissions, receipts, and uploaded files. A future buyer will receive a separate account."
        confirmLabel="Close Account & Make Available"
        tone="primary"
        isPending={isSaving}
        onClose={() => setConfirmAction(null)}
        onConfirm={submitMakeAvailable}
      />

      {showSettlementModal ? (
        <CancellationSettlementModal
          unitId={unitData.unit_id || unitData.unitCode}
          buyerName={unitData.buyer_name}
          cashCollected={unitData.totalPaid}
          commissionBase={unitData.commissionRecalculation?.commissionBase || unitData.netSellingPriceAmount || unitData.tcpAmount}
          onClose={() => setShowSettlementModal(false)}
          onConfirm={handleSettleCancellation}
          isSaving={isSaving}
        />
      ) : null}

      {showEditModal ? (
        <EditUnitStatusModal
          listing={unitData}
          project={project}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      ) : null}

      {canRecalculateCommission && showRecalculateModal ? (
        <RecalculateCommissionModal
          listing={unitData}
          commissionState={unitData.commissionRecalculation || {}}
          isSaving={isRecalculatingCommission}
          onClose={() => setShowRecalculateModal(false)}
          onConfirm={onRecalculateCommission}
        />
      ) : null}
    </div>
  )
}

export default UnitStatus
