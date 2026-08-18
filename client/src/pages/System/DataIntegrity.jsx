import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCreditCard,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import DataIntegrityDetailsModal from '../../components/System/dataIntegrityComponents/DataIntegrityDetailsModal'
import { useFetch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const dateTimeText = (value) => {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit',
      timeZone: 'Asia/Manila',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

const statusMeta = {
  balanced: {
    label: 'Balanced',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: FiCheckCircle,
  },
  review: {
    label: 'Needs Review',
    badge: 'bg-amber-50 text-amber-700 ring-amber-100',
    panel: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: FiAlertTriangle,
  },
  critical: {
    label: 'Critical',
    badge: 'bg-red-50 text-red-700 ring-red-100',
    panel: 'border-red-200 bg-red-50 text-red-900',
    icon: FiAlertTriangle,
  },
}

const categoryTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'paymentsSoa', label: 'Payments & SOA' },
  { key: 'adjustments', label: 'Discounts & Adjustments' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'proofOfIncome', label: 'Proof of Income' },
  { key: 'documentsFiles', label: 'Documents & Files' },
]

const SummaryCard = ({ title, checked, issues, status = 'balanced', helper, icon: Icon = FiShield }) => {
  const meta = statusMeta[status] || statusMeta.balanced
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{Number(checked || 0).toLocaleString('en-PH')}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{helper || 'Records checked'}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.badge}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${meta.badge}`}>{meta.label}</span>
        <span className={`text-xs font-black ${issues ? 'text-amber-700' : 'text-emerald-700'}`}>{issues ? `${issues} issue${issues === 1 ? '' : 's'}` : 'No issues'}</span>
      </div>
    </article>
  )
}

const DataIntegrity = () => {
  const [searchParams] = useSearchParams()
  const scopedProject = searchParams.get('project') || searchParams.get('projectSlug') || ''
  const scopedAccountId = Number(searchParams.get('accountId') || 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [recordFilter, setRecordFilter] = useState(scopedAccountId ? 'all' : 'all')
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedAccountId, setSelectedAccountId] = useState(scopedAccountId || null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (scopedProject) params.set('projectSlug', scopedProject)
    if (scopedAccountId) params.set('accountId', String(scopedAccountId))
    return params.toString()
  }, [scopedAccountId, scopedProject])

  const query = useQuery({
    queryKey: ['data-integrity-report', scopedProject || 'all', scopedAccountId || 'all'],
    queryFn: () => useFetch(`/data-integrity${queryString ? `?${queryString}` : ''}`),
    retry: false,
    staleTime: 60_000,
  })

  const summary = query.data?.summary || {}
  const categories = summary.categories || {}
  const records = query.data?.records || []

  const projects = useMemo(() => {
    const map = new Map()
    records.forEach((record) => map.set(record.projectSlug, record.projectName))
    return [...map.entries()].map(([slug, name]) => ({ slug, name }))
  }, [records])

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) return false
      if (recordFilter === 'adjusted' && !record.adjustments?.hasAdjustments) return false
      if (recordFilter === 'historical' && !record.isHistorical) return false
      if (recordFilter === 'issues' && record.status === 'balanced') return false
      if (recordFilter === 'clean' && record.status !== 'balanced') return false

      if (activeTab !== 'overview') {
        const issueCount = Number(record.issueCounts?.[activeTab] || 0)
        const hasActivity = activeTab === 'accounts'
          ? true
          : activeTab === 'paymentsSoa'
            ? Number(record.counts?.payments || 0) > 0 || Number(record.counts?.schedules || 0) > 0
            : activeTab === 'adjustments'
              ? Boolean(record.adjustments?.hasAdjustments)
            : activeTab === 'commissions'
              ? Number(record.counts?.commissions || 0) > 0
              : activeTab === 'proofOfIncome'
                ? Number(record.counts?.receipts || 0) > 0
                : activeTab === 'documentsFiles'
                  ? Number(record.counts?.activeFiles || 0) > 0
                  : false
        if (!issueCount && !hasActivity) return false
      }

      if (!keyword) return true
      return [record.unitId, record.buyerName, record.accountReference, record.projectName, record.projectSlug]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [activeTab, recordFilter, records, search, statusFilter])

  const overallMeta = statusMeta[summary.overallStatus || 'balanced'] || statusMeta.balanced
  const OverallIcon = overallMeta.icon

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Data Integrity"
          description="Read-only financial and account checks across buyer accounts, payments, SOA, discounts, commissions, receipts, and protected file metadata."
          icon={FiShield}
        />
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <FiRefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          {query.isFetching ? 'Checking...' : 'Run Integrity Check'}
        </button>
      </section>

      {query.isLoading ? <StatusAlert type="loading" message="Checking system data integrity..." /> : null}
      {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to run the data integrity check.'} /> : null}

      {!query.isLoading && !query.isError ? (
        <>
          <section className={`rounded-3xl border p-5 shadow-sm ${overallMeta.panel}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <OverallIcon className="mt-0.5 h-7 w-7 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wide">Overall Status</p>
                  <h2 className="mt-1 text-2xl font-black">{overallMeta.label}</h2>
                  <p className="mt-1 text-sm font-semibold opacity-80">
                    {summary.overallStatus === 'balanced'
                      ? 'No unexplained inconsistencies were detected by the current read-only checks.'
                      : `${Number(summary.review || 0) + Number(summary.critical || 0)} account${Number(summary.review || 0) + Number(summary.critical || 0) === 1 ? '' : 's'} need review. No financial data was changed.`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-white/70 px-4 py-3"><p className="text-[10px] font-black uppercase opacity-60">Checked</p><p className="mt-1 text-lg font-black">{summary.totalAccounts || 0}</p></div>
                <div className="rounded-xl bg-white/70 px-4 py-3"><p className="text-[10px] font-black uppercase opacity-60">Balanced</p><p className="mt-1 text-lg font-black">{summary.balanced || 0}</p></div>
                <div className="rounded-xl bg-white/70 px-4 py-3"><p className="text-[10px] font-black uppercase opacity-60">Review</p><p className="mt-1 text-lg font-black">{summary.review || 0}</p></div>
                <div className="rounded-xl bg-white/70 px-4 py-3"><p className="text-[10px] font-black uppercase opacity-60">Critical</p><p className="mt-1 text-lg font-black">{summary.critical || 0}</p></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-current/10 pt-3 text-xs font-semibold opacity-75">
              <span>Last checked: {dateTimeText(query.data?.generatedAt)}</span>
              {scopedProject ? <span>Project scope: {projects.find((item) => item.slug === scopedProject)?.name || scopedProject}</span> : <span>Scope: All lot projects</span>}
              {scopedAccountId ? <span>Account scope: #{scopedAccountId}</span> : null}
              <span>Total direct monetary differences found: {money(summary.totalDifference)}</span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <SummaryCard title="Buyer Accounts" checked={categories.accounts?.checked} issues={categories.accounts?.issues} status={categories.accounts?.status} icon={FiUsers} />
            <SummaryCard title="Payments & SOA" checked={categories.paymentsSoa?.checked} issues={categories.paymentsSoa?.issues} status={categories.paymentsSoa?.status} icon={FiCreditCard} />
            <SummaryCard title="Discounts & Adjustments" checked={categories.adjustments?.checked} issues={categories.adjustments?.issues} status={categories.adjustments?.status} helper="Adjusted accounts checked" icon={FiTrendingUp} />
            <SummaryCard title="Commissions" checked={categories.commissions?.checked} issues={categories.commissions?.issues} status={categories.commissions?.status} helper="Commission records checked" icon={FiTrendingUp} />
            <SummaryCard title="Proof of Income" checked={categories.proofOfIncome?.checked} issues={categories.proofOfIncome?.issues} status={categories.proofOfIncome?.status} helper="Active receipts checked" icon={FiFileText} />
            <SummaryCard title="Documents & Files" checked={categories.documentsFiles?.checked} issues={categories.documentsFiles?.issues} status={categories.documentsFiles?.status} helper="Active protected files checked" icon={FiShield} />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Integrity Records</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Discounts, credits, and waivers are shown as legitimate adjustments and are not treated as missing cash.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[720px]">
                  <label className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unit, buyer, account..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
                  </label>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none">
                    <option value="all">All statuses</option>
                    <option value="balanced">Balanced</option>
                    <option value="review">Needs Review</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select value={recordFilter} onChange={(event) => setRecordFilter(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none">
                    <option value="all">All records</option>
                    <option value="adjusted">With discounts / adjustments</option>
                    <option value="historical">Historical records</option>
                    <option value="issues">Needs review only</option>
                    <option value="clean">Balanced only</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {categoryTabs.map((tab) => (
                  <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{tab.label}</button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1220px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Unit / Account</th>
                    <th className="px-5 py-3">Buyer / Project</th>
                    <th className="px-5 py-3">Integrity</th>
                    <th className="px-5 py-3">Discounts & Adjustments</th>
                    <th className="px-5 py-3 text-right">Direct Difference</th>
                    <th className="px-5 py-3">Top Finding</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length ? filteredRecords.map((record) => {
                    const meta = statusMeta[record.status] || statusMeta.balanced
                    const hasAdjustments = Boolean(record.adjustments?.hasAdjustments)
                    return (
                      <tr key={record.accountId} className="align-top transition hover:bg-slate-50">
                        <td className="px-5 py-4"><p className="font-black text-slate-950">{record.unitId}</p><p className="mt-1 text-xs font-semibold text-slate-500">{record.accountReference}</p>{record.isHistorical ? <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700">Historical</span> : null}</td>
                        <td className="px-5 py-4"><p className="font-black text-slate-900">{record.buyerName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{record.projectName}</p></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${meta.badge}`}>{meta.label}</span><p className="mt-2 text-xs font-semibold text-slate-500">{record.issueCount || 0} issue{record.issueCount === 1 ? '' : 's'}</p></td>
                        <td className="px-5 py-4">{hasAdjustments ? <div className="grid gap-1 text-xs font-semibold text-slate-600">{Number(record.financial?.saleDiscountAmount || 0) > 0 ? <span>Sale Discount: {money(record.financial.saleDiscountAmount)}</span> : null}{Number(record.financial?.approvedDpDiscount || 0) > 0 ? <span>DP Discount: {money(record.financial.approvedDpDiscount)}</span> : null}{Number(record.financial?.lmfWaivedAmount || 0) > 0 ? <span>LMF Waiver: {money(record.financial.lmfWaivedAmount)}</span> : null}{Number(record.financial?.penaltyWaivedAmount || 0) > 0 ? <span>Penalty Relief: {money(record.financial.penaltyWaivedAmount)}</span> : null}</div> : <span className="text-xs font-semibold text-slate-400">No saved discount/waiver</span>}</td>
                        <td className={`px-5 py-4 text-right font-black ${Number(record.differenceAmount || 0) > 0.05 ? 'text-red-700' : 'text-emerald-700'}`}>{money(record.differenceAmount)}</td>
                        <td className="max-w-[360px] px-5 py-4">{record.topIssues?.length ? <><p className="font-black text-slate-800">{record.topIssues[0].title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{record.topIssues[0].message}</p></> : <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-700"><FiCheckCircle /> No inconsistency detected</span>}</td>
                        <td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelectedAccountId(record.accountId)} className="h-9 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100">View Breakdown</button></td>
                      </tr>
                    )
                  }) : <tr><td colSpan="7" className="px-5 py-12 text-center font-semibold text-slate-500">No integrity records match the current filters.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {filteredRecords.length} of {records.length} buyer accounts.</span>
              <span>Historical: {summary.historicalAccounts || 0} · With adjustments: {summary.adjustedAccounts || 0}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
            <div className="flex items-start gap-3"><FiShield className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Read-only by design</p><p className="mt-1 leading-6">This page detects and explains inconsistencies. It never automatically edits payments, SOA rows, discounts, commissions, receipts, account status, or protected files. Use the normal source module to correct a confirmed business record.</p></div></div>
          </section>
        </>
      ) : null}

      {selectedAccountId ? <DataIntegrityDetailsModal accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} /> : null}
    </main>
  )
}

export default DataIntegrity
