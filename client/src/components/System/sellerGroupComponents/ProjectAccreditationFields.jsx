import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiMapPin, FiSearch } from 'react-icons/fi'

const PROJECTS_PER_PAGE = 5
const moneyRate = (value) => Number(value || 0).toFixed(2)
const getProjectId = (project) => Number(project.lot_project_id || project.id)
const getProjectName = (project) => project.lot_project_name || project.name || `Project ${getProjectId(project)}`

const createDefaultRates = (projectId, groupHeadRole, groupType) => {
  if (groupType === 'external') {
    return {
      lot_project_id: projectId,
      seller_group_pool_rate: 8,
      division_manager_rate: 0,
      sales_director_rate: 0,
      unit_manager_rate: 0,
      sales_agent_rate: 0,
      commission_structure_type: 'external',
    }
  }

  const divisionManagerRate = groupHeadRole === 'sales_director' ? 0 : 1
  return {
    lot_project_id: projectId,
    seller_group_pool_rate: 8,
    division_manager_rate: divisionManagerRate,
    sales_director_rate: 1,
    unit_manager_rate: 1,
    sales_agent_rate: 8 - divisionManagerRate - 2,
    commission_structure_type: 'in_house',
  }
}

const rateFields = [
  ['division_manager_rate', 'Division Manager Rate', '1%'],
  ['sales_director_rate', 'Sales Director Rate', '1%'],
  ['unit_manager_rate', 'Unit Manager Rate', '1%'],
  ['sales_agent_rate', 'Sales Agent Rate', '5%'],
]

const ProjectAccreditationFields = ({
  projects = [],
  projectRates = [],
  onChange,
  disabled = false,
  groupHeadRole = 'division_manager',
  groupType = 'in_house',
  onRequestRemove,
}) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const isExternal = groupType === 'external'

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
    onChange([...projectRates, createDefaultRates(projectId, groupHeadRole, groupType)])
  }

  const updateRate = (projectId, field, value) => {
    onChange(projectRates.map((rate) => {
      if (Number(rate.lot_project_id) !== Number(projectId)) return rate
      const next = {
        ...rate,
        [field]: value,
        commission_structure_type: isExternal ? 'external' : 'in_house',
      }
      if (isExternal) {
        next.division_manager_rate = 0
        next.sales_director_rate = 0
        next.unit_manager_rate = 0
        next.sales_agent_rate = 0
      } else if (field === 'seller_group_pool_rate') {
        const fixedRates = Number(next.division_manager_rate || 0)
          + Number(next.sales_director_rate || 0)
          + Number(next.unit_manager_rate || 0)
        next.sales_agent_rate = Math.max(Number(value || 0) - fixedRates, 0).toFixed(2)
      }
      return next
    }))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">
            Accredited Projects and Commission Rates <span className="text-red-500">*</span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isExternal
              ? 'The full Pool Rate belongs to the External Group. Its internal distribution is handled outside this system.'
              : 'The four in-house position rates must total the project Pool Rate.'}
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
          const pool = Number(selectedRate?.seller_group_pool_rate || 0)
          const allocated = isExternal
            ? pool
            : Number(selectedRate?.division_manager_rate || 0)
              + Number(selectedRate?.sales_director_rate || 0)
              + Number(selectedRate?.unit_manager_rate || 0)
              + Number(selectedRate?.sales_agent_rate || 0)
          const remaining = Number((pool - allocated).toFixed(2))
          const valid = checked && pool >= 6 && pool <= 15 && (isExternal || (
            Math.abs(remaining) < 0.001
            && Number(selectedRate.sales_director_rate || 0) > 0
            && Number(selectedRate.unit_manager_rate || 0) > 0
            && Number(selectedRate.sales_agent_rate || 0) > 0
            && (groupHeadRole === 'sales_director'
              ? Number(selectedRate.division_manager_rate || 0) === 0
              : Number(selectedRate.division_manager_rate || 0) > 0)
          ))

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
                  <div className={`grid gap-3 sm:grid-cols-2 ${isExternal ? 'xl:grid-cols-2' : 'xl:grid-cols-5'}`}>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-black text-slate-700">Pool Rate</span>
                      <div className="relative">
                        <input type="number" min="6" max="15" step="0.01" data-example="8%" value={selectedRate.seller_group_pool_rate} onChange={(event) => updateRate(projectId, 'seller_group_pool_rate', event.target.value)} disabled={disabled} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                      </div>
                    </label>

                    {isExternal ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-black text-blue-900">External Group Commission</p>
                        <p className="mt-1 text-sm font-black text-blue-700">{moneyRate(pool)}% total</p>
                        <p className="mt-1 text-xs font-semibold text-blue-700">No in-house position breakdown is saved.</p>
                      </div>
                    ) : rateFields.map(([field, label, example]) => (
                      <label key={field} className="grid gap-1.5">
                        <span className="text-xs font-black text-slate-700">{label}</span>
                        <div className="relative">
                          <input type="number" min="0" max="15" step="0.01" data-example={example} value={selectedRate[field]} onChange={(event) => updateRate(projectId, field, event.target.value)} disabled={disabled || (field === 'division_manager_rate' && groupHeadRole === 'sales_director')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className={`mt-3 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`flex items-center gap-2 text-xs font-black ${valid ? 'text-emerald-700' : 'text-amber-800'}`}>{valid ? <FiCheckCircle /> : null}{isExternal ? `Full Pool Rate: ${moneyRate(pool)}%` : `Allocated ${moneyRate(allocated)}% of ${moneyRate(pool)}%`}</p>
                    <p className={`text-xs font-black ${valid ? 'text-emerald-700' : remaining < 0 ? 'text-red-700' : 'text-amber-800'}`}>{valid ? 'Ready' : remaining >= 0 ? `${moneyRate(remaining)}% remaining` : `${moneyRate(Math.abs(remaining))}% over pool`}</p>
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
