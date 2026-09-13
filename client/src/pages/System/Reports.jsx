import { Children, Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiArrowRight,
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiTrendingUp,
  FiXCircle,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const percent = (value) => `${Number(value || 0).toFixed(2)}%`
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const dateOnly = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : '-'
const titleCase = (value) => String(value || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const pad = (value) => String(value).padStart(2, '0')
const toInputDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const presetRange = (preset, today = new Date()) => {
  if (preset === 'last_month') {
    return { from: toInputDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: toInputDate(new Date(today.getFullYear(), today.getMonth(), 0)) }
  }
  const months = Number.parseInt(String(preset).match(/^(\d+)_months$/)?.[1] || '1', 10)
  return { from: toInputDate(new Date(today.getFullYear(), today.getMonth() - Math.max(months - 1, 0), 1)), to: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }
}
const initialRange = () => presetRange('this_month')

const rangeOptions = [
  ['this_month', 'This Month'], ['last_month', 'Last Month'], ['2_months', '2 Months'], ['3_months', '3 Months'], ['6_months', '6 Months'], ['12_months', '12 Months'], ['custom', 'Custom'],
]

const tabs = [
  ['overview', 'Overview'],
  ['sales', 'Sales & Reservations'],
  ['collections', 'Collections'],
  ['outstanding', 'Outstanding Accounts'],
  ['cancellations', 'Cancellations & Refunds'],
  ['commissions', 'Commissions'],
  ['sellers', 'Seller Performance'],
  ['projects', 'Project Breakdown'],
]

const toneStyles = {
  blue: 'border-blue-100 bg-blue-50 text-blue-800',
  green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-100 bg-amber-50 text-amber-800',
  red: 'border-red-100 bg-red-50 text-red-800',
  slate: 'border-slate-200 bg-white text-slate-900',
  violet: 'border-violet-100 bg-violet-50 text-violet-800',
}

const Metric = ({ label, value, helper, tone = 'blue', icon: Icon = FiTrendingUp, scope }) => (
  <article className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone] || toneStyles.blue}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {scope ? <p className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{scope}</p> : null}
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-2 text-xl font-black">{value}</p>
        {helper ? <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{helper}</p> : null}
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80"><Icon /></span>
    </div>
  </article>
)

