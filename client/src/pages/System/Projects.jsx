import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import useCurrentUser from '../../utils/useCurrentUser'
import AddLotProjectModal from '../../components/System/projectComponents/AddLotProjectModal'
import HouseLotProjectModal from '../../components/System/projectComponents/HouseLotProjectModal'
import {
  useFetch,
  useFetchDelete,
  useFetchPatch,
  useFetchPost,
} from '../../utils/useFetch'

const StatCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
  </div>
)

const DocumentChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-black text-slate-950">{label}</p>
      <div className="mt-2 grid gap-1.5">
        {payload.map((item, index) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center gap-2 font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color || item.fill || '#94a3b8' }} />
            <span>{item.name}: <strong className="text-slate-950">{Number(item.value || 0).toLocaleString('en-PH')}</strong></span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

const normalizeProject = (project) => ({
  id: project.id || project.lot_project_id,
  type: project.type || 'lot',
  name: project.name || project.lot_project_name,
  location: project.location || project.lot_project_location,
  locationCode: project.locationCode || project.lot_project_location_code,
  cadastralLots: project.cadastralLots || [],
  defaultDocs: Number(project.defaultDocs || project.default_documents_count || 0),
  requiredDocs: Number(project.requiredDocs || project.required_documents_count || 0),
  totalAccounts: Number(project.totalAccounts || 0),
  accountsWithCompletedDocuments: Number(project.accountsWithCompletedDocuments || 0),
  accountsWithPendingDocuments: Number(project.accountsWithPendingDocuments || 0),
  totalDocuments: Number(project.totalDocuments || 0),
  submittedDocuments: Number(project.submittedDocuments || 0),
  pendingRequiredDocuments: Number(project.pendingRequiredDocuments || 0),
  status: project.status || project.lot_project_status,
  routePath:
    project.routePath ||
    `/lot-projects/${project.slug || project.lot_project_slug}`,
})

