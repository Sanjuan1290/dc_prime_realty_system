import { useMemo, useState } from 'react'
import { FiMapPin, FiSearch } from 'react-icons/fi'

const getProjectId = (project) => Number(project.lot_project_id || project.id)
const getProjectName = (project) => project.lot_project_name || project.label || 'Unnamed project'
const POOL_RATE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 6)

/**
 * Project accreditation is explicit. A checked project is available to this
 * seller group and stores its own commission pool rate.
 */
const ProjectAccreditationFields = ({
  projects = [],
  projectRates = [],
  onChange,
  onRequestRemove,
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
      if (onRequestRemove) {
        onRequestRemove(project)
      } else {
        onChange(projectRates.filter((rate) => Number(rate.lot_project_id) !== projectId))
      }
      return
    }

    onChange([
      ...projectRates,
      {
        lot_project_id: projectId,
        seller_group_pool_rate: 8,
      },
    ])
  }

  const updatePoolRate = (projectId, value) => {
    onChange(projectRates.map((rate) => (
      Number(rate.lot_project_id) === Number(projectId)
        ? { ...rate, seller_group_pool_rate: value }
        : rate
    )))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">
            Accredited Projects <span className="text-red-500">*</span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Select only the projects this group may sell. Set a separate pool rate for each selection.
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

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {filteredProjects.map((project) => {
          const projectId = getProjectId(project)
          const selectedRate = selectedMap.get(projectId)
          const checked = Boolean(selectedRate)
          const location = project.lot_project_location || project.location || 'No location set'

          return (
            <article
              key={projectId}
              className={`rounded-2xl border p-4 transition ${
                checked
                  ? 'border-blue-300 bg-white ring-4 ring-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
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
                <label className="mt-4 flex flex-col gap-1.5">
                  <span className="text-xs font-black text-slate-700">Group Pool Rate</span>
                  <select
                    value={String(selectedRate.seller_group_pool_rate)}
                    onChange={(event) => updatePoolRate(projectId, event.target.value)}
                    disabled={disabled}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-black outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
                  >
                    {!POOL_RATE_OPTIONS.includes(Number(selectedRate.seller_group_pool_rate)) ? (
                      <option value={selectedRate.seller_group_pool_rate}>
                        {Number(selectedRate.seller_group_pool_rate || 0).toFixed(2)}% (Current)
                      </option>
                    ) : null}
                    {POOL_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>{rate.toFixed(2)}%</option>
                    ))}
                  </select>
                  <span className="text-[11px] font-semibold text-slate-500">Choose a pool rate from 6% to 15%.</span>
                </label>
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


