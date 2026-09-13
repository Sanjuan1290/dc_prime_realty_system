import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import PrintPageShell from '../../components/Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell'
import { useFetch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const percent = (value) => `${Number(value || 0).toFixed(2)}%`
const dateOnly = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : '-'
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const titleCase = (value) => String(value || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const Cell = ({ children, strong = false, right = false, wrap = false }) => (
  <td className={`border border-slate-300 px-1.5 py-1.5 align-top ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'} ${wrap ? 'whitespace-normal' : ''}`}>{children}</td>
)

const PrintTable = ({ headers, rows, emptyText = 'No records.', widths = [] }) => (
  <table className="report-table mt-3 w-full table-fixed border-collapse text-[7.5px] leading-[1.35]">
    {widths.length ? <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup> : null}
    <thead>
      <tr className="bg-slate-100">
        {headers.map((head) => <th key={head} className="border border-slate-300 px-1.5 py-1.5 text-left text-[6.8px] font-black uppercase tracking-wide text-slate-600">{head}</th>)}
      </tr>
    </thead>
    <tbody>{rows.length ? rows : <tr><td colSpan={headers.length} className="border border-slate-300 px-2 py-8 text-center font-bold text-slate-500">{emptyText}</td></tr>}</tbody>
  </table>
)

const ReportPage = ({ title, subtitle, section, totalSections, children }) => (
  <section className="print-export-page mx-auto w-[297mm] bg-white px-[9mm] py-[8mm] text-black shadow-lg print:shadow-none">
    <header className="flex items-start justify-between gap-5 border-b-2 border-slate-900 pb-3">
      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-700">D&amp;C Prime Realty</p>
        <h1 className="mt-1 text-[15px] font-black uppercase tracking-tight text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[230mm] text-[7.5px] font-semibold leading-relaxed text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[7px] font-black uppercase tracking-wide text-slate-500">Confidential Management Report</p>
        <p className="mt-1 text-[7px] font-semibold text-slate-500">Section {section} of {totalSections}</p>
      </div>
    </header>
    <div className="pt-4">{children}</div>
    <footer className="mt-5 flex items-center justify-between border-t border-slate-300 pt-2 text-[6.5px] font-semibold text-slate-500">
      <span>D&amp;C Prime Realty — Confidential Financial Report</span>
      <span>Section {section} of {totalSections}</span>
    </footer>
  </section>
)

const MetricCard = ({ label, value, helper, emphasis = false }) => (
  <div className={`rounded-md border p-2.5 ${emphasis ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-300 bg-white'}`}>
    <p className={`text-[6.5px] font-black uppercase tracking-wide ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p>
    <p className="mt-1 text-[11px] font-black tabular-nums">{value}</p>
    {helper ? <p className={`mt-1 text-[6.5px] font-semibold leading-relaxed ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{helper}</p> : null}
  </div>
)

const Bridge = ({ title, scope, items }) => (
  <div className="rounded-lg border border-slate-300 p-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[9px] font-black uppercase text-slate-950">{title}</h2>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[6px] font-black uppercase tracking-wide text-slate-600">{scope}</span>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((item) => <MetricCard key={item.label} {...item} />)}
    </div>
  </div>
)

const ReportsPrintPage = () => {
  const params = new URLSearchParams(window.location.search)
  const query = params.toString()
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['system-report-print', query],
    queryFn: () => useFetch(`/projects/reports?${query}`),
    enabled: Boolean(from && to),
  })
  const payload = data?.data || {}
  const summary = payload.summary || {}
  const filters = payload.filters || {}
  const projectName = filters.projectId ? (payload.options?.projects || []).find((row) => Number(row.id) === Number(filters.projectId))?.name : 'All Projects'
  const sellerName = filters.sellerId ? (payload.options?.sellers || []).find((row) => Number(row.id) === Number(filters.sellerId))?.name : 'All Sellers'
  const generatedBy = payload.generated?.by?.name || 'Administrator'
  const generatedAt = payload.generated?.at ? dateTime(payload.generated.at) : dateTime(new Date().toISOString())
  const totalSections = 8

  useEffect(() => { document.title = `DC Prime Management Report ${from} to ${to}` }, [from, to])

  if (isLoading) return <PrintPageShell title="D&C Prime Reports" pageOrientation="landscape"><div className="p-6 text-sm font-semibold">Preparing professional report...</div></PrintPageShell>
  if (isError) return <PrintPageShell title="D&C Prime Reports" pageOrientation="landscape"><div className="p-6 text-sm font-semibold text-red-700">{error?.message || 'Failed to load report.'}</div></PrintPageShell>

  const reportSubtitle = `${from} to ${to} · ${projectName || 'All Projects'} · ${sellerName || 'All Sellers'}${filters.search ? ` · Search: ${filters.search}` : ''} · Generated by ${generatedBy} · ${generatedAt}`
  const commissionLess = Number(summary.commissionNonPayable || 0) + Number(summary.commissionDeductions || 0)
  const commissionDifference = Number(summary.commissionReconciliationDifference || 0)

  return <PrintPageShell title="D&C Prime Management Report" pageOrientation="landscape">
    <style>{`
      @media print {
        .report-table thead { display: table-header-group; }
        .report-table tfoot { display: table-footer-group; }
        .report-table tr { break-inside: avoid; page-break-inside: avoid; }
        .print-export-page { min-height: 210mm; break-after: page; page-break-after: always; }
        .print-export-page:last-child { break-after: auto; page-break-after: auto; }
      }
    `}</style>

    <ReportPage title="Management Report — Executive Summary" subtitle={reportSubtitle} section={1} totalSections={totalSections}>
      <div className="grid grid-cols-2 gap-3">
        <Bridge title="Sales Performance" scope="IN SELECTED RANGE" items={[
          { label: 'Gross Contracted Value', value: money(summary.grossContractedValue), helper: `${number(summary.reservationCount)} reservation(s)` },
          { label: 'Less: Cancelled from Selected Sales', value: money(summary.cohortCancelledValue), helper: `${number(summary.cohortCancelledCount)} cancelled selected sale(s)` },
          { label: 'Net Active Contract Value', value: money(summary.netActiveContractValue), helper: 'Gross selected sales less cancelled selected sales', emphasis: true },
        ]} />
        <Bridge title="Cash Movement" scope="IN SELECTED RANGE" items={[
          { label: 'Verified Collections', value: money(summary.collectedInRange), helper: 'Verified payment date falls in range' },
          { label: 'Less: Refunds Paid', value: money(summary.refundsPaidInRange), helper: 'Refund date falls in range' },
          { label: 'Net Cash Movement', value: money(summary.netCashMovement), helper: 'Collections less refunds paid', emphasis: true },
        ]} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MetricCard label={`Outstanding as of ${to}`} value={money(summary.outstandingAmount)} helper="Active buyer-account receivables" />
        <MetricCard label={`Net Cumulative Cash as of ${to}`} value={money(summary.netCumulativeCash)} helper={`${money(summary.cumulativeCollected)} collected less ${money(summary.cumulativeRefunded)} refunded`} />
        <MetricCard label="Cancellation Activity in Range" value={number(summary.cancellationActivityCount)} helper={money(summary.cancellationActivityValue)} />
        <MetricCard label="Retained / Discontinued in Range" value={money(summary.discontinuedAmount)} helper="Retained cash from cancellation activity" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Bridge title="Commission from Sales in Selected Range" scope="SAME SALES COHORT" items={[
          { label: 'Gross Commission Created', value: money(summary.commissionGenerated), helper: 'Original gross commission from selected sales' },
          { label: 'Less: Non-Payable / Deductions', value: money(commissionLess), helper: `Forfeited ${money(summary.commissionForfeitedOnCancellation)} · Cancelled ${money(summary.commissionCancelled)} · Deductions ${money(summary.commissionDeductions)}` },
          { label: 'Net Commission Payable', value: money(summary.commissionNetPayable), helper: 'Released plus unreleased commission still payable', emphasis: true },
        ]} />
        <Bridge title="Status of Net Commission Payable" scope={`AS OF ${to}`} items={[
          { label: 'Released', value: money(summary.commissionReleased), helper: 'Released from selected sales by report end' },
          { label: 'Unreleased / Remaining', value: money(summary.commissionRemaining), helper: `Eligible ${money(summary.eligibleUnreleased)} · Earned on cancellation ${money(summary.commissionEarnedOnCancellation)}` },
          { label: 'Net Commission Payable', value: money(summary.commissionNetPayable), helper: 'Released + remaining', emphasis: true },
        ]} />
      </div>
      {Math.abs(commissionDifference) > 0.01 ? <p className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-[7px] font-black text-red-800">Commission reconciliation difference requiring review: {money(commissionDifference)}</p> : null}

      <h2 className="mt-5 text-[9px] font-black uppercase text-slate-950">Project Snapshot</h2>
      <PrintTable
        headers={['Project', 'Reservations', 'Gross Contracted', 'Cancelled from Cohort', 'Net Active Contract', 'Collections', 'Refunds', 'Net Cash', 'Outstanding']}
        rows={(payload.projectBreakdown || []).map((row) => <tr key={row.projectId}>
          <Cell strong>{row.project}</Cell><Cell>{number(row.reservations)}</Cell><Cell right>{money(row.grossContractedValue)}</Cell><Cell right>{money(row.cohortCancelledValue)}</Cell><Cell right strong>{money(row.netActiveContractValue)}</Cell><Cell right>{money(row.collectedInRange)}</Cell><Cell right>{money(row.refundsInRange)}</Cell><Cell right strong>{money(row.netCashMovement)}</Cell><Cell right strong>{money(row.outstanding)}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Sales & Reservations" subtitle={`${reportSubtitle} · Sales cohort is based on reservation date.`} section={2} totalSections={totalSections}>
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Reservations" value={number(summary.reservationCount)} />
        <MetricCard label="Gross Contracted Value" value={money(summary.grossContractedValue)} />
        <MetricCard label="Cancelled from Selected Sales" value={money(summary.cohortCancelledValue)} />
        <MetricCard label="Net Active Contract Value" value={money(summary.netActiveContractValue)} emphasis />
      </div>
      <PrintTable
        headers={['Reserved', 'Project', 'Unit', 'Buyer', 'Seller', 'Mode', 'Gross TCP', 'Cancelled as of End', 'Cancelled Value', 'Net Contract', 'Account State']}
        rows={(payload.sales || []).map((row) => <tr key={row.id}>
          <Cell>{dateTime(row.reservationDate)}</Cell><Cell>{row.project}</Cell><Cell strong>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell>{row.seller}</Cell><Cell>{row.modeOfPayment}</Cell><Cell right strong>{money(row.tcp)}</Cell><Cell>{row.cancelledAsOf ? 'Yes' : 'No'}</Cell><Cell right>{money(row.cohortCancelledValue)}</Cell><Cell right strong>{money(row.netContractValue)}</Cell><Cell>{titleCase(row.accountStatus || row.reservationStatus)}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Collections" subtitle={`${reportSubtitle} · Verified payment totals are based on payment date.`} section={3} totalSections={totalSections}>
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Verified Collections in Range" value={money(summary.collectedInRange)} />
        <MetricCard label="Refunds Paid in Range" value={money(summary.refundsPaidInRange)} />
        <MetricCard label="Net Cash Movement" value={money(summary.netCashMovement)} emphasis />
        <MetricCard label={`Net Cumulative Cash as of ${to}`} value={money(summary.netCumulativeCash)} />
      </div>
      <PrintTable
        headers={['Date', 'Project', 'Unit', 'Buyer', 'Account', 'Type', 'Method', 'Bank', 'Reference', 'Amount', 'Status', 'Verified By', 'Verified At']}
        rows={(payload.payments || []).map((row) => <tr key={row.id}>
          <Cell>{dateOnly(row.paymentDate)}</Cell><Cell>{row.project}</Cell><Cell>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell>{row.accountReference}</Cell><Cell>{row.type}</Cell><Cell>{row.method}</Cell><Cell>{row.bank || '-'}</Cell><Cell>{row.reference || '-'}</Cell><Cell right strong>{money(row.amount)}</Cell><Cell>{row.status}</Cell><Cell>{row.verifiedBy}</Cell><Cell>{dateTime(row.verifiedAt)}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title={`Outstanding Accounts — As of ${to}`} subtitle={`${reportSubtitle} · Snapshot includes active buyer accounts only.`} section={4} totalSections={totalSections}>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Outstanding Receivables" value={money(summary.outstandingAmount)} emphasis />
        <MetricCard label="Cumulative Verified Collections" value={money(summary.cumulativeCollected)} />
        <MetricCard label="Cumulative Refunds" value={money(summary.cumulativeRefunded)} />
      </div>
      <PrintTable
        headers={['Project', 'Unit', 'Buyer', 'Account', 'Seller', 'Contract Value', 'Cumulative Paid', 'Outstanding']}
        rows={(payload.outstandingAccounts || []).map((row) => <tr key={row.accountId}>
          <Cell>{row.project}</Cell><Cell strong>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell>{row.accountReference}</Cell><Cell>{row.seller}</Cell><Cell right>{money(row.contractValue)}</Cell><Cell right>{money(row.cumulativePaid)}</Cell><Cell right strong>{money(row.outstanding)}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Cancellations & Refunds" subtitle={`${reportSubtitle} · Cancellation activity uses cancellation date; refund cash movement uses refund date.`} section={5} totalSections={totalSections}>
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Cancellation Events in Range" value={number(summary.cancellationActivityCount)} />
        <MetricCard label="Cancelled Contract Value in Range" value={money(summary.cancellationActivityValue)} />
        <MetricCard label="Refunds Paid in Range" value={money(summary.refundsPaidInRange)} />
        <MetricCard label="Retained / Discontinued in Range" value={money(summary.discontinuedAmount)} />
      </div>

      <h2 className="mt-5 text-[9px] font-black uppercase text-slate-950">Cancellation Activity</h2>
      <PrintTable
        headers={['Cancelled', 'Project', 'Unit', 'Buyer', 'Seller', 'Account', 'Type', 'Cancelled Value', 'Cash Collected', 'Refund', 'Retained', 'Refund Date', 'Reference', 'Reason']}
        rows={(payload.cancellations || []).map((row) => <tr key={row.id}>
          <Cell>{dateTime(row.cancellationDate)}</Cell><Cell>{row.project}</Cell><Cell>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell>{row.seller}</Cell><Cell>{row.accountReference}</Cell><Cell>{row.cancellationType}</Cell><Cell right strong>{money(row.cancelledValue)}</Cell><Cell right>{money(row.cashCollected)}</Cell><Cell right>{money(row.refundAmount)}</Cell><Cell right strong>{money(row.discontinuedAmount)}</Cell><Cell>{dateOnly(row.refundDate)}</Cell><Cell>{row.refundReference || '-'}</Cell><Cell wrap>{row.reason || '-'}</Cell>
        </tr>)}
      />

      <h2 className="mt-5 text-[9px] font-black uppercase text-slate-950">Refunds Paid in Selected Range</h2>
      <PrintTable
        headers={['Refund Date', 'Project', 'Unit', 'Buyer', 'Seller', 'Account', 'Cancellation Date', 'Refund Paid', 'Reference', 'Refund Type']}
        rows={(payload.refundsPaid || []).map((row) => <tr key={`refund-${row.id}`}>
          <Cell>{dateOnly(row.refundDate)}</Cell><Cell>{row.project}</Cell><Cell>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell>{row.seller}</Cell><Cell>{row.accountReference}</Cell><Cell>{dateTime(row.cancellationDate)}</Cell><Cell right strong>{money(row.refundAmount)}</Cell><Cell>{row.refundReference || '-'}</Cell><Cell>{row.refundType}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Commission from Sales in Selected Range" subtitle={`${reportSubtitle} · All commission figures below use the same selected sales cohort and are evaluated as of ${to}.`} section={6} totalSections={totalSections}>
      <div className="grid grid-cols-2 gap-3">
        <Bridge title="Commission Liability Reconciliation" scope="SAME SALES COHORT" items={[
          { label: 'Gross Commission Created', value: money(summary.commissionGenerated) },
          { label: 'Less: Non-Payable / Deductions', value: money(commissionLess), helper: `Forfeited ${money(summary.commissionForfeitedOnCancellation)} · Cancelled ${money(summary.commissionCancelled)} · Deductions ${money(summary.commissionDeductions)}` },
          { label: 'Net Commission Payable', value: money(summary.commissionNetPayable), emphasis: true },
        ]} />
        <Bridge title="Status of Net Commission Payable" scope={`AS OF ${to}`} items={[
          { label: 'Released', value: money(summary.commissionReleased) },
          { label: 'Unreleased / Remaining', value: money(summary.commissionRemaining), helper: `Eligible ${money(summary.eligibleUnreleased)} · Earned on cancellation ${money(summary.commissionEarnedOnCancellation)}` },
          { label: 'Net Commission Payable', value: money(summary.commissionNetPayable), emphasis: true },
        ]} />
      </div>
      {Math.abs(commissionDifference) > 0.01 ? <p className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-[7px] font-black text-red-800">Commission reconciliation difference requiring review: {money(commissionDifference)}</p> : null}
      <PrintTable
        headers={['Project', 'Unit', 'Buyer', 'Recipient', 'Role', 'Group', 'Stage', 'Trigger', 'Release %', 'Gross', 'Deduction', 'Net Amount', 'Payment %', 'Status as of End', 'Scheduled', 'Actual Release', 'Released By']}
        rows={(payload.commissionCohortReleases || []).map((row) => <tr key={row.id}>
          <Cell>{row.project}</Cell><Cell>{row.unit}</Cell><Cell>{row.buyer}</Cell><Cell strong>{row.seller}</Cell><Cell>{row.role}</Cell><Cell>{row.sellerGroup}</Cell><Cell>{row.stage}</Cell><Cell>{percent(row.triggerPercent)}</Cell><Cell>{percent(row.releasePercent)}</Cell><Cell right>{money(row.grossAmount)}</Cell><Cell right>{money(row.deductionAmount)}</Cell><Cell right strong>{money(row.netAmount)}</Cell><Cell>{percent(row.paymentPercent)}</Cell><Cell>{row.status}</Cell><Cell>{dateOnly(row.scheduledReleaseDate)}</Cell><Cell>{dateOnly(row.actualReleaseDate)}</Cell><Cell>{row.releasedBy}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Seller Performance" subtitle={`${reportSubtitle} · Ranked by net active contract value for the selected sales cohort.`} section={7} totalSections={totalSections}>
      <PrintTable
        headers={['Seller', 'Group', 'Reservations', 'Cancelled', 'Cancellation Rate', 'Gross Contracted', 'Cancelled Value', 'Net Active Sales', 'Collections', 'Refunds', 'Net Cash', 'Gross Commission', 'Non-Payable', 'Deductions', 'Net Payable', 'Released', 'Remaining']}
        rows={(payload.sellerPerformance || []).map((row, index) => <tr key={`${row.sellerId}-${index}`}>
          <Cell strong>{row.seller}</Cell><Cell>{row.sellerGroup}</Cell><Cell>{number(row.reservations)}</Cell><Cell>{number(row.cancelledReservations)}</Cell><Cell>{percent(row.cancellationRate)}</Cell><Cell right>{money(row.grossContractedValue)}</Cell><Cell right>{money(row.cancelledValue)}</Cell><Cell right strong>{money(row.netActiveSales)}</Cell><Cell right>{money(row.collectedInRange)}</Cell><Cell right>{money(row.refundsInRange)}</Cell><Cell right strong>{money(row.netCashMovement)}</Cell><Cell right>{money(row.grossCommission)}</Cell><Cell right>{money(row.commissionNonPayable)}</Cell><Cell right>{money(row.commissionDeductions)}</Cell><Cell right strong>{money(row.commissionNetPayable)}</Cell><Cell right>{money(row.releasedCommission)}</Cell><Cell right>{money(row.commissionRemaining)}</Cell>
        </tr>)}
      />
    </ReportPage>

    <ReportPage title="Project Breakdown" subtitle={`${reportSubtitle} · Reconciled management view by project.`} section={8} totalSections={totalSections}>
      <PrintTable
        headers={['Project', 'Reservations', 'Cancelled Sales', 'Gross Contracted', 'Cancelled from Cohort', 'Net Active Contract', 'Cancellation Activity', 'Collections', 'Refunds', 'Net Cash', 'Cumulative Net Cash', 'Outstanding', 'Gross Commission', 'Non-Payable', 'Deductions', 'Net Payable', 'Released', 'Remaining']}
        rows={(payload.projectBreakdown || []).map((row) => <tr key={row.projectId}>
          <Cell strong>{row.project}</Cell><Cell>{number(row.reservations)}</Cell><Cell>{number(row.cohortCancelled)}</Cell><Cell right>{money(row.grossContractedValue)}</Cell><Cell right>{money(row.cohortCancelledValue)}</Cell><Cell right strong>{money(row.netActiveContractValue)}</Cell><Cell>{number(row.cancellationActivity)}</Cell><Cell right>{money(row.collectedInRange)}</Cell><Cell right>{money(row.refundsInRange)}</Cell><Cell right strong>{money(row.netCashMovement)}</Cell><Cell right>{money(row.netCumulativeCash)}</Cell><Cell right strong>{money(row.outstanding)}</Cell><Cell right>{money(row.commissionGenerated)}</Cell><Cell right>{money(row.commissionNonPayable)}</Cell><Cell right>{money(row.commissionDeductions)}</Cell><Cell right strong>{money(row.commissionNetPayable)}</Cell><Cell right>{money(row.commissionReleased)}</Cell><Cell right>{money(row.commissionRemaining)}</Cell>
        </tr>)}
      />
    </ReportPage>
  </PrintPageShell>
}

export default ReportsPrintPage
