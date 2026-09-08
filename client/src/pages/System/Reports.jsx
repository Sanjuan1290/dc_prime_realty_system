import { Children, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const dateOnly = (value) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : '-'

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
  ['reservations', 'Reservations'],
  ['payments', 'Payments'],
  ['outstanding', 'Outstanding'],
  ['cancellations', 'Cancellations & Refunds'],
  ['sales', 'Sales'],
  ['commissions', 'Commissions'],
  ['sellers', 'Seller Performance'],
  ['projects', 'Project Breakdown'],
]

const Metric = ({ label, value, helper, tone = 'blue', icon: Icon = FiTrendingUp }) => {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    red: 'border-red-100 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-white text-slate-900',
    violet: 'border-violet-100 bg-violet-50 text-violet-800',
  }
  return <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-xl font-black">{value}</p>{helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}</div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80"><Icon /></span></div></div>
}

const Empty = ({ colSpan = 1, text = 'No records for the selected filters.' }) => <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">{text}</td></tr>
const Th = ({ children }) => <th className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-black uppercase tracking-wide text-slate-500">{children}</th>
const Td = ({ children, className = '' }) => <td className={`whitespace-nowrap px-3 py-3 text-sm font-semibold text-slate-700 ${className}`}>{children}</td>
const TableShell = ({ children, minWidth = '1200px' }) => {
  const rows = Children.toArray(children)
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full divide-y divide-slate-200" style={{ minWidth }}><thead className="bg-slate-50">{rows[0]}</thead><tbody className="divide-y divide-slate-100">{rows.slice(1)}</tbody></table></div></div>
}

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
      const filename = `DC-Prime-Report_${from}_to_${to}.pdf`
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
      setAlert({ type: 'success', message: 'PDF report view opened. Use Print / Save as PDF to save the final file.' })
    } catch (error) {
      try { printWindow?.close() } catch {}
      setAlert({ type: 'error', message: error?.message || 'Could not prepare the PDF report.' })
    }
  }

  const overview = <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Reservations" value={number(summary.reservationCount)} helper="Reservation events created in range" icon={FiUsers} />
      <Metric label="Contract Sales" value={money(summary.grossSales)} helper="TCP of reservations in range" tone="violet" />
      <Metric label="Collected in Range" value={money(summary.collectedInRange)} helper="Verified payments dated in range" tone="green" />
      <Metric label="Cumulative Collected" value={money(summary.cumulativeCollected)} helper={`Verified payments through ${to}`} tone="green" />
      <Metric label="Outstanding" value={money(summary.outstandingAmount)} helper={`Active-account balance as of ${to}`} tone="amber" />
      <Metric label="Cancellations" value={number(summary.cancelledCount)} helper={money(summary.cancelledValue)} tone="red" icon={FiXCircle} />
      <Metric label="Refunded" value={money(summary.refundedAmount)} helper="Cancellation refunds in range" tone="red" icon={FiTrendingDown} />
      <Metric label="Discontinued / Retained" value={money(summary.discontinuedAmount)} helper="Cancelled cash retained in range" tone="amber" />
      <Metric label="Commission Generated" value={money(summary.commissionGenerated)} helper="Gross commission liability from sales in range" tone="violet" />
      <Metric label="Commission Released" value={money(summary.commissionReleased)} helper="Uses actual release date in range" tone="green" />
      <Metric label="Eligible — Not Released" value={money(summary.eligibleUnreleased)} helper={`Eligibility calculated as of ${to}`} tone="amber" />
      <Metric label="Commission Remaining" value={money(summary.commissionRemaining)} helper={`Unreleased non-forfeited release rows as of ${to}`} tone="slate" />
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-950">Seller Performance</h2><p className="mt-1 text-xs font-semibold text-slate-500">Top sellers for the current report selection.</p><div className="mt-4 grid gap-2">{(data.sellerPerformance || []).slice(0, 8).map((row) => <div key={`${row.sellerId}-${row.seller}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 p-3"><div><p className="font-black text-slate-900">{row.seller}</p><p className="text-xs font-semibold text-slate-500">{row.sellerGroup || '-'} · {number(row.reservations)} reservation(s)</p></div><p className="font-black text-blue-700">{money(row.salesAmount)}</p></div>)}{!(data.sellerPerformance || []).length ? <p className="text-sm font-semibold text-slate-500">No seller activity.</p> : null}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-950">Project Breakdown</h2><p className="mt-1 text-xs font-semibold text-slate-500">Collections and outstanding balances by project.</p><div className="mt-4 grid gap-2">{(data.projectBreakdown || []).filter((row) => row.reservations || row.collectedInRange || row.outstanding).slice(0, 8).map((row) => <div key={row.projectId} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{row.project}</p><p className="font-black text-blue-700">{money(row.collectedInRange)}</p></div><p className="mt-1 text-xs font-semibold text-slate-500">{number(row.reservations)} reservations · Outstanding {money(row.outstanding)}</p></div>)}{!(data.projectBreakdown || []).some((row) => row.reservations || row.collectedInRange || row.outstanding) ? <p className="text-sm font-semibold text-slate-500">No project activity.</p> : null}</div></div>
    </section>
  </>

  const reservationTable = <TableShell><tr><Th>Date</Th><Th>Project</Th><Th>Unit</Th><Th>Buyer</Th><Th>Account</Th><Th>Seller</Th><Th>Mode</Th><Th>TCP</Th><Th>Status</Th></tr><>{(data.reservations || []).map((row) => <tr key={row.id}><Td>{dateTime(row.reservationDate)}</Td><Td>{row.project}</Td><Td className="font-black text-slate-950">{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.seller}</Td><Td>{row.modeOfPayment}</Td><Td className="font-black">{money(row.tcp)}</Td><Td>{row.reservationStatus}</Td></tr>)}{!(data.reservations || []).length ? <Empty colSpan={9} /> : null}</></TableShell>

  const paymentTable = <TableShell minWidth="1450px"><tr><Th>Date</Th><Th>Project</Th><Th>Unit</Th><Th>Buyer</Th><Th>Account</Th><Th>Type</Th><Th>Method</Th><Th>Bank</Th><Th>Reference</Th><Th>Amount</Th><Th>Status</Th><Th>Verified By</Th><Th>Verified At</Th></tr><>{(data.payments || []).map((row) => <tr key={row.id}><Td>{dateOnly(row.paymentDate)}</Td><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.type}</Td><Td>{row.method}</Td><Td>{row.bank || '-'}</Td><Td>{row.reference || '-'}</Td><Td className="font-black">{money(row.amount)}</Td><Td>{row.status}</Td><Td>{row.verifiedBy}</Td><Td>{dateTime(row.verifiedAt)}</Td></tr>)}{!(data.payments || []).length ? <Empty colSpan={13} /> : null}</></TableShell>

  const outstandingTable = <TableShell><tr><Th>Project</Th><Th>Unit</Th><Th>Buyer</Th><Th>Account</Th><Th>Seller</Th><Th>Contract Value</Th><Th>Cumulative Paid</Th><Th>Outstanding</Th></tr><>{(data.outstandingAccounts || []).map((row) => <tr key={row.accountId}><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.seller}</Td><Td>{money(row.contractValue)}</Td><Td>{money(row.cumulativePaid)}</Td><Td className="font-black text-amber-700">{money(row.outstanding)}</Td></tr>)}{!(data.outstandingAccounts || []).length ? <Empty colSpan={8} /> : null}</></TableShell>

  const cancellationTable = <TableShell minWidth="1400px"><tr><Th>Cancelled</Th><Th>Project</Th><Th>Unit</Th><Th>Buyer</Th><Th>Account</Th><Th>Type</Th><Th>Cancelled Value</Th><Th>Cash Collected</Th><Th>Refund</Th><Th>Discontinued</Th><Th>Refund Date</Th><Th>Reference</Th><Th>Reason</Th><Th>By</Th></tr><>{(data.cancellations || []).map((row) => <tr key={row.id}><Td>{dateTime(row.cancellationDate)}</Td><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.accountReference}</Td><Td>{row.cancellationType}</Td><Td>{money(row.cancelledValue)}</Td><Td>{money(row.cashCollected)}</Td><Td>{money(row.refundAmount)}</Td><Td>{money(row.discontinuedAmount)}</Td><Td>{dateOnly(row.refundDate)}</Td><Td>{row.refundReference || '-'}</Td><Td className="max-w-[280px] whitespace-normal">{row.reason || '-'}</Td><Td>{row.cancelledBy}</Td></tr>)}{!(data.cancellations || []).length ? <Empty colSpan={14} /> : null}</></TableShell>

  const commissionTable = <TableShell minWidth="1550px"><tr><Th>Project</Th><Th>Unit</Th><Th>Buyer</Th><Th>Recipient</Th><Th>Role</Th><Th>Group</Th><Th>Stage</Th><Th>Trigger</Th><Th>Release %</Th><Th>Net Amount</Th><Th>Payment %</Th><Th>Status</Th><Th>Scheduled</Th><Th>Actual Release</Th><Th>Released By</Th></tr><>{(data.releases || []).map((row) => <tr key={row.id}><Td>{row.project}</Td><Td>{row.unit}</Td><Td>{row.buyer}</Td><Td>{row.seller}</Td><Td>{row.role}</Td><Td>{row.sellerGroup}</Td><Td>{row.stage}</Td><Td>{row.triggerPercent}%</Td><Td>{row.releasePercent}%</Td><Td className="font-black">{money(row.netAmount)}</Td><Td>{row.paymentPercent}%</Td><Td>{row.eligibleAsOf && row.status !== 'Released' ? 'Eligible as of range end' : row.status}</Td><Td>{dateOnly(row.scheduledReleaseDate)}</Td><Td>{dateOnly(row.actualReleaseDate)}</Td><Td>{row.releasedBy}</Td></tr>)}{!(data.releases || []).length ? <Empty colSpan={15} /> : null}</></TableShell>

  const sellerTable = <TableShell><tr><Th>Seller</Th><Th>Group</Th><Th>Reservations</Th><Th>Sales Amount</Th><Th>Collected in Range</Th><Th>Gross Commission</Th><Th>Released</Th><Th>Eligible Unreleased</Th></tr><>{(data.sellerPerformance || []).map((row, index) => <tr key={`${row.sellerId}-${index}`}><Td className="font-black text-slate-950">{row.seller}</Td><Td>{row.sellerGroup}</Td><Td>{number(row.reservations)}</Td><Td>{money(row.salesAmount)}</Td><Td>{money(row.collectedInRange)}</Td><Td>{money(row.grossCommission)}</Td><Td>{money(row.releasedCommission)}</Td><Td className="font-black text-amber-700">{money(row.eligibleUnreleased)}</Td></tr>)}{!(data.sellerPerformance || []).length ? <Empty colSpan={8} /> : null}</></TableShell>

  const projectTable = <TableShell><tr><Th>Project</Th><Th>Reservations</Th><Th>Cancelled</Th><Th>Collected in Range</Th><Th>Cumulative Collected</Th><Th>Outstanding</Th><Th>Refunded</Th><Th>Commission Released</Th><Th>Eligible Unreleased</Th></tr><>{(data.projectBreakdown || []).map((row) => <tr key={row.projectId}><Td className="font-black text-slate-950">{row.project}</Td><Td>{number(row.reservations)}</Td><Td>{number(row.cancelled)}</Td><Td>{money(row.collectedInRange)}</Td><Td>{money(row.cumulativeCollected)}</Td><Td>{money(row.outstanding)}</Td><Td>{money(row.refunded)}</Td><Td>{money(row.commissionReleased)}</Td><Td>{money(row.eligibleUnreleased)}</Td></tr>)}{!(data.projectBreakdown || []).length ? <Empty colSpan={9} /> : null}</></TableShell>

  const tabContent = activeTab === 'overview' ? overview
    : activeTab === 'reservations' ? reservationTable
      : activeTab === 'payments' ? paymentTable
        : activeTab === 'outstanding' ? outstandingTable
          : activeTab === 'cancellations' ? cancellationTable
            : activeTab === 'sales' ? reservationTable
              : activeTab === 'commissions' ? commissionTable
                : activeTab === 'sellers' ? sellerTable
                  : projectTable

  return <main className="flex flex-col gap-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <PageHeader title="Reports" description="Reservations, collections, outstanding balances, cancellations, refunds, seller performance, and commission activity from one management view." icon={FiFileText} />
      <button type="button" onClick={exportPdf} disabled={reportQuery.isLoading || reportQuery.isError} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"><FiDownload />Export PDF</button>
    </div>

    {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
    {reportQuery.isError ? <StatusAlert type="error" message={reportQuery.error?.message || 'Failed to load reports.'} /> : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Range</span><select value={range} onChange={(event) => changeRange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">{rangeOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">From</span><input type="date" value={from} onChange={(event) => { setRange('custom'); setFrom(event.target.value) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-700" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">To</span><input type="date" value={to} onChange={(event) => { setRange('custom'); setTo(event.target.value) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-700" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Projects</option>{(options.projects || []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Seller / Group</span><select value={sellerId} onChange={(event) => setSellerId(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Sellers</option>{(options.sellers || []).map((row) => <option key={row.id} value={row.id}>{row.name}{row.groupName ? ` — ${row.groupName}` : ''}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase text-slate-500">Search</span><div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unit, buyer, account..." className="h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm font-semibold text-slate-700" /></div></label>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500"><FiCalendar /> {from} to {to}{reportQuery.isFetching ? <span className="ml-2 inline-flex items-center gap-1 text-blue-700"><FiRefreshCw className="animate-spin" />Updating...</span> : null}</div>
    </section>

    <div className="overflow-x-auto"><div className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">{tabs.map(([value,label]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div></div>

    {reportQuery.isLoading ? <StatusAlert type="loading" message="Building report data..." /> : tabContent}
  </main>
}

export default Reports