const Projects = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = currentUserData?.user?.role === 'super_admin'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showLotModal, setShowLotModal] = useState(false)
  const [showHouseLotModal, setShowHouseLotModal] = useState(false)
  const [alert, setAlert] = useState(null)
  const [deletingProjectId, setDeletingProjectId] = useState(null)
  const [selectedDocumentProjectId, setSelectedDocumentProjectId] = useState('all')
  const [documentPage, setDocumentPage] = useState(1)
  const [documentPageSize, setDocumentPageSize] = useState(10)

  const {
    data: projectsResponse,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
  } = useQuery({
    queryKey: ['lot-projects'],
    queryFn: () => useFetch('/projects/lot-projects'),
  })

  const {
    data: complianceResponse,
    isLoading: isComplianceLoading,
    isError: isComplianceError,
    error: complianceError,
  } = useQuery({
    queryKey: ['lot-project-document-compliance'],
    queryFn: () => useFetch('/projects/lot-projects/document-compliance'),
  })

  const {
    data: documentsResponse,
    isLoading: isDocumentsLoading,
    isError: isDocumentsError,
    error: documentsError,
  } = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
  })

  const {
    data: templatesResponse,
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
    error: templatesError,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: () => useFetch('/documents/getTemplates'),
  })

  const complianceByProjectId = useMemo(() => new Map(
    (complianceResponse?.data?.projects || []).map((item) => [String(item.projectId), item])
  ), [complianceResponse])

  const projects = useMemo(
    () => (projectsResponse?.data || []).map((rawProject) => {
      const project = normalizeProject(rawProject)
      const compliance = complianceByProjectId.get(String(project.id)) || {}
      return {
        ...project,
        totalAccounts: Number(compliance.totalAccounts || 0),
        accountsWithCompletedDocuments: Number(compliance.accountsWithCompletedDocuments || 0),
        accountsWithPendingDocuments: Number(compliance.accountsWithPendingDocuments || 0),
        totalDocuments: Number(compliance.totalDocuments || 0),
        submittedDocuments: Number(compliance.submittedDocuments || 0),
        pendingRequiredDocuments: Number(compliance.pendingRequiredDocuments || 0),
      }
    }),
    [complianceByProjectId, projectsResponse]
  )

  const complianceUnits = useMemo(
    () => complianceResponse?.data?.units || [],
    [complianceResponse]
  )
  const activeDocumentProjectId = selectedDocumentProjectId || 'all'

  const selectedDocumentUnits = useMemo(
    () => complianceUnits.filter((unit) => {
      if (activeDocumentProjectId !== 'all' && String(unit.projectId) !== String(activeDocumentProjectId)) return false
      const total = Number(unit.totalDocuments || 0)
      const approved = Number(unit.approvedDocuments || 0)
      return total > 0 && approved < total
    }),
    [activeDocumentProjectId, complianceUnits]
  )

  const documentTotalPages = Math.max(1, Math.ceil(selectedDocumentUnits.length / documentPageSize))
  const documentCurrentPage = Math.min(documentPage, documentTotalPages)
  const paginatedDocumentUnits = useMemo(
    () => selectedDocumentUnits.slice((documentCurrentPage - 1) * documentPageSize, documentCurrentPage * documentPageSize),
    [documentCurrentPage, documentPageSize, selectedDocumentUnits]
  )

  const selectedDocumentChartRows = useMemo(
    () => paginatedDocumentUnits.map((unit) => ({
      unit: activeDocumentProjectId === 'all' ? `${unit.projectName} · ${unit.unitId}` : unit.unitId,
      approved: Number(unit.approvedDocuments || 0),
      awaitingApproval: Number(unit.awaitingApprovalDocuments || 0),
      pendingRequired: Number(unit.pendingRequiredDocuments || 0),
    })),
    [activeDocumentProjectId, paginatedDocumentUnits]
  )

  const documents = documentsResponse?.documents || []
  const templates = templatesResponse?.templates || []
  const templateDocuments = templatesResponse?.template_documents || []

  const addProjectMutation = useMutation({
    mutationFn: (payload) => useFetchPost('/projects/lot-projects', payload),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Saving lot project...' })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lot-projects'] })
      queryClient.invalidateQueries({ queryKey: ['lot-project-options'] })
      setShowLotModal(false)
      setAlert({ type: 'success', message: data?.message || 'Lot project added successfully.' })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error.message || 'Failed to save lot project.' })
    },
  })

  const changeStatusMutation = useMutation({
    mutationFn: (projectId) =>
      useFetchPatch(`/projects/lot-projects/${projectId}/status`, {
        status: 'inactive',
      }),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Changing project status to inactive...' })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lot-projects'] })
      queryClient.invalidateQueries({ queryKey: ['lot-project-options'] })
      setAlert({ type: 'warning', message: data?.message || 'Project status changed to inactive.' })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error.message || 'Failed to change project status.' })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (project) => useFetchDelete(`/projects/lot-projects/${project.id}`),
    onMutate: (project) => {
      setDeletingProjectId(project.id)
      setAlert({ type: 'loading', message: `Deleting ${project.name}...` })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lot-projects'] })
      queryClient.invalidateQueries({ queryKey: ['lot-project-options'] })
      setAlert({ type: 'success', message: data?.message || 'Project deleted successfully.' })
    },
    onError: (error, project) => {
      const message = error.message || 'Failed to delete project.'

      if (message.toLowerCase().includes('listed unit')) {
        const changeStatus = window.confirm(`${message}\n\nChange this project status to inactive instead?`)

        if (changeStatus) {
          changeStatusMutation.mutate(project.id)
          return
        }
      }

      setAlert({ type: 'error', message })
    },
    onSettled: () => setDeletingProjectId(null),
  })

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
    const pendingDocumentAccounts = projects.reduce(
      (sum, project) => sum + Number(project.accountsWithPendingDocuments || 0),
      0
    )

    return {
      total: projects.length,
      active,
      inactive,
      pendingDocumentAccounts,
    }
  }, [projects])

  const handleReset = () => {
    setSearch('')
    setStatusFilter('all')
    setAlert({ type: 'info', message: 'Filters reset.' })
  }

  const handleAddLotProject = async (project) => {
    await addProjectMutation.mutateAsync(project)
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

    if (!project) {
      setAlert({
        type: 'error',
        message: 'Project not found.',
      })
      return
    }

    const confirmed = window.confirm(`Delete "${project.name}"? This cannot be undone.`)
    if (!confirmed) return

    deleteProjectMutation.mutate(project)
  }

  return (
    <main className="flex flex-col gap-6">
      {!canManage ? <ReadOnlyNotice message="Admin can open and review projects. Only a Super Admin can add, delete, or change project status." /> : null}

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isProjectsLoading ? (
        <StatusAlert type="loading" message="Loading projects..." />
      ) : null}

      {isProjectsError ? (
        <StatusAlert
          type="error"
          message={projectsError?.message || 'Failed to load projects.'}
        />
      ) : null}

      {isDocumentsError ? (
        <StatusAlert
          type="warning"
          message={documentsError?.message || 'Failed to load document library.'}
        />
      ) : null}

      {isTemplatesError ? (
        <StatusAlert
          type="warning"
          message={templatesError?.message || 'Failed to load document templates.'}
        />
      ) : null}

      {isComplianceError ? (
        <StatusAlert
          type="warning"
          message={complianceError?.message || 'Failed to load project document compliance.'}
        />
      ) : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Projects"
          description="Create lot projects and configure their default document requirements."
          icon={FiMap}
        />

        {canManage ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowLotModal(true)}
            disabled={isDocumentsLoading || isTemplatesLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Projects" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Inactive" value={stats.inactive} />
        <StatCard label="No. of Incomplete Documents (per account)" value={isComplianceLoading ? '...' : stats.pendingDocumentAccounts} />
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
                  'No. of Accounts Docs Completed / No. of Accounts',
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
              {filteredProjects.map((project) => {
                const isDeleting =
                  deleteProjectMutation.isPending && deletingProjectId === project.id

                return (
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
                      {project.accountsWithCompletedDocuments} / {project.totalAccounts} accounts
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

                        {canManage ? (
                          <button type="button" onClick={() => handleDelete(project.id)} disabled={deleteProjectMutation.isPending || changeStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700 disabled:opacity-60"><FiTrash2 className="h-3.5 w-3.5" />{isDeleting ? 'Deleting...' : 'Delete'}</button>
                        ) : <span className="inline-flex h-9 items-center px-3 text-xs font-semibold text-slate-400">View only</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}

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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Unit Document Compliance</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Only incomplete document submissions are shown. Fully approved units and finalized cancelled units are excluded.</p>
          </div>
          <label className="grid gap-1 lg:w-72">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Project</span>
            <select value={activeDocumentProjectId} onChange={(event) => { setSelectedDocumentProjectId(event.target.value); setDocumentPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
              <option value="all">All Projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 h-[360px] rounded-2xl border border-slate-100 bg-slate-50 p-3">
          {isComplianceLoading ? (
            <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Loading document compliance...</div>
          ) : selectedDocumentChartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedDocumentChartRows} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="unit" width={activeDocumentProjectId === 'all' ? 180 : 82} tick={{ fontSize: 11 }} />
                <Tooltip content={<DocumentChartTooltip />} />
                <Legend />
                <Bar dataKey="approved" name="Approved" stackId="documents" fill="#059669" />
                <Bar dataKey="awaitingApproval" name="Awaiting Approval" stackId="documents" fill="#d97706" />
                <Bar dataKey="pendingRequired" name="Pending Required" stackId="documents" fill="#dc2626" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500">No incomplete document submissions for the selected project scope.</div>
          )}
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{['Project', 'Unit', 'Buyer', 'Status', 'Submitted / Total', 'Approved', 'Awaiting Approval', 'Pending Required', 'Progress', 'Action'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDocumentUnits.length ? paginatedDocumentUnits.map((unit) => (
                <tr key={`${unit.projectId}-${unit.listingId}`} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-600">{unit.projectName}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{unit.unitId}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{unit.buyerName}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{unit.listingStatus === 'pending_for_cancellation' ? 'Pending Cancellation' : unit.soldSubstatus === 'fully_paid' ? 'Fully Paid' : 'Sold / Active'}</td>
                  <td className="px-4 py-4 font-black text-blue-700">{unit.submittedDocuments} / {unit.totalDocuments}</td>
                  <td className="px-4 py-4 font-semibold text-emerald-700">{unit.approvedDocuments}</td>
                  <td className="px-4 py-4 font-semibold text-amber-700">{unit.awaitingApprovalDocuments}</td>
                  <td className="px-4 py-4 font-semibold text-red-700">{unit.pendingRequiredDocuments}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(Number(unit.completionPercentage || 0), 100)}%` }} /></div><span className="text-xs font-black text-slate-600">{Number(unit.completionPercentage || 0).toFixed(0)}%</span></div></td>
                  <td className="px-4 py-4"><button type="button" onClick={() => navigate(`/lot-projects/${unit.projectSlug}/listings/${unit.listingId}`)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FiEye /> Open</button></td>
                </tr>
              )) : <tr><td colSpan={10} className="px-4 py-10 text-center font-semibold text-slate-500">No incomplete unit document records for the selected project scope.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {selectedDocumentUnits.length ? ((documentCurrentPage - 1) * documentPageSize) + 1 : 0}-{Math.min(documentCurrentPage * documentPageSize, selectedDocumentUnits.length)} of {selectedDocumentUnits.length} incomplete records
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={documentPageSize} onChange={(event) => { setDocumentPageSize(Number(event.target.value)); setDocumentPage(1) }} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
              {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" onClick={() => setDocumentPage(documentCurrentPage - 1)} disabled={documentCurrentPage <= 1} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Previous</button>
            <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">Page {documentCurrentPage} of {documentTotalPages}</span>
            <button type="button" onClick={() => setDocumentPage(documentCurrentPage + 1)} disabled={documentCurrentPage >= documentTotalPages} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Next</button>
          </div>
        </div>
      </section>

      {showLotModal && canManage ? (
        <AddLotProjectModal
          documents={documents}
          templates={templates}
          templateDocuments={templateDocuments}
          isLoadingDocuments={isDocumentsLoading || isTemplatesLoading}
          onClose={() => setShowLotModal(false)}
          onSave={handleAddLotProject}
        />
      ) : null}

      {showHouseLotModal && canManage ? (
        <HouseLotProjectModal onClose={() => setShowHouseLotModal(false)} />
      ) : null}
    </main>
  )
}

export default Projects
