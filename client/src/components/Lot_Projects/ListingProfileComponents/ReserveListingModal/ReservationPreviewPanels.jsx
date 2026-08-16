import { FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi'
import { getSellerRoleLabel } from '../../../../config/sellerRoles'
import { money } from './reserveUtils'
import { SectionCard } from './ReserveShared'

const PreviewCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }
  const labelTones = {
    slate: 'text-slate-500',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className={`text-xs font-black uppercase ${labelTones[tone] || labelTones.slate}`}>{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

const HierarchyPreviewContent = ({ preview, isLoading = false, error = null, hasSelectedAgent = false }) => {
  const hierarchy = preview?.hierarchy || []

  if (!hasSelectedAgent) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="font-black text-slate-700">Select a Seller / Group to calculate the commission.</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">In-House recipients or the single External Group recipient will appear here.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 p-8 text-sm font-black text-slate-600">
        <FiLoader className="animate-spin" />
        Calculating commission structure...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
        <div className="flex gap-2"><FiAlertCircle className="mt-0.5 shrink-0" /><p>{error}</p></div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PreviewCard label="Commission Base (Before Discount)" value={money(preview?.commissionBase)} />
        <PreviewCard label="Group Pool" value={`${Number(preview?.poolRate || 0).toFixed(2)}%`} tone="blue" />
        <PreviewCard label="Total Allocated" value={`${Number(preview?.allocatedRate || 0).toFixed(2)}%`} tone={preview?.isValid ? 'emerald' : 'red'} />
        <PreviewCard label="Unallocated" value={`${Number(preview?.unallocatedRate || 0).toFixed(2)}%`} tone="amber" />
        <PreviewCard label="Estimated Total" value={money(preview?.estimatedTotal)} tone="emerald" />
      </div>

      {preview?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          {preview.warnings.map((warning) => <p key={warning} className="text-sm font-semibold text-amber-800">{warning}</p>)}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[780px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Order', 'Seller', 'Role', 'Commission Type', 'Rate', 'Estimated Amount'].map((head) => (
                <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hierarchy.map((row) => (
              <tr key={`${row.order}-${row.accreditedSellerId}`}>
                <td className="px-4 py-4 font-black text-slate-500">{row.order}</td>
                <td className="px-4 py-4">
                  <p className="font-black text-slate-950">{row.sellerName}</p>
                  {row.isSystemDummy ? (
                    <p className="text-xs font-semibold text-blue-600">System agent · Beneficiary: {row.beneficiaryName}</p>
                  ) : row.childSellerName ? (
                    <p className="text-xs font-semibold text-slate-500">Override from: {row.childSellerName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-4 font-semibold capitalize text-slate-700">{getSellerRoleLabel(row.role)}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${row.commissionType === 'direct' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                    {row.commissionType === 'direct' ? 'Direct' : 'Override'}
                  </span>
                </td>
                <td className="px-4 py-4 font-black text-slate-800">{Number(row.rate || 0).toFixed(2)}%</td>
                <td className="px-4 py-4 font-black text-slate-950">{money(row.estimatedAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {hierarchy.map((row) => (
          <article key={`${row.order}-${row.accreditedSellerId}`} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{row.order}. {row.sellerName}</p>
                <p className="text-xs font-semibold capitalize text-slate-500">{getSellerRoleLabel(row.role)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.commissionType === 'direct' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                {row.commissionType}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-xs font-bold text-slate-500">Rate</p><p className="font-black text-slate-950">{Number(row.rate || 0).toFixed(2)}%</p></div>
              <div><p className="text-xs font-bold text-slate-500">Estimated</p><p className="font-black text-slate-950">{money(row.estimatedAmount)}</p></div>
            </div>
            {row.isSystemDummy ? <p className="mt-3 text-xs font-semibold text-blue-600">Beneficiary: {row.beneficiaryName}</p> : null}
          </article>
        ))}
      </div>

      {preview?.isValid ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          <FiCheckCircle />
          Commission structure is ready for reservation.
        </div>
      ) : null}
    </div>
  )
}

export const ReservationCommissionPreview = ({
  preview,
  isLoading = false,
  error = null,
  hasSelectedAgent = false,
  title = 'Automatic Hierarchy Commission Preview',
}) => (
  <SectionCard title={title} description="Commission Base is lot area × selected price per SQM before sale discount and LMF.">
    <HierarchyPreviewContent preview={preview} isLoading={isLoading} error={error} hasSelectedAgent={hasSelectedAgent} />
  </SectionCard>
)

export const ReservationPaymentPreview = ({ contractPricing = {}, paymentForm = {}, tcp = 0, paymentPreview = {} }) => {
  const isCash = String(paymentForm.modeOfPayment || '').toLowerCase() === 'cash'
  const lmfTreatment = paymentPreview.legalMiscFeeMode === 'separate_soa_row'
    ? 'Separate SOA row'
    : isCash
      ? 'Included in cash balance'
      : 'Included in monthly'

  return (
    <SectionCard title="Payment Preview">
      <div className="mb-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <PreviewCard label="Base Selling Price" value={money(contractPricing?.baseSellingPrice)} />
        <PreviewCard label={`Sale Discount (${Number(paymentForm.saleDiscountPercentage || 0)}%)`} value={money(contractPricing?.saleDiscountAmount)} tone="amber" />
        <PreviewCard label="Net Selling Price" value={money(contractPricing?.netSellingPrice)} />
        <PreviewCard label={`LMF (${Number(contractPricing?.legalMiscRate || 0).toFixed(2)}%)`} value={money(contractPricing?.lmfAmount)} />
        <PreviewCard label="Final TCP" value={money(tcp)} tone="blue" />
      </div>

      {isCash ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} />
          <PreviewCard label="LMF Treatment" value={lmfTreatment} />
          <PreviewCard label="Full Payment Balance" value={money(paymentPreview.fullPaymentAmount)} tone="blue" />
          <PreviewCard label="Full Payment Due" value={paymentForm.firstDueDate || '-'} tone="emerald" />
          <PreviewCard label="Interest" value="0%" tone="emerald" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
          <PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} />
          <PreviewCard label="LMF Treatment" value={lmfTreatment} />
          <PreviewCard label="DP Target" value={money(paymentPreview.dpTarget)} />
          <PreviewCard label="Downpayment Discount" value={money(paymentPreview.dpDiscountAmount)} tone="amber" />
          <PreviewCard label="DP After Discount" value={money(paymentPreview.discountedDpTarget)} />
          <PreviewCard label="Reservation Applied to DP" value={money(paymentPreview.reservationFeeDownpaymentCredit)} tone={paymentPreview.reservationFeeAppliedToDownpayment ? 'amber' : 'slate'} />
          <PreviewCard label="Remaining DP Payable" value={money(paymentPreview.dpNet)} />
          <PreviewCard label="DP Amount per Term" value={money(paymentPreview.dpAmountPerTerm)} tone="emerald" />
          <PreviewCard label="Balance" value={money(paymentPreview.balance)} tone="blue" />
          <PreviewCard label="Monthly" value={money(paymentPreview.monthlyAmortization)} tone="emerald" />
        </div>
      )}
    </SectionCard>
  )
}

export { PreviewCard }
