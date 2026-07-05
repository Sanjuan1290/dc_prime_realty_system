import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiEye,
  FiFileText,
  FiHome,
  FiMap,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AddLotProjectModal from '../../components/System/projectComponents/AddLotProjectModal'
import HouseLotProjectModal from '../../components/System/projectComponents/HouseLotProjectModal'

const initialProjects = [
  {
    id: 1,
    type: 'lot',
    name: 'Maragondon',
    location: 'Maragondon, Cavite',
    locationCode: 'PE',
    cadastralLots: [],
    defaultDocs: 14,
    requiredDocs: 14,
    status: 'active',
    routePath: '/maragondonProject',
  },
  {
    id: 2,
    type: 'lot',
    name: 'Bailen Project',
    location: 'Bailen, Cavite',
    locationCode: 'LA',
    cadastralLots: ['1306', '1314'],
    defaultDocs: 14,
    requiredDocs: 14,
    status: 'active',
    routePath: '/bailenProject',
  },
]

const StatCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
  </div>
)

const StatusPill = ({ status }) => {
  const isActive = status === 'active'

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

const Projects = () => {
  const navigate = useNavigate()

  const [projects, setProjects] = useState(initialProjects)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showLotModal, setShowLotModal] = useState(false)
  const [showHouseLotModal, setShowHouseLotModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return projects.filter((project) => {
      const matchesSearch =
        !keyword ||
        `${project.name} ${project.location} ${project.locationCode} ${project.cadastralLots.join(' ')}`
          .toLowerCase()
          .includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || project.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [projects, search, statusFilter])

  const stats = useMemo(() => {
    const active = projects.filter((project) => project.status === 'active').length
    const inactive = projects.filter((project) => project.status === 'inactive').length
    const requiredDocs = projects.reduce(
      (sum, project) => sum + Number(project.requiredDocs || 0),
      0
    )

    return {
      total: projects.length,
      active,
      inactive,
      requiredDocs,
    }
  }, [projects])

  const handleReset = () => {
    setSearch('')
    setStatusFilter('all')
    setAlert({ type: 'info', message: 'Filters reset.' })
  }

  const handleAddLotProject = (project) => {
    setProjects((current) => [project, ...current])
    setShowLotModal(false)

    setAlert({
      type: 'success',
      message: `${project.name} added as a Lot Project in mock mode.`,
    })
  }

  const handleOpenProject = (project) => {
    if (!project.routePath) {
      setAlert({
        type: 'warning',
        message: `${project.name} does not have a system page yet.`,
      })
      return
    }

    navigate(project.routePath)
  }

  const handleDelete = (projectId) => {
    const project = projects.find((item) => item.id === projectId)

    setProjects((current) => current.filter((item) => item.id !== projectId))

    setAlert({
      type: 'warning',
      message: `${project?.name || 'Project'} removed in mock mode.`,
    })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Projects"
          description="Create lot projects and configure their default document requirements."
          icon={FiMap}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowLotModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiPlus className="h-4 w-4" />
            Add Lot Project
          </button>

          <button
            type="button"
            onClick={() => setShowHouseLotModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-black text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
          >
            <FiHome className="h-4 w-4" />
            Add House & Lot Project
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Projects" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Inactive" value={stats.inactive} />
        <StatCard label="Required Docs" value={stats.requiredDocs} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, location, administrator, tax no, pin..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 xl:w-44"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <FiSearch className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Name',
                  'Type',
                  'Location',
                  'Location Code',
                  'Cadastral Lots',
                  'Default Docs',
                  'Status',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-slate-950">
                    {project.name}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        project.type === 'lot'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {project.type === 'lot' ? 'Lot Project' : 'House & Lot'}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {project.location}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700">
                      {project.locationCode}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {project.cadastralLots.length
                      ? project.cadastralLots.join(', ')
                      : '-'}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {project.defaultDocs} docs / {project.requiredDocs} required
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill status={project.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenProject(project)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiEye className="h-3.5 w-3.5" />
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredProjects.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <FiFileText className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No projects found
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Try changing your search or status filter.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing 1-{filteredProjects.length} of {filteredProjects.length} records
          </p>

          <div className="flex items-center gap-2">
            <select className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Previous
            </button>

            <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">
              Page 1 of 1
            </span>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Next
            </button>
          </div>
        </div>
      </section>

      {showLotModal ? (
        <AddLotProjectModal
          onClose={() => setShowLotModal(false)}
          onSave={handleAddLotProject}
        />
      ) : null}

      {showHouseLotModal ? (
        <HouseLotProjectModal onClose={() => setShowHouseLotModal(false)} />
      ) : null}
    </main>
  )
}

export default Projects