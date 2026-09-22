import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import PrintPageShell from '../../components/Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell'
import { useFetch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const percent = (value) => `${Number(value || 0).toFixed(2)}%`
const dateOnly = (value) => value
  ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
  : '-'
const dateTime = (value) => value
  ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'

const MetricCard = ({ label, value, helper, emphasis = false }) => (
  <div className={`rounded-lg border p-3 ${emphasis ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white'}`}>
    <p className={`text-[7px] font-black uppercase tracking-[0.12em] ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{label}</p>
    <p className="mt-1.5 text-[13px] font-black tabular-nums">{value}</p>
    {helper ? <p className={`mt-1 text-[7px] font-semibold leading-relaxed ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{helper}</p> : null}
  </div>
)

const SectionCard = ({ title, description, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div>
      <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-[7px] font-semibold leading-relaxed text-slate-500">{description}</p> : null}
    </div>
    <div className="mt-3">{children}</div>
  </section>
)

const ReportPage = ({ title, subtitle, page, totalPages, children }) => (
  <section className="print-export-page mx-auto min-h-[297mm] w-[210mm] bg-white px-[12mm] py-[10mm] text-black shadow-lg print:shadow-none">
    <header className="flex items-start justify-between gap-5 border-b-2 border-slate-900 pb-3">
      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-700">D&amp;C Prime Realty</p>
        <h1 className="mt-1 text-[16px] font-black uppercase tracking-tight text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[145mm] text-[7.5px] font-semibold leading-relaxed text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[7px] font-black uppercase tracking-wide text-slate-500">Confidential</p>
        <p className="mt-1 text-[7px] font-semibold text-slate-500">Page {page} of {totalPages}</p>
      </div>
    </header>

    <div className="pt-4">{children}</div>

    <footer className="mt-5 flex items-center justify-between border-t border-slate-300 pt-2 text-[6.5px] font-semibold text-slate-500">
      <span>D&amp;C Prime Realty — Management Summary Report</span>
      <span>For internal use only · Page {page} of {totalPages}</span>
    </footer>
  </section>
)

const SummaryRow = ({ label, value, strong = false, helper }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <div>
      <p className={`text-[8px] ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-600'}`}>{label}</p>
      {helper ? <p className="mt-0.5 text-[6.5px] font-semibold text-slate-400">{helper}</p> : null}
    </div>
    <p className={`shrink-0 text-right text-[8px] tabular-nums ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-700'}`}>{value}</p>
  </div>
)

const ProjectTable = ({ projects }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200">
    <table className="w-full table-fixed border-collapse text-[6.7px]">
      <thead className="bg-slate-100">
        <tr>
          {[
            ['Project', '22%'],
            ['Reservations', '9%'],
            ['Gross Sales', '13%'],
            ['Cash Collected', '13%'],
            ['Available', '8%'],
            ['Hold', '6%'],
            ['Sold', '7%'],
            ['Fully Paid', '8%'],
            ['Pending Cancel', '8%'],
            ['Overdue', '6%'],
          ].map(([label, width]) => (
            <th key={label} style={{ width }} className="border-b border-slate-200 px-1.5 py-2 text-left font-black uppercase tracking-wide text-slate-600">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id || project.slug} className="border-b border-slate-100 last:border-b-0">
            <td className="px-1.5 py-2 align-top">
              <p className="font-black text-slate-950">{project.name}</p>
              {project.location ? <p className="mt-0.5 font-semibold text-slate-400">{project.location}</p> : null}
            </td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.reservationCount)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{money(project.stats.totalGrossSales ?? project.stats.totalSales)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{money(project.stats.totalCashCollected ?? project.stats.totalCollected)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.available)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.hold)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.soldActive)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.fullyPaid)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.pendingCancellation)}</td>
            <td className="px-1.5 py-2 font-bold tabular-nums">{number(project.stats.overdueCount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const ProjectBars = ({ projects }) => {
  const visible = [...projects]
    .sort((a, b) => Number(b.stats.totalGrossSales ?? b.stats.totalSales ?? 0) - Number(a.stats.totalGrossSales ?? a.stats.totalSales ?? 0))
    .slice(0, 10)
  const maxValue = Math.max(...visible.map((project) => Number(project.stats.totalGrossSales ?? project.stats.totalSales ?? 0)), 1)

  return (
    <div className="grid gap-2">
      {visible.map((project) => {
        const gross = Number(project.stats.totalGrossSales ?? project.stats.totalSales ?? 0)
        const collected = Number(project.stats.totalCashCollected ?? project.stats.totalCollected ?? 0)
        return (
          <div key={`bar-${project.id || project.slug}`} className="grid grid-cols-[42mm_1fr_35mm] items-center gap-2">
            <p className="truncate text-[7px] font-black text-slate-700">{project.name}</p>
            <div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max((gross / maxValue) * 100, gross > 0 ? 2 : 0)}%` }} />
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max((collected / maxValue) * 100, collected > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
            <div className="text-right text-[6.5px] font-bold tabular-nums text-slate-600">
              <p>{money(gross)}</p>
              <p className="text-emerald-700">{money(collected)}</p>
            </div>
          </div>
        )
      })}
      <div className="mt-1 flex gap-4 text-[6.5px] font-bold text-slate-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-600" />Gross Sales</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />Cash Collected</span>
      </div>
    </div>
  )
}

const emptySummary = {
  totalUnits: 0,
  available: 0,
  hold: 0,
  soldActive: 0,
  fullyPaid: 0,
  pendingCancellation: 0,
  cancelled: 0,
  totalGrossSales: 0,
  cashCollected: 0,
  grossCashCollectibles: 0,
  discountApplied: 0,
  netCashCollectibles: 0,
  penaltyPaid: 0,
  penaltyOutstanding: 0,
  reservationCount: 0,
  totalNetSales: 0,
  cancelledCount: 0,
  cancelledValue: 0,
  totalRefundedAmount: 0,
  totalDiscontinuedAmount: 0,
  totalCommission: 0,
  eligibleCommission: 0,
  releasedCommission: 0,
  netRemainingCommission: 0,
  listedInventory: 0,
  availableInventory: 0,
  soldInventory: 0,
  pendingCancellationValue: 0,
  dueSoonCount: 0,
  overdueCount: 0,
  upcomingDueAmount: 0,
}

const aggregateProjects = (projects = []) => projects.reduce((total, project) => {
  const stats = project.stats || {}
  total.totalUnits += Number(stats.totalUnits || 0)
  total.available += Number(stats.available || 0)
  total.hold += Number(stats.hold || 0)
  total.soldActive += Number(stats.soldActive || 0)
  total.fullyPaid += Number(stats.fullyPaid || 0)
  total.pendingCancellation += Number(stats.pendingCancellation || 0)
  total.cancelled += Number(stats.cancelled || 0)
  total.totalGrossSales += Number(stats.totalGrossSales ?? stats.totalSales ?? 0)
  total.cashCollected += Number(stats.totalCashCollected ?? stats.totalCollected ?? 0)
  total.grossCashCollectibles += Number(stats.grossCashCollectibles ?? stats.cashCollectibles ?? 0)
  total.discountApplied += Number(stats.discountApplied || 0)
  total.netCashCollectibles += Number(stats.netCashCollectibles || 0)
  total.penaltyPaid += Number(stats.totalPenaltyPaid || 0)
  total.penaltyOutstanding += Number(stats.totalPenaltyOutstanding || 0)
  total.reservationCount += Number(stats.reservationCount || 0)
  total.totalNetSales += Number(stats.totalNetSales || 0)
  total.cancelledCount += Number(stats.cancelledCount || 0)
  total.cancelledValue += Number(stats.cancelledValue || 0)
  total.totalRefundedAmount += Number(stats.totalRefundedAmount || 0)
  total.totalDiscontinuedAmount += Number(stats.totalDiscontinuedAmount || 0)
  total.totalCommission += Number(stats.totalCommission || 0)
  total.eligibleCommission += Number(stats.eligibleCommission || 0)
  total.releasedCommission += Number(stats.releasedCommission || 0)
  total.netRemainingCommission += Number(stats.netRemainingCommission || 0)
  total.listedInventory += Number(stats.listedLotValue || 0)
  total.availableInventory += Number(stats.availableLotValue || 0)
  total.soldInventory += Number(stats.soldLotValue || 0)
  total.pendingCancellationValue += Number(stats.pendingCancellationValue || 0)
  total.dueSoonCount += Number(stats.dueSoonCount || 0)
  total.overdueCount += Number(stats.overdueCount || 0)
  total.upcomingDueAmount += Number(stats.upcomingDueAmount || 0)
  return total
}, { ...emptySummary })

const ReportsPrintPage = () => {
  const params = new URLSearchParams(window.location.search)
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const range = params.get('range') || 'custom'
  const projectScope = params.get('projectScope') || 'lot'
  const generatedAt = dateTime(new Date().toISOString())
  const totalPages = 3

  const summaryQuery = useQuery({
    queryKey: ['system-management-summary-print', projectScope, range, from, to],
    queryFn: async () => {
      if (projectScope !== 'lot') throw new Error('Only Lot Project summary export is available right now.')

      const projectsResponse = await useFetch('/projects/lot-projects')
      const projects = projectsResponse?.data || []
      const query = new URLSearchParams({ range, from, to }).toString()

      const dashboardResponses = await Promise.all(projects.map((project) => {
        const slug = project.slug || project.lot_project_slug
        return useFetch(`/projects/lot-projects/${slug}/dashboard?${query}`)
      }))

      const projectReports = projects.map((project, index) => {
        const dashboard = dashboardResponses[index]?.data || {}
        const payload = dashboard.project || project
        return {
          id: payload.id || payload.lot_project_id || project.id || project.lot_project_id,
          slug: payload.slug || payload.lot_project_slug || project.slug || project.lot_project_slug,
          name: payload.name || payload.lot_project_name || project.name || project.lot_project_name || 'Project',
          location: payload.location || payload.lot_project_location || project.location || project.lot_project_location || '',
          stats: dashboard.stats || {},
        }
      })

      return {
        projects: projectReports,
        summary: aggregateProjects(projectReports),
      }
    },
    enabled: Boolean(from && to),
  })

  useEffect(() => {
    document.title = `DC Prime Management Summary ${from} to ${to}`
  }, [from, to])

  if (summaryQuery.isLoading) {
    return <PrintPageShell title="D&C Prime Management Summary" pageOrientation="portrait"><div className="p-6 text-sm font-semibold">Preparing management summary...</div></PrintPageShell>
  }

  if (summaryQuery.isError) {
    return <PrintPageShell title="D&C Prime Management Summary" pageOrientation="portrait"><div className="p-6 text-sm font-semibold text-red-700">{summaryQuery.error?.message || 'Failed to load management summary.'}</div></PrintPageShell>
  }

  const projects = summaryQuery.data?.projects || []
  const summary = summaryQuery.data?.summary || { ...emptySummary }
  const collectionProgress = summary.totalGrossSales > 0 ? (summary.cashCollected / summary.totalGrossSales) * 100 : 0
  const subtitle = `${dateOnly(from)} – ${dateOnly(to)} · Lot Projects · ${number(projects.length)} project${projects.length === 1 ? '' : 's'} · Generated ${generatedAt}`

  return (
    <PrintPageShell title="D&C Prime Management Summary" pageOrientation="portrait">
      <style>{`
        @media print {
          .print-export-page { min-height: 297mm; break-after: page; page-break-after: always; }
          .print-export-page:last-child { break-after: auto; page-break-after: auto; }
          table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <ReportPage title="Management Summary Report" subtitle={subtitle} page={1} totalPages={totalPages}>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Gross Sales" value={money(summary.totalGrossSales)} helper="Active and pending-cancellation reservation contracts in the selected period." emphasis />
          <MetricCard label="Total Net Sales" value={money(summary.totalNetSales)} helper="Gross sales less applied discounts." />
          <MetricCard label="Cash Collected" value={money(summary.cashCollected)} helper="Verified collections included in the selected period." />
          <MetricCard label="Net Cash Collectibles" value={money(summary.netCashCollectibles)} helper="Gross cash collectibles less applied discounts." />
          <MetricCard label="Total Reservations" value={number(summary.reservationCount)} helper="Reservation activity included in the selected period." />
          <MetricCard label="Finalized Cancellations" value={number(summary.cancelledCount)} helper={money(summary.cancelledValue)} />
        </div>

        <div className="mt-4 grid gap-3">
          <SectionCard title="Sales & Collections" description="High-level sales and collection position for the selected reporting period.">
            <SummaryRow label="Gross Cash Collectibles" value={money(summary.grossCashCollectibles)} />
            <SummaryRow label="Discount Applied" value={money(summary.discountApplied)} />
            <SummaryRow label="Net Cash Collectibles" value={money(summary.netCashCollectibles)} strong />
            <SummaryRow label="Paid Penalties" value={money(summary.penaltyPaid)} />
            <SummaryRow label="Outstanding Penalties" value={money(summary.penaltyOutstanding)} />
            <SummaryRow label="Collection Progress" value={percent(collectionProgress)} helper="Cash collected ÷ total gross sales" strong />
          </SectionCard>

          <SectionCard title="Cancellation Summary" description="Current pending cancellations plus finalized cancellation activity in the selected period.">
            <div className="grid grid-cols-2 gap-x-5">
              <div>
                <SummaryRow label="Pending Cancellations" value={number(summary.pendingCancellation)} />
                <SummaryRow label="Pending Cancellation Value" value={money(summary.pendingCancellationValue)} />
              </div>
              <div>
                <SummaryRow label="Finalized Cancellations" value={number(summary.cancelledCount)} />
                <SummaryRow label="Cancelled Value" value={money(summary.cancelledValue)} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-5">
              <SummaryRow label="Refunded Amount" value={money(summary.totalRefundedAmount)} />
              <SummaryRow label="Discontinued / Retained Amount" value={money(summary.totalDiscontinuedAmount)} />
            </div>
          </SectionCard>
        </div>
      </ReportPage>

      <ReportPage title="Operational & Financial Summary" subtitle={subtitle} page={2} totalPages={totalPages}>
        <div className="grid gap-3">
          <SectionCard title="Inventory Summary" description="Current unit status across all included projects. This is a status snapshot, not a transaction-level listing.">
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Total Units" value={number(summary.totalUnits)} />
              <MetricCard label="Available" value={number(summary.available)} />
              <MetricCard label="On Hold" value={number(summary.hold)} />
              <MetricCard label="Sold / Active" value={number(summary.soldActive)} />
              <MetricCard label="Fully Paid" value={number(summary.fullyPaid)} />
              <MetricCard label="Pending Cancellation" value={number(summary.pendingCancellation)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-5">
              <div>
                <SummaryRow label="Listed Inventory Value" value={money(summary.listedInventory)} />
                <SummaryRow label="Available Inventory Value" value={money(summary.availableInventory)} />
              </div>
              <div>
                <SummaryRow label="Sold / Active Inventory Value" value={money(summary.soldInventory)} />
                <SummaryRow label="Pending Cancellation Value" value={money(summary.pendingCancellationValue)} />
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-2 gap-3">
            <SectionCard title="Payment Status" description="Current due-soon and overdue schedules for the selected reservation accounts.">
              <SummaryRow label="Payments Due Soon" value={number(summary.dueSoonCount)} />
              <SummaryRow label="Overdue Accounts" value={number(summary.overdueCount)} strong />
              <SummaryRow label="Upcoming Amount Due" value={money(summary.upcomingDueAmount)} />
              <SummaryRow label="Outstanding Penalties" value={money(summary.penaltyOutstanding)} />
            </SectionCard>

            <SectionCard title="Commission Summary" description="Company-wide commission position across the included projects.">
              <SummaryRow label="Gross Commission" value={money(summary.totalCommission)} />
              <SummaryRow label="Eligible Commission" value={money(summary.eligibleCommission)} />
              <SummaryRow label="Released Commission" value={money(summary.releasedCommission)} />
              <SummaryRow label="Remaining Commission" value={money(summary.netRemainingCommission)} strong />
            </SectionCard>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[7.5px] font-semibold leading-relaxed text-blue-900">
            <p className="font-black uppercase tracking-wide">Management Summary Only</p>
            <p className="mt-1">This PDF intentionally excludes buyer-level records, individual unit transaction rows, payment transaction tables, seller-level records, document records, and notification logs. Open Reports in the system for detailed drill-down information.</p>
          </div>
        </div>
      </ReportPage>

      <ReportPage title="Project Summary" subtitle={subtitle} page={3} totalPages={totalPages}>
        <SectionCard title="Summary Comparison" description="Aggregated project-level performance only. No buyer or transaction-level details are included.">
          {projects.length ? <ProjectBars projects={projects} /> : <p className="py-6 text-center text-[8px] font-semibold text-slate-500">No project data for this reporting period.</p>}
        </SectionCard>

        <div className="mt-4">
          <SectionCard title="Project Breakdown" description="Compact management view by project using the same summary definitions as the Reports page.">
            {projects.length ? <ProjectTable projects={projects} /> : <p className="py-6 text-center text-[8px] font-semibold text-slate-500">No projects available.</p>}
          </SectionCard>
        </div>
      </ReportPage>
    </PrintPageShell>
  )
}

export default ReportsPrintPage