const BridgeCard = ({ title, subtitle, scope, items = [], tone = 'blue' }) => (
  <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{scope}</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>Reconciled</span>
    </div>
    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          <div className={`rounded-2xl border p-4 ${item.emphasis ? 'border-slate-900 bg-slate-950 text-white' : item.negative ? 'border-red-100 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
            <p className={`text-[10px] font-black uppercase tracking-wide ${item.emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{item.label}</p>
            <p className="mt-2 text-xl font-black">{money(item.value)}</p>
            {item.helper ? <p className={`mt-1 text-xs font-semibold ${item.emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{item.helper}</p> : null}
          </div>
          {index < items.length - 1 ? <FiArrowRight className="hidden h-5 w-5 text-slate-300 lg:block" /> : null}
        </Fragment>
      ))}
    </div>
  </article>
)

const alignClass = (align) => align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
const Th = ({ children, align = 'left' }) => <th className={`sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-3 ${alignClass(align)} text-[10px] font-black uppercase tracking-wide text-slate-500`}>{children}</th>
const Td = ({ children, className = '', align = 'left' }) => <td className={`px-3 py-3 ${alignClass(align)} text-sm font-semibold text-slate-700 ${className}`}>{children}</td>

const TableShell = ({ children, minWidth = '1200px' }) => {
  const rows = Children.toArray(children)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full divide-y divide-slate-200" style={{ minWidth }}>
          <thead className="bg-slate-50">{rows[0]}</thead>
          <tbody className="divide-y divide-slate-100">{rows.slice(1)}</tbody>
        </table>
      </div>
    </div>
  )
}

const PaginatedTable = ({ rows = [], headers = [], renderRow, minWidth = '1200px', emptyText = 'No records for the selected filters.', resetKey = '', title, helper, summary }) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = rows.length ? (currentPage - 1) * pageSize : 0
  const pageRows = rows.slice(start, start + pageSize)

  useEffect(() => setPage(1), [resetKey, pageSize])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  return (
    <section className="grid gap-3">
      {(title || helper || summary) ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title ? <h2 className="text-base font-black text-slate-950">{title}</h2> : null}
            {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
          </div>
          {summary ? <p className="text-sm font-black text-slate-700">{summary}</p> : null}
        </div>
      ) : null}
      <TableShell minWidth={minWidth}>
        <tr>{headers.map((head) => <Th key={head.label || head} align={head.align || 'left'}>{head.label || head}</Th>)}</tr>
        <>
          {pageRows.map((row, index) => renderRow(row, start + index))}
          {!rows.length ? <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">{emptyText}</td></tr> : null}
        </>
      </TableShell>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-500">Showing {rows.length ? start + 1 : 0}–{Math.min(start + pageSize, rows.length)} of {number(rows.length)} record(s)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700">
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40">Previous</button>
          <span className="min-w-[88px] text-center text-xs font-black text-slate-600">Page {currentPage} of {totalPages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  )
}

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('released') || normalized.includes('active') || normalized === 'verified' || normalized === 'eligible') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (normalized.includes('cancel') || normalized.includes('forfeited') || normalized.includes('rejected')) return 'bg-red-50 text-red-700 ring-red-100'
  if (normalized.includes('hold') || normalized.includes('pending') || normalized.includes('earned')) return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const Status = ({ value }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${statusClass(value)}`}>{titleCase(value)}</span>

const Reports = () => {
  const initial = initialRange()
  const [range, setRange] = useState('this_month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [projectId, setProjectId] = useState('all')
  const [sellerId, setSellerId] = useState('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ from, to })
    if (projectId !== 'all') params.set('projectId', projectId)
    if (sellerId !== 'all') params.set('sellerId', sellerId)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [from, to, projectId, sellerId, search])

  const reportQuery = useQuery({
    queryKey: ['system-reports', queryString],
    queryFn: () => useFetch(`/projects/reports?${queryString}`),
    enabled: Boolean(from && to && from <= to),
  })
  const data = reportQuery.data?.data || {}
  const summary = data.summary || {}
  const options = data.options || { projects: [], sellers: [] }
  const resetKey = `${queryString}:${activeTab}`

  const changeRange = (value) => {
    setRange(value)
    if (value !== 'custom') {
      const next = presetRange(value)
      setFrom(next.from)
      setTo(next.to)
    }
  }

  const exportPdf = async () => {
    const printWindow = window.open('about:blank', '_blank')
    if (printWindow) printWindow.opener = null
    try {
      const filename = `DC-Prime-Management-Report_${from}_to_${to}.pdf`
      await useFetchPost('/projects/reports/export-audit', {
        from, to,
        projectId: projectId === 'all' ? null : Number(projectId),
        sellerId: sellerId === 'all' ? null : Number(sellerId),
        search: search.trim() || null,
        filename,
      }, { confirmationHandled: 'technical' })
      const params = new URLSearchParams({ from, to })
      if (projectId !== 'all') params.set('projectId', projectId)
      if (sellerId !== 'all') params.set('sellerId', sellerId)
      if (search.trim()) params.set('search', search.trim())
      const printUrl = `/portal/reports/print?${params.toString()}`
      if (printWindow) printWindow.location.replace(printUrl)
      else window.open(printUrl, '_blank', 'noopener,noreferrer')
      setAlert({ type: 'success', message: 'Professional multi-page report opened. Use Print / Save as PDF to save the final file.' })
    } catch (error) {
      try { printWindow?.close() } catch {}
      setAlert({ type: 'error', message: error?.message || 'Could not prepare the PDF report.' })
    }
  }

  const commissionLess = Number(summary.commissionNonPayable || 0) + Number(summary.commissionDeductions || 0)
  const commissionDifference = Number(summary.commissionReconciliationDifference || 0)

  const commissionReconciliation = (
    <section className="grid gap-5 2xl:grid-cols-2">
      <BridgeCard
        title="Commission from Sales in Selected Range"
        subtitle="This uses the same reservation/sales cohort as the Sales Performance bridge, so old-sale releases are not mixed into the selected period."
        scope={`SALES COHORT · ${from} TO ${to}`}
        items={[
          { label: 'Gross Commission Created', value: summary.commissionGenerated, helper: 'Original gross commission from selected sales' },
          { label: 'Less: Non-Payable / Deductions', value: commissionLess, helper: `Forfeited ${money(summary.commissionForfeitedOnCancellation)} · Cancelled ${money(summary.commissionCancelled)} · Deductions ${money(summary.commissionDeductions)}`, negative: true },
          { label: 'Net Commission Payable', value: summary.commissionNetPayable, helper: 'Released plus unreleased commission still payable', emphasis: true },
        ]}
      />
      <BridgeCard
        title="Status of Net Commission Payable"
        subtitle="A clean status split of the commission that remains payable from the selected sales cohort."
        scope={`AS OF ${to}`}
        tone="green"
        items={[
          { label: 'Released', value: summary.commissionReleased, helper: 'Selected-sale commission actually released by report end' },
          { label: 'Unreleased / Remaining', value: summary.commissionRemaining, helper: `Eligible now ${money(summary.eligibleUnreleased)} · Earned on cancellation ${money(summary.commissionEarnedOnCancellation)}` },
          { label: 'Net Commission Payable', value: summary.commissionNetPayable, helper: 'Released + unreleased / remaining', emphasis: true },
        ]}
      />
      {Math.abs(commissionDifference) > 0.01 ? (
        <div className="2xl:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          Commission reconciliation needs review: {money(commissionDifference)} difference between gross commission and its release-status breakdown.
        </div>
      ) : null}
    </section>
  )

  const overview = (
    <div className="grid gap-5">
      <section className="grid gap-5 2xl:grid-cols-2">
        <BridgeCard
          title="Sales Performance"
          subtitle="Only cancellations belonging to reservations created in the selected range reduce this sales cohort."
          scope={`IN SELECTED RANGE · ${from} TO ${to}`}
          items={[
            { label: 'Gross Contracted Value', value: summary.grossContractedValue, helper: `${number(summary.reservationCount)} reservation(s)` },
            { label: 'Less: Cancelled from Selected Sales', value: summary.cohortCancelledValue, helper: `${number(summary.cohortCancelledCount)} cancelled sale(s)`, negative: true },
            { label: 'Net Active Contract Value', value: summary.netActiveContractValue, helper: 'Gross selected sales less cancelled selected sales', emphasis: true },
          ]}
        />
        <BridgeCard
          title="Cash Movement"
          subtitle="Refunds are counted by refund payment date, not by the date the sale was cancelled."
          scope={`IN SELECTED RANGE · ${from} TO ${to}`}
          tone="green"
          items={[
            { label: 'Verified Collections', value: summary.collectedInRange, helper: 'Verified cash received in range' },
            { label: 'Less: Refunds Paid', value: summary.refundsPaidInRange, helper: 'Refund date falls in range', negative: true },
            { label: 'Net Cash Movement', value: summary.netCashMovement, helper: 'Collections less refunds paid', emphasis: true },
          ]}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Outstanding Receivables" value={money(summary.outstandingAmount)} helper="Active buyer-account balance" scope={`AS OF ${to}`} tone="amber" />
        <Metric label="Net Cumulative Cash" value={money(summary.netCumulativeCash)} helper={`${money(summary.cumulativeCollected)} collected less ${money(summary.cumulativeRefunded)} refunded`} scope={`AS OF ${to}`} tone="green" icon={FiCreditCard} />
        <Metric label="Cancellation Activity" value={number(summary.cancellationActivityCount)} helper={`${money(summary.cancellationActivityValue)} contract value cancelled in range`} scope="IN SELECTED RANGE" tone="red" icon={FiXCircle} />
        <Metric label="Retained / Discontinued" value={money(summary.discontinuedAmount)} helper="Cash retained from cancellations recorded in range" scope="IN SELECTED RANGE" tone="amber" />
      </section>

      {commissionReconciliation}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Top Seller Performance</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Ranked by net active contract value for the selected sales cohort.</p>
          <div className="mt-4 grid gap-2">
            {(data.sellerPerformance || []).slice(0, 8).map((row) => (
              <div key={`${row.sellerId}-${row.seller}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="font-black text-slate-900">{row.seller}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.sellerGroup || '-'} · {number(row.reservations)} reservation(s) · {percent(row.cancellationRate)} cancellation rate</p>
                </div>
                <div className="text-right"><p className="font-black text-blue-700">{money(row.netActiveSales)}</p><p className="text-[10px] font-bold text-slate-400">Net active sales</p></div>
              </div>
            ))}
            {!(data.sellerPerformance || []).length ? <p className="text-sm font-semibold text-slate-500">No seller activity.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Project Breakdown</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Net sales, net cash movement and receivables by project.</p>
          <div className="mt-4 grid gap-2">
            {(data.projectBreakdown || []).filter((row) => row.reservations || row.collectedInRange || row.outstanding).slice(0, 8).map((row) => (
              <div key={row.projectId} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{row.project}</p><p className="font-black text-blue-700">{money(row.netActiveContractValue)}</p></div>
                <p className="mt-1 text-xs font-semibold text-slate-500">Net cash {money(row.netCashMovement)} · Outstanding {money(row.outstanding)}</p>
              </div>
            ))}
            {!(data.projectBreakdown || []).some((row) => row.reservations || row.collectedInRange || row.outstanding) ? <p className="text-sm font-semibold text-slate-500">No project activity.</p> : null}
          </div>
        </article>
      </section>
    </div>
  )

  const salesTable = (
    <PaginatedTable
      title="Sales & Reservations"
      helper="Gross TCP, cancellation impact and net active contract value for reservations created in the selected range."
      summary={`Net Active Contract Value: ${money(summary.netActiveContractValue)}`}
      resetKey={resetKey}
      rows={data.sales || []}
      minWidth="1450px"
      headers={['Reserved', 'Project', 'Unit', 'Buyer', 'Seller', 'Mode', { label: 'Gross TCP', align: 'right' }, 'Cancelled as of End', { label: 'Cancelled Value', align: 'right' }, { label: 'Net Contract', align: 'right' }, 'Account State']}
      renderRow={(row) => <tr key={row.id}>
        <Td>{dateTime(row.reservationDate)}</Td><Td>{row.project}</Td><Td className="font-black text-slate-950">{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.seller}</Td><Td>{row.modeOfPayment}</Td>
        <Td align="right" className="font-black">{money(row.tcp)}</Td><Td>{row.cancelledAsOf ? <Status value="Cancelled" /> : <Status value="Active as of end" />}</Td><Td align="right" className={row.cohortCancelledValue ? 'font-black text-red-700' : ''}>{money(row.cohortCancelledValue)}</Td><Td align="right" className="font-black text-blue-700">{money(row.netContractValue)}</Td><Td><Status value={row.accountStatus || row.reservationStatus} /></Td>
      </tr>}
    />
  )

  const collectionsTable = (
    <PaginatedTable
      title="Collections"
      helper="Payment transactions dated in the selected range. Only Verified rows contribute to the financial summary."
      summary={`Verified Collections: ${money(summary.collectedInRange)}`}
      resetKey={resetKey}
      rows={data.payments || []}
      minWidth="1550px"
      headers={['Date', 'Project', 'Unit', 'Buyer', 'Account', 'Type', 'Method', 'Bank', 'Reference', { label: 'Amount', align: 'right' }, 'Status', 'Verified By', 'Verified At']}
      renderRow={(row) => <tr key={row.id}><Td>{dateOnly(row.paymentDate)}</Td><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.type}</Td><Td>{row.method}</Td><Td>{row.bank || '-'}</Td><Td>{row.reference || '-'}</Td><Td align="right" className="font-black">{money(row.amount)}</Td><Td><Status value={row.status} /></Td><Td>{row.verifiedBy}</Td><Td>{dateTime(row.verifiedAt)}</Td></tr>}
    />
  )

  const outstandingTable = (
    <PaginatedTable
      title={`Outstanding Accounts as of ${to}`}
      helper="Snapshot of active buyer accounts only. Cancelled accounts do not remain in outstanding receivables."
      summary={`Outstanding: ${money(summary.outstandingAmount)}`}
      resetKey={resetKey}
      rows={data.outstandingAccounts || []}
      minWidth="1250px"
      headers={['Project', 'Unit', 'Buyer', 'Account', 'Seller', { label: 'Contract Value', align: 'right' }, { label: 'Cumulative Paid', align: 'right' }, { label: 'Outstanding', align: 'right' }]}
      renderRow={(row) => <tr key={row.accountId}><Td>{row.project}</Td><Td className="font-black text-slate-950">{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.seller}</Td><Td align="right">{money(row.contractValue)}</Td><Td align="right">{money(row.cumulativePaid)}</Td><Td align="right" className="font-black text-amber-700">{money(row.outstanding)}</Td></tr>}
    />
  )

  const cancellationsTab = (
    <div className="grid gap-7">
      <PaginatedTable
        title="Cancellation Activity"
        helper="Sales cancelled during the selected date range, regardless of when the original reservation was created."
        summary={`${number(summary.cancellationActivityCount)} cancellation(s) · ${money(summary.cancellationActivityValue)}`}
        resetKey={`${resetKey}:cancelled`}
        rows={data.cancellations || []}
        minWidth="1650px"
        headers={['Cancelled', 'Project', 'Unit', 'Buyer', 'Seller', 'Account', 'Type', { label: 'Cancelled Value', align: 'right' }, { label: 'Cash Collected', align: 'right' }, { label: 'Refund Amount', align: 'right' }, { label: 'Retained', align: 'right' }, 'Refund Date', 'Reference', 'Reason', 'Cancelled By']}
        renderRow={(row) => <tr key={row.id}><Td>{dateTime(row.cancellationDate)}</Td><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.seller}</Td><Td>{row.accountReference}</Td><Td>{row.cancellationType}</Td><Td align="right" className="font-black text-red-700">{money(row.cancelledValue)}</Td><Td align="right">{money(row.cashCollected)}</Td><Td align="right">{money(row.refundAmount)}</Td><Td align="right" className="font-black text-amber-700">{money(row.discontinuedAmount)}</Td><Td>{dateOnly(row.refundDate)}</Td><Td>{row.refundReference || '-'}</Td><Td className="max-w-[320px] whitespace-normal">{row.reason || '-'}</Td><Td>{row.cancelledBy}</Td></tr>}
      />

      <PaginatedTable
        title="Refunds Paid"
        helper="Refund cash outflows whose refund date falls inside the selected range. This may include cancellations from an earlier reporting period."
        summary={`Refunds Paid: ${money(summary.refundsPaidInRange)}`}
        resetKey={`${resetKey}:refunds`}
        rows={data.refundsPaid || []}
        minWidth="1300px"
        headers={['Refund Date', 'Project', 'Unit', 'Buyer', 'Seller', 'Account', 'Cancellation Date', { label: 'Refund Paid', align: 'right' }, 'Reference', 'Refund Type']}
        renderRow={(row) => <tr key={`refund-${row.id}`}><Td>{dateOnly(row.refundDate)}</Td><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.seller}</Td><Td>{row.accountReference}</Td><Td>{dateTime(row.cancellationDate)}</Td><Td align="right" className="font-black text-red-700">{money(row.refundAmount)}</Td><Td>{row.refundReference || '-'}</Td><Td>{row.refundType}</Td></tr>}
      />
    </div>
  )

  const commissionTable = (
    <div className="grid gap-5">
      {commissionReconciliation}
      <PaginatedTable
        title="Commission Milestones — Selected Sales Cohort"
        helper={`Only commission milestones belonging to sales/reservations created from ${from} to ${to} are shown. Status is evaluated as of ${to}.`}
        summary={`Net Payable: ${money(summary.commissionNetPayable)} · Released: ${money(summary.commissionReleased)} · Remaining: ${money(summary.commissionRemaining)}`}
        resetKey={resetKey}
        rows={data.commissionCohortReleases || []}
        minWidth="1650px"
        headers={['Project', 'Unit', 'Buyer', 'Recipient', 'Role', 'Group', 'Stage', 'Trigger', 'Release %', { label: 'Gross', align: 'right' }, { label: 'Deduction', align: 'right' }, { label: 'Net Amount', align: 'right' }, 'Payment %', 'Status as of End', 'Scheduled', 'Actual Release', 'Released By']}
        renderRow={(row) => <tr key={row.id}><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td className="font-black text-slate-950">{row.seller}</Td><Td>{row.role}</Td><Td>{row.sellerGroup}</Td><Td>{row.stage}</Td><Td>{percent(row.triggerPercent)}</Td><Td>{percent(row.releasePercent)}</Td><Td align="right">{money(row.grossAmount)}</Td><Td align="right">{money(row.deductionAmount)}</Td><Td align="right" className="font-black">{money(row.netAmount)}</Td><Td>{percent(row.paymentPercent)}</Td><Td><Status value={row.status} /></Td><Td>{dateOnly(row.scheduledReleaseDate)}</Td><Td>{dateOnly(row.actualReleaseDate)}</Td><Td>{row.releasedBy}</Td></tr>}
      />
    </div>
  )

  const sellerTable = (
    <PaginatedTable
      title="Seller Performance"
      helper="Sales and commission metrics use the same selected reservation cohort; collections/refunds use transaction dates."
      resetKey={resetKey}
      rows={data.sellerPerformance || []}
      minWidth="1600px"
      headers={['Seller', 'Group', 'Reservations', 'Cancelled', 'Cancellation Rate', { label: 'Gross Contracted', align: 'right' }, { label: 'Cancelled Value', align: 'right' }, { label: 'Net Active Sales', align: 'right' }, { label: 'Collections', align: 'right' }, { label: 'Refunds', align: 'right' }, { label: 'Net Cash', align: 'right' }, { label: 'Gross Commission', align: 'right' }, { label: 'Non-Payable', align: 'right' }, { label: 'Deductions', align: 'right' }, { label: 'Net Payable', align: 'right' }, { label: 'Released', align: 'right' }, { label: 'Remaining', align: 'right' }]}
      renderRow={(row, index) => <tr key={`${row.sellerId}-${index}`}><Td className="font-black text-slate-950">{row.seller}</Td><Td>{row.sellerGroup}</Td><Td>{number(row.reservations)}</Td><Td>{number(row.cancelledReservations)}</Td><Td>{percent(row.cancellationRate)}</Td><Td align="right">{money(row.grossContractedValue)}</Td><Td align="right" className="text-red-700">{money(row.cancelledValue)}</Td><Td align="right" className="font-black text-blue-700">{money(row.netActiveSales)}</Td><Td align="right">{money(row.collectedInRange)}</Td><Td align="right" className="text-red-700">{money(row.refundsInRange)}</Td><Td align="right" className="font-black">{money(row.netCashMovement)}</Td><Td align="right">{money(row.grossCommission)}</Td><Td align="right" className="text-red-700">{money(row.commissionNonPayable)}</Td><Td align="right">{money(row.commissionDeductions)}</Td><Td align="right" className="font-black text-violet-700">{money(row.commissionNetPayable)}</Td><Td align="right">{money(row.releasedCommission)}</Td><Td align="right" className="font-black text-amber-700">{money(row.commissionRemaining)}</Td></tr>}
    />
  )

  const projectTable = (
    <PaginatedTable
      title="Project Breakdown"
      helper="One reconciled project view covering sales, cash, receivables and commission from the same selected sales cohort."
      resetKey={resetKey}
      rows={data.projectBreakdown || []}
      minWidth="1800px"
      headers={['Project', 'Reservations', 'Cancelled Sales', { label: 'Gross Contracted', align: 'right' }, { label: 'Cancelled from Cohort', align: 'right' }, { label: 'Net Active Contract', align: 'right' }, 'Cancellation Activity', { label: 'Collections', align: 'right' }, { label: 'Refunds', align: 'right' }, { label: 'Net Cash', align: 'right' }, { label: 'Outstanding', align: 'right' }, { label: 'Gross Commission', align: 'right' }, { label: 'Non-Payable', align: 'right' }, { label: 'Deductions', align: 'right' }, { label: 'Net Payable', align: 'right' }, { label: 'Released', align: 'right' }, { label: 'Remaining', align: 'right' }]}
      renderRow={(row) => <tr key={row.projectId}><Td className="font-black text-slate-950">{row.project}</Td><Td>{number(row.reservations)}</Td><Td>{number(row.cohortCancelled)}</Td><Td align="right">{money(row.grossContractedValue)}</Td><Td align="right" className="text-red-700">{money(row.cohortCancelledValue)}</Td><Td align="right" className="font-black text-blue-700">{money(row.netActiveContractValue)}</Td><Td>{number(row.cancellationActivity)}</Td><Td align="right">{money(row.collectedInRange)}</Td><Td align="right" className="text-red-700">{money(row.refundsInRange)}</Td><Td align="right" className="font-black">{money(row.netCashMovement)}</Td><Td align="right" className="font-black text-amber-700">{money(row.outstanding)}</Td><Td align="right">{money(row.commissionGenerated)}</Td><Td align="right" className="text-red-700">{money(row.commissionNonPayable)}</Td><Td align="right">{money(row.commissionDeductions)}</Td><Td align="right" className="font-black text-violet-700">{money(row.commissionNetPayable)}</Td><Td align="right">{money(row.commissionReleased)}</Td><Td align="right" className="font-black text-amber-700">{money(row.commissionRemaining)}</Td></tr>}
    />
  )

  const tabContent = activeTab === 'overview' ? overview
    : activeTab === 'sales' ? salesTable
      : activeTab === 'collections' ? collectionsTable
        : activeTab === 'outstanding' ? outstandingTable
          : activeTab === 'cancellations' ? cancellationsTab
            : activeTab === 'commissions' ? commissionTable
              : activeTab === 'sellers' ? sellerTable
                : projectTable

  return <main className="flex flex-col gap-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <PageHeader title="Reports" description="Management reporting with clear sales cohorts, transaction-period cash movement, report-end balances, cancellation activity and commission liability." icon={FiFileText} />
      <button type="button" onClick={exportPdf} disabled={reportQuery.isLoading || reportQuery.isError} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"><FiDownload />Export PDF</button>
    </div>

    {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
    {reportQuery.isError ? <StatusAlert type="error" message={reportQuery.error?.message || 'Failed to load reports.'} /> : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Range</span><select value={range} onChange={(event) => changeRange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">{rangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">From</span><input type="date" value={from} onChange={(event) => { setRange('custom'); setFrom(event.target.value) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-700" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">To</span><input type="date" value={to} onChange={(event) => { setRange('custom'); setTo(event.target.value) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-700" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Projects</option>{(options.projects || []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Seller / Group</span><select value={sellerId} onChange={(event) => setSellerId(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Sellers</option>{(options.sellers || []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.groupName ? ` — ${row.groupName}` : ''}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Search</span><div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unit, buyer, account..." className="h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm font-semibold text-slate-700" /></div></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2"><FiCalendar /> Selected range: {from} to {to}</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 font-black text-blue-700">IN RANGE = transactions/events dated {from}–{to}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-black text-slate-600">AS OF = balances calculated through {to}</span>
        {reportQuery.isFetching ? <span className="inline-flex items-center gap-1 text-blue-700"><FiRefreshCw className="animate-spin" />Updating...</span> : null}
      </div>
    </section>

    <div className="overflow-x-auto"><div className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div></div>

    {reportQuery.isLoading ? <StatusAlert type="loading" message="Building reconciled report data..." /> : tabContent}
  </main>
}

export default Reports
