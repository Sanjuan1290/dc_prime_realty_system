import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiMapPin, FiSearch } from 'react-icons/fi'
import { getCompanyProfitError, getMaxCompanyProfitPercent, getMaxCompanyProfitRate } from '../../../utils/companyProfitPolicy'

const PROJECTS_PER_PAGE = 5
const DEFAULT_POOL_SHARES = Object.freeze({
  division_manager: 14.18,
  sales_director: 15.82,
  unit_manager: 20,
  sales_agent: 50,
})
const rate4 = (value) => Number(value || 0).toFixed(4)
const share2 = (value) => Number(value || 0).toFixed(2)
const round4 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000
const getProjectId = (project) => Number(project.lot_project_id || project.id)
const getProjectName = (project) => project.lot_project_name || project.name || `Project ${getProjectId(project)}`

const normalizeShares = (shares = {}) => ({
  division_manager: Number(shares.division_manager ?? DEFAULT_POOL_SHARES.division_manager),
  sales_director: Number(shares.sales_director ?? DEFAULT_POOL_SHARES.sales_director),
  unit_manager: Number(shares.unit_manager ?? DEFAULT_POOL_SHARES.unit_manager),
  sales_agent: Number(shares.sales_agent ?? DEFAULT_POOL_SHARES.sales_agent),
})

const calculateAllocation = (rate = {}, shares = DEFAULT_POOL_SHARES, external = false) => {
  const pool = Number(rate.seller_group_pool_rate || 0)
  if (external) {
    return { pool, companyProfit: 0, distributable: pool, dm: 0, sd: 0, um: 0, sa: 0, allocated: pool, accounted: pool }
  }
  const companyProfit = Number(rate.company_profit_rate || 0)
  const distributable = round4(Math.max(pool - companyProfit, 0))
  const dm = round4(distributable * (shares.division_manager / 100))
  const sd = round4(distributable * (shares.sales_director / 100))
  const um = round4(distributable * (shares.unit_manager / 100))
  const sa = round4(distributable - dm - sd - um)
  const allocated = round4(dm + sd + um + sa)
  return { pool, companyProfit, distributable, dm, sd, um, sa, allocated, accounted: round4(companyProfit + allocated) }
}

const createDefaultRates = (projectId, groupType) => ({
  lot_project_id: projectId,
  seller_group_pool_rate: 8,
  company_profit_rate: 0,
  division_manager_rate: 0,
  sales_director_rate: 0,
  unit_manager_rate: 0,
  sales_agent_rate: 0,
  commission_structure_type: groupType === 'external' ? 'external' : 'in_house',
})

const DistributionRow = ({ label, share, rate }) => (
  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-xs font-black text-slate-700">{label}</span>
    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{share2(share)}% of pool</span>
    <span className="min-w-[82px] text-right text-xs font-black text-blue-700">{rate4(rate)}%</span>
  </div>
)

