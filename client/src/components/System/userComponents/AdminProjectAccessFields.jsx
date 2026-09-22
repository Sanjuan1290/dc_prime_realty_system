import { FiCheckSquare, FiSquare } from 'react-icons/fi'

const AdminProjectAccessFields = ({
  projects = [],
  allProjects = false,
  selectedProjectIds = [],
  onAllProjectsChange,
  onProjectToggle,
  canSelectAllProjects = true,
  isLoading = false,
  error = '',
}) => {
  const selected = new Set((selectedProjectIds || []).map((value) => Number(value)))

  return (
    <section className="w-full rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div>
        <p className="text-sm font-black text-slate-800">Project Access <span className="text-red-500">*</span></p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Choose where this account can use its assigned permissions. Permissions and project scope must both allow an action.</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label
          title={!canSelectAllProjects ? 'You can assign All Projects only when your own account is allowed to assign global project access.' : undefined}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-black ${canSelectAllProjects ? 'cursor-pointer border-blue-200 bg-white text-slate-800' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'}`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={Boolean(allProjects)}
            disabled={!canSelectAllProjects}
            onChange={(event) => onAllProjectsChange?.(event.target.checked)}
          />
          {allProjects ? <FiCheckSquare className="h-5 w-5 text-blue-600" /> : <FiSquare className="h-5 w-5" />}
          All Projects
        </label>

        {isLoading ? <p className="col-span-full py-3 text-sm font-semibold text-slate-500">Loading available projects...</p> : null}
        {error ? <p className="col-span-full py-3 text-sm font-semibold text-red-600">{error}</p> : null}

        {!isLoading && !error && projects.map((project) => {
          const projectId = Number(project.id || project.value || project.lot_project_id)
          const checked = allProjects || selected.has(projectId)
          return (
            <label key={projectId} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${allProjects ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={allProjects}
                onChange={() => onProjectToggle?.(projectId)}
              />
              {checked ? <FiCheckSquare className={`h-5 w-5 ${allProjects ? 'text-slate-400' : 'text-blue-600'}`} /> : <FiSquare className="h-5 w-5" />}
              <span>{project.name || project.label || project.lot_project_name || `Project ${projectId}`}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

export default AdminProjectAccessFields
