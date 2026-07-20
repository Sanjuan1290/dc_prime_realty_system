import { useMemo, useState } from 'react'
import { FiCheckCircle, FiMapPin, FiSearch } from 'react-icons/fi'

const getProjectId = (project) => Number(project.lot_project_id || project.id)
const getProjectName = (project) => project.lot_project_name || project.label || 'Unnamed project'
const moneyRate = (value) => Number(value || 0).toFixed(2)

const createDefaultRates = (projectId, groupHeadRole) => {
  const bnmRate = groupHeadRole === 'broker' ? 0 : 1
  const brokerRate = 1
  const managerRate = 1
  const poolRate = 8
  return {
    lot_project_id: projectId,
    seller_group_pool_rate: poolRate,
    bnm_override_rate: bnmRate,
    broker_override_rate: brokerRate,
    manager_override_rate: managerRate,
    agent_rate: poolRate - bnmRate - brokerRate - managerRate,
  }
}

const rateFields = [
  ['bnm_override_rate', 'BNM Override'],
  ['broker_override_rate', 'Broker Override'],
  ['manager_override_rate', 'Manager Override'],
  ['agent_rate', 'Agent Sales Rate'],
]

const ProjectAccreditationFields = ({
  projects = [],
  projectRates = [],
  onChange,
  onRequestRemove,
  groupHeadRole = 'broker_network_manager',
  disabled = false,
}) => {
  const [search, setSearch] = useState('')

  const selectedMap = useMemo(
    () => new Map(projectRates.map((rate) => [Number(rate.lot_project_id), rate])),
    [projectRates]
  )

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => [
      getProjectName(project),
      project.lot_project_location,
      project.location,
      project.lot_project_location_code,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [projects, search])

  const toggleProject = (project) => {
    const projectId = getProjectId(project)
    if (selectedMap.has(projectId)) {
      if (onRequestRemove) onRequestRemove(project)
      else onChange(projectRates.filter((rate) => Number(rate.lot_project_id) !== projectId))
      return
    }

    onChange([...projectRates, createDefaultRates(projectId, groupHeadRole)])
  }

  const updateRate = (projectId, field, value) => {
    onChange(projectRates.map((rate) => {
      if (Number(rate.lot_project_id) !== Number(projectId)) return rate
      const next = { ...rate, [field]: value }
      if (field === 'seller_group_pool_rate') {
        const fixedOverrides = Number(next.bnm_override_rate || 0)
          + Number(next.broker_override_rate || 0)
          + Number(next.manager_override_rate || 0)
        next.agent_rate = Math.max(Number(value || 0) - fixedOverrides, 0).toFixed(2)
      }
      return next
    }))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">
            Accredited Projects and Fixed Rates <span className="text-red-500">*</span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Every seller in this Realty uses the same project rate for their role. The four role rates must equal the project pool.
          </p>
        </div>
        <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
          {projectRates.length} selected
        </span>
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">Search projects</span>
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search project, location, or code..."
          disabled={disabled}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
        />
      </label>

      <div className="mt-4 grid gap-4">
        {filteredProjects.map((project) => {
          const projectId = getProjectId(project)
          const selectedRate = selectedMap.get(projectId)
          const checked = Boolean(selectedRate)
          const location = project.lot_project_location || project.location || 'No location set'
          const allocated = checked
            ? Number(selectedRate.bnm_override_rate || 0)
              + Number(selectedRate.broker_override_rate || 0)
              + Number(selectedRate.manager_override_rate || 0)
              + Number(selectedRate.agent_rate || 0)
            : 0
          const pool = Number(selectedRate?.seller_group_pool_rate || 0)
          const remaining = Number((pool - allocated).toFixed(2))
          const valid = checked
            && pool >= 6
            && pool <= 15
            && Math.abs(remaining) < 0.001
            && Number(selectedRate.broker_override_rate || 0) > 0
            && Number(selectedRate.manager_override_rate || 0) > 0
            && Number(selectedRate.agent_rate || 0) > 0
            && (groupHeadRole === 'broker'
              ? Number(selectedRate.bnm_override_rate || 0) === 0
              : Number(selectedRate.bnm_override_rate || 0) > 0)

          return (
            <article
              key={projectId}
              className={`rounded-2xl border p-4 transition ${checked ? 'border-blue-300 bg-white ring-4 ring-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProject(project)}
                  disabled={disabled}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-slate-950">{getProjectName(project)}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <FiMapPin className="shrink-0" />
                    {location}
                    {project.lot_project_location_code ? ` · ${project.lot_project_location_code}` : ''}
                  </span>
                </span>
              </label>

              {checked ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-black text-slate-700">Project Pool</span>
                      <div className="relative">
                        <input
                          type="number"
                          min="6"
                          max="15"
                          step="0.01"
                          value={selectedRate.seller_group_pool_rate}
                          onChange={(event) => updateRate(projectId, 'seller_group_pool_rate', event.target.value)}
                          disabled={disabled}
                          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                      </div>
                    </label>

                    {rateFields.map(([field, label]) => (
                      <label key={field} className="grid gap-1.5">
                        <span className="text-xs font-black text-slate-700">{label}</span>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="15"
                            step="0.01"
                            value={selectedRate[field]}
                            onChange={(event) => updateRate(projectId, field, event.target.value)}
                            disabled={disabled || (field === 'bnm_override_rate' && groupHeadRole === 'broker')}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className={`mt-3 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`flex items-center gap-2 text-xs font-black ${valid ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {valid ? <FiCheckCircle /> : null}
                      Allocated {moneyRate(allocated)}% of {moneyRate(pool)}%
                    </p>
                    <p className={`text-xs font-black ${valid ? 'text-emerald-700' : remaining < 0 ? 'text-red-700' : 'text-amber-800'}`}>
                      {valid ? 'Ready' : remaining >= 0 ? `${moneyRate(remaining)}% remaining` : `${moneyRate(Math.abs(remaining))}% over pool`}
                    </p>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {!filteredProjects.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
          No projects match your search.
        </p>
      ) : null}
    </section>
  )
}

export default ProjectAccreditationFields