const ProjectAccreditationFields = ({
  projects = [],
  projectRates = [],
  onChange,
  disabled = false,
  groupType = 'in_house',
  onRequestRemove,
  poolShares: poolSharesProp,
}) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const isExternal = groupType === 'external'
  const poolShares = useMemo(() => normalizeShares(poolSharesProp), [poolSharesProp])
  const maxCompanyProfitPercent = getMaxCompanyProfitPercent(poolSharesProp)

  const selectedMap = useMemo(
    () => new Map(projectRates.map((rate) => [Number(rate.lot_project_id), rate])),
    [projectRates]
  )

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => `${getProjectName(project)} ${project.lot_project_location || ''} ${project.lot_project_location_code || ''}`.toLowerCase().includes(keyword))
  }, [projects, search])

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE))
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages])
  const pageStart = (page - 1) * PROJECTS_PER_PAGE
  const paginatedProjects = filteredProjects.slice(pageStart, pageStart + PROJECTS_PER_PAGE)

  const toggleProject = (project) => {
    const projectId = getProjectId(project)
    if (selectedMap.has(projectId)) {
      if (onRequestRemove) onRequestRemove(project)
      else onChange(projectRates.filter((rate) => Number(rate.lot_project_id) !== projectId))
      return
    }
    onChange([...projectRates, createDefaultRates(projectId, groupType)])
  }

  const updateRate = (projectId, field, value) => {
    onChange(projectRates.map((rate) => {
      if (Number(rate.lot_project_id) !== Number(projectId)) return rate
      return {
        ...rate,
        [field]: value,
        company_profit_rate: isExternal ? 0 : (field === 'company_profit_rate' ? value : rate.company_profit_rate || 0),
        commission_structure_type: isExternal ? 'external' : 'in_house',
      }
    }))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">Accredited Projects and Commission Allocation <span className="text-red-500">*</span></h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isExternal
              ? 'The full Pool Rate belongs to the External Network.'
              : 'Enter the Pool Rate and optional Company Profit (CP). The remaining pool is distributed automatically using the company-wide role percentages.'}
          </p>
        </div>
        <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">{projectRates.length} selected</span>
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">Search projects</span>
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search project, location, or code..." disabled={disabled} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
      </label>

      <div className="mt-4 grid gap-4">
        {paginatedProjects.map((project) => {
          const projectId = getProjectId(project)
          const selectedRate = selectedMap.get(projectId)
          const checked = Boolean(selectedRate)
          const location = project.lot_project_location || project.location || 'No location set'
          const allocation = calculateAllocation(selectedRate || {}, poolShares, isExternal)
          const maxCompanyProfitRate = getMaxCompanyProfitRate(allocation.pool, maxCompanyProfitPercent)
          const companyProfitError = !isExternal && checked
            ? getCompanyProfitError(selectedRate, { maxPercentOfPool: maxCompanyProfitPercent, shares: poolShares })
            : ''
          const valid = checked
            && allocation.pool >= 6
            && allocation.pool <= 15
            && (isExternal || (!companyProfitError && Math.abs(allocation.accounted - allocation.pool) < 0.0001))

          return (
            <article key={projectId} className={`rounded-2xl border p-4 transition ${checked ? 'border-blue-300 bg-white ring-4 ring-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={checked} onChange={() => toggleProject(project)} disabled={disabled} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-slate-950">{getProjectName(project)}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><FiMapPin className="shrink-0" />{location}{project.lot_project_location_code ? ` · ${project.lot_project_location_code}` : ''}</span>
                </span>
              </label>

              {checked ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className={`grid gap-3 ${isExternal ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-black text-slate-700">Pool Rate</span>
                      <div className="relative">
                        <input type="number" min="6" max="15" step="0.0001" data-example="8%" value={selectedRate.seller_group_pool_rate} onChange={(event) => updateRate(projectId, 'seller_group_pool_rate', event.target.value)} disabled={disabled} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                      </div>
                    </label>

                    {!isExternal ? (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-black text-slate-700">Company Profit (CP)</span>
                        <div className="relative">
                          <input type="number" min="0" max={maxCompanyProfitRate} step="0.0001" data-example="2%" value={selectedRate.company_profit_rate ?? 0} onChange={(event) => updateRate(projectId, 'company_profit_rate', event.target.value)} disabled={disabled} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">Actual retained rate, not a share of the pool. Max {maxCompanyProfitRate.toFixed(4)}%.</span>
                      </label>
                    ) : null}

                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                      <p className="text-xs font-black text-blue-900">{isExternal ? 'External Network Commission' : 'Distributable Pool'}</p>
                      <p className="mt-1 text-lg font-black text-blue-700">{rate4(allocation.distributable)}%</p>
                      <p className="mt-1 text-xs font-semibold text-blue-700">{isExternal ? 'Full Pool Rate' : `${rate4(allocation.pool)}% Pool − ${rate4(allocation.companyProfit)}% CP`}</p>
                    </div>
                  </div>

                  {!isExternal ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Read-only role distribution</p>
                        <p className="text-xs font-black text-slate-700">100% of {rate4(allocation.distributable)}%</p>
                      </div>
                      <DistributionRow label="Division Manager" share={poolShares.division_manager} rate={allocation.dm} />
                      <DistributionRow label="Sales Director" share={poolShares.sales_director} rate={allocation.sd} />
                      <DistributionRow label="Unit Manager" share={poolShares.unit_manager} rate={allocation.um} />
                      <DistributionRow label="Sales Agent" share={poolShares.sales_agent} rate={allocation.sa} />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs font-black">
                        <span className="text-slate-700">Seller Distribution {rate4(allocation.allocated)}% + Company Profit {rate4(allocation.companyProfit)}%</span>
                        <span className="text-blue-700">Total {rate4(allocation.accounted)}%</span>
                      </div>
                    </div>
                  ) : null}

                  <div className={`mt-3 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`flex items-center gap-2 text-xs font-black ${valid ? 'text-emerald-700' : 'text-amber-800'}`}>{valid ? <FiCheckCircle /> : null}{isExternal ? `Full Pool Rate: ${rate4(allocation.pool)}%` : `Distributable: ${rate4(allocation.distributable)}%`}</p>
                    <p className={`text-xs font-black ${valid ? 'text-emerald-700' : 'text-amber-800'}`}>{valid ? 'Ready' : companyProfitError || 'Check Pool Rate and CP'}</p>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {!filteredProjects.length ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">No projects match your search.</p> : (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">Showing {pageStart + 1}–{Math.min(pageStart + PROJECTS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} project(s)</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={disabled || page <= 1} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FiChevronLeft /> Previous</button>
            <span className="min-w-[86px] text-center text-xs font-black text-slate-600">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={disabled || page >= totalPages} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next <FiChevronRight /></button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ProjectAccreditationFields
