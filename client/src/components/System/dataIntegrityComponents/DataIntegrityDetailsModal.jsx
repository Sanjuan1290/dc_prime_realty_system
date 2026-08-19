import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiShield,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const percent = (value) => `${Number(value || 0).toFixed(2)}%`
const dateText = (value) => value ? String(value).slice(0, 10) : '-'

const statusStyles = {
  balanced: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  review: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-red-200 bg-red-50 text-red-800',
}

const severityStyles = {
  review: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
}

const Metric = ({ label, value, helper, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-950',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold opacity-70">{helper}</p> : null}
    </div>
  )
}

const BreakdownRow = ({ label, value, strong = false, note }) => (
  <div className="flex flex-col gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div>
      <p className={`text-sm ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-600'}`}>{label}</p>
      {note ? <p className="mt-0.5 text-xs font-semibold text-slate-400">{note}</p> : null}
    </div>
    <p className={`shrink-0 text-sm ${strong ? 'font-black text-slate-950' : 'font-black text-slate-800'}`}>{value}</p>
  </div>
)

const Section = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="text-base font-black text-slate-950">{title}</h3>
    {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
    <div className="mt-4">{children}</div>
  </section>
)

const Empty = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">{children}</div>
)

const DataIntegrityDetailsModal = ({ accountId, onClose }) => {
  const query = useQuery({
    queryKey: ['data-integrity-account', accountId],
    queryFn: () => useFetch(`/data-integrity/accounts/${accountId}`),
    enabled: Boolean(accountId),
    retry: false,
  })

  const data = query.data?.data || null
  const issuesByCategory = useMemo(() => {
    const grouped = new Map()
    for (const issue of data?.issues || []) {
      if (!grouped.has(issue.category)) grouped.set(issue.category, [])
      grouped.get(issue.category).push(issue)
    }
    return grouped
  }, [data])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Data Integrity Details</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {data ? `${data.unitId} · ${data.buyerName}` : 'Loading account check...'}
            </h2>
            {data ? <p className="mt-1 text-sm font-semibold text-slate-500">{data.projectName} · {data.accountReference}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100" aria-label="Close data integrity details">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {query.isLoading ? <StatusAlert type="loading" message="Running the account integrity check..." /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to run the account integrity check.'} /> : null}

          {data ? (
            <div className="grid gap-5">
              <section className={`rounded-2xl border p-5 ${statusStyles[data.status] || statusStyles.balanced}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    {data.status === 'balanced' ? <FiCheckCircle className="mt-0.5 h-6 w-6 shrink-0" /> : <FiAlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />}
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide">Account Integrity</p>
                      <h3 className="mt-1 text-xl font-black">{data.status === 'balanced' ? 'Balanced' : data.status === 'critical' ? 'Critical inconsistency detected' : 'Needs review'}</h3>
                      <p className="mt-1 text-sm font-semibold opacity-80">
                        {data.status === 'balanced'
                          ? 'No unexplained financial or structural differences were detected by the current checks.'
                          : `${data.issues.length} issue${data.issues.length === 1 ? '' : 's'} detected. Nothing is changed automatically.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={data.links?.account} className="inline-flex h-10 items-center gap-2 rounded-xl border border-current/20 bg-white/70 px-4 text-sm font-black transition hover:bg-white">
                      <FiExternalLink /> Open Buyer Account
                    </a>
                  </div>
                </div>
              </section>

              {(data.issues || []).length ? (
                <Section title="Issues Found" description="These are review findings only. Correct the source record from its normal module rather than from this checker.">
                  <div className="grid gap-3">
                    {data.issues.map((issue, index) => (
                      <div key={`${issue.category}-${issue.entityId || index}-${index}`} className={`rounded-xl border p-4 ${severityStyles[issue.severity] || severityStyles.review}`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide">{issue.severity === 'critical' ? 'Critical' : 'Review'} · {issue.category}</p>
                            <p className="mt-1 font-black">{issue.title}</p>
                            <p className="mt-1 text-sm font-semibold opacity-80">{issue.message}</p>
                          </div>
                          {Number(issue.amountDifference || 0) > 0.009 ? <span className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-sm font-black">Difference {money(issue.amountDifference)}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Effective TCP" value={money(data.financial?.effectiveTcp)} helper="Saved contract TCP after the contract pricing choices." tone="blue" />
                <Metric label="Verified Cash" value={money(data.financial?.verifiedCash)} helper="Actual verified payment records." tone="green" />
                <Metric label="Earned DP Discount" value={money(data.financial?.earnedDpDiscount)} helper={`Approved ${money(data.financial?.approvedDpDiscount)}`} tone="amber" />
                <Metric label="Commission Progress" value={percent(data.financial?.commissionProgress)} helper={`Recognized settled value ${money(data.financial?.settledValue)}`} />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Section title="Contract & Discounts" description="Discounts and waivers are shown separately so they are never mistaken for missing cash.">
                  <BreakdownRow label="Base Selling Price" value={money(data.financial?.baseSellingPrice)} />
                  <BreakdownRow label={`Sale Discount (${Number(data.financial?.saleDiscountPercentage || 0).toFixed(2)}%)`} value={`-${money(data.financial?.saleDiscountAmount)}`} note="Contract discount; already reflected in the saved net selling price/TCP." />
                  <BreakdownRow label="Net Selling Price" value={money(data.financial?.netSellingPrice)} />
                  <BreakdownRow label="Legal / Misc Fee" value={money(data.financial?.legalMiscFeeAmount)} />
                  {Number(data.financial?.lmfWaivedAmount || 0) > 0 ? <BreakdownRow label="LMF Waiver" value={`-${money(data.financial?.lmfWaivedAmount)}`} note="Approved contract adjustment; not a cash payment." /> : null}
                  <BreakdownRow label="Effective TCP" value={money(data.financial?.effectiveTcp)} strong />
                </Section>

                <Section title="Downpayment Structure" description="Reservation credit changes the cash still required for DP; it is not counted twice as extra settlement value.">
                  <BreakdownRow label="DP Target" value={money(data.financial?.downpaymentTarget)} />
                  <BreakdownRow label="Approved DP Discount" value={`-${money(data.financial?.approvedDpDiscount)}`} />
                  <BreakdownRow label="DP After Discount" value={money(data.financial?.downpaymentAfterDiscount)} />
                  <BreakdownRow label="Reservation Fee Credit Toward DP" value={`-${money(data.financial?.reservationFeeCredit)}`} note={`Reservation fee: ${money(data.financial?.reservationFee)}`} />
                  <BreakdownRow label="Remaining DP Cash Required" value={money(data.financial?.remainingDpCashRequired)} strong />
                  <BreakdownRow label="DP Discount Earned to Date" value={money(data.financial?.earnedDpDiscount)} note="Only the earned portion is added to commission payment progress." />
                </Section>
              </div>

              <Section title="Settlement Used for Commission Progress" description="This mirrors the system's discount-aware commission progress concept. Sale discounts and LMF waivers are already embedded in contract TCP and are not added again as cash.">
                <BreakdownRow label="Verified Cash Paid" value={money(data.financial?.verifiedCash)} />
                <BreakdownRow label="Earned DP Discount" value={`+${money(data.financial?.earnedDpDiscount)}`} />
                <BreakdownRow label="Recognized Settled Value" value={money(data.financial?.settledValue)} strong />
                <BreakdownRow label="Effective TCP" value={money(data.financial?.effectiveTcp)} />
                <BreakdownRow label="Contract Remaining for Progress" value={money(data.financial?.contractRemaining)} />
                <BreakdownRow label="Commission Payment Progress" value={percent(data.financial?.commissionProgress)} strong />
              </Section>

              <Section title="Payments & SOA" description="Verified non-balloon payments should be fully allocated, stored SOA paid amounts should match verified allocations, and overdue daily-penalty caches should be current.">
                {data.payments?.length ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-[820px] w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Date / Type</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-right">Difference</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{data.payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 font-black text-slate-900">{payment.reference}</td><td className="px-4 py-3"><p className="font-semibold text-slate-700">{dateText(payment.date)}</p><p className="text-xs font-semibold text-slate-400">{payment.type} · {payment.status}</p></td><td className="px-4 py-3 text-right font-black">{money(payment.amount)}</td><td className="px-4 py-3 text-right font-black">{payment.type === 'balloon' ? 'N/A' : money(payment.allocationTotal)}</td><td className={`px-4 py-3 text-right font-black ${Number(payment.difference || 0) > 0.05 ? 'text-red-700' : 'text-emerald-700'}`}>{payment.type === 'balloon' ? '—' : money(payment.difference)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <Empty>No payment records for this account.</Empty>}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="SOA Rows" value={data.counts?.schedules || 0} />
                  <Metric label="Schedule Discounts" value={money(data.financial?.scheduleDiscountAmount)} helper="Latest stored SOA generation." tone="amber" />
                  <Metric label="Penalty Waived" value={money(data.financial?.penaltyWaivedAmount)} helper="Approved penalty relief; not a payment." />
                  <Metric label="Payment Allocation Issues" value={issuesByCategory.get('paymentsSoa')?.length || 0} tone={(issuesByCategory.get('paymentsSoa')?.length || 0) ? 'amber' : 'green'} />
                </div>
              </Section>

              <Section title="Commissions" description="Released totals, deductions, remaining commission, payment progress, and historical release dates are checked independently.">
                {data.commissions?.length ? <div className="grid gap-3">{data.commissions.map((commission) => (
                  <article key={commission.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div><p className="font-black text-slate-950">Commission #{commission.id}</p><p className="text-xs font-semibold text-slate-500">{commission.role} · {commission.sellerType} · {commission.status}</p></div>
                      <div className="text-left sm:text-right"><p className="text-sm font-black text-slate-950">Gross {money(commission.gross)}</p><p className="text-xs font-semibold text-slate-500">Progress {percent(commission.expectedPaymentPercent)}</p></div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Stored Released" value={money(commission.storedReleased)} /><Metric label="Stored Remaining" value={money(commission.storedRemaining)} /><Metric label="Stored Progress" value={percent(commission.storedPaymentPercent)} /></div>
                    {commission.releases?.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-[720px] w-full text-xs"><thead className="text-left font-black uppercase tracking-wide text-slate-400"><tr><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Actual Date</th><th className="py-2 pr-3">Entry</th><th className="py-2 text-right">Net</th></tr></thead><tbody>{commission.releases.map((release) => <tr key={release.id} className="border-t border-slate-200"><td className="py-2 pr-3 font-black text-slate-700">{release.stage}</td><td className="py-2 pr-3 font-semibold">{release.status}</td><td className="py-2 pr-3 font-semibold">{release.actualReleaseDate || '-'}</td><td className="py-2 pr-3 font-semibold">{release.entryMode === 'historical' ? 'Historical' : 'Live'}</td><td className="py-2 text-right font-black">{money(release.netAmount)}</td></tr>)}</tbody></table></div> : null}
                  </article>
                ))}</div> : <Empty>No commission records for this buyer account.</Empty>}
              </Section>

              <Section title="Proof of Income" description="Receipt totals must equal included released stages, and the receipt date cannot predate the latest included release.">
                {data.receipts?.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Receipt Date</th><th className="px-4 py-3 text-right">Receipt Total</th><th className="px-4 py-3 text-right">Included Releases</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.receipts.map((receipt) => <tr key={receipt.id}><td className="px-4 py-3 font-black">{receipt.reference || `#${receipt.id}`}</td><td className="px-4 py-3 font-semibold">{receipt.receiptDate || '-'}</td><td className="px-4 py-3 text-right font-black">{money(receipt.totalAmount)}</td><td className={`px-4 py-3 text-right font-black ${Number(Math.abs(receipt.totalAmount - receipt.itemTotal)) > 0.05 ? 'text-red-700' : 'text-emerald-700'}`}>{money(receipt.itemTotal)}</td><td className="px-4 py-3 font-semibold">{receipt.status}</td></tr>)}</tbody></table></div> : <Empty>No Proof of Income receipts for this account.</Empty>}
              </Section>

              <Section title="Documents & Protected Files" description="This check validates database storage metadata only. It does not consume Cloudinary or Perception Point quota by re-scanning files.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Buyer Document Files" value={data.files?.clientDocuments || 0} />
                  <Metric label="Payment Proofs" value={data.files?.paymentProofs || 0} />
                  <Metric label="Proof of Income Signed Copies" value={data.files?.proofOfIncomeSignedCopies || 0} />
                  <Metric label="Payment Acknowledgements" value={data.files?.paymentAcknowledgements || 0} />
                </div>
              </Section>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FiShield /> Read-only integrity checker</div>
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Close</button>
        </footer>
      </div>
    </div>
  )
}

export default DataIntegrityDetailsModal
