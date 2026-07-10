import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiClock, FiDatabase, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AuditLogDetailsModal from '../../components/System/auditLogsComponents/AuditLogDetailsModal'
import AuditLogFilters from '../../components/System/auditLogsComponents/AuditLogFilters'
import AuditLogTable from '../../components/System/auditLogsComponents/AuditLogTable'
import DeleteAuditLogsModal from '../../components/System/auditLogsComponents/DeleteAuditLogsModal'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'

const StatCard = ({ label, value, helper, icon: Icon, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    red: 'border-red-100 bg-red-50 text-red-950',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

const AuditLogs = () => {
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const [alert, setAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [module, setModule] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteRequest, setDeleteRequest] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const isSuperAdmin = currentUserData?.user?.role === 'super_admin'

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search.trim()) params.set('search', search.trim())
    if (action !== 'all') params.set('action', action)
    if (module !== 'all') params.set('module', module)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return params.toString()
  }, [action, from, limit, module, page, search, to])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', queryString],
    queryFn: () => useFetch(`/audit-logs?${queryString}`),
    keepPreviousData: true,
  })

  const requestDeleteMutation = useMutation({
    mutationFn: (password) => useFetchPost('/audit-logs/delete-all/request', { password }),
    onMutate: () => setDeleteError(''),
    onSuccess: (result) => {
      setDeleteRequest(result?.data || null)
      setDeleteError('')
    },
    onError: (mutationError) => {
      setDeleteError(mutationError?.message || 'Failed to send the verification code.')
    },
  })

  const confirmDeleteMutation = useMutation({
    mutationFn: (code) => useFetchPost('/audit-logs/delete-all/confirm', {
      verificationId: deleteRequest?.verificationId,
      code,
    }),
    onMutate: () => setDeleteError(''),
    onSuccess: (result) => {
      setShowDeleteModal(false)
      setDeleteRequest(null)
      setDeleteError('')
      setPage(1)
      setAlert({ type: 'success', message: result?.message || 'Audit logs deleted.' })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (mutationError) => {
      setDeleteError(mutationError?.message || 'Failed to delete audit logs.')
    },
  })

  const summary = data?.summary || { total: 0, created: 0, updated: 0, deleted: 0, last24Hours: 0 }
  const modules = data?.modules || []
  const logs = data?.data || []
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1 }

  const resetFilters = () => {
    setSearch('')
    setAction('all')
    setModule('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const openDeleteModal = () => {
    setDeleteRequest(null)
    setDeleteError('')
    requestDeleteMutation.reset()
    confirmDeleteMutation.reset()
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (requestDeleteMutation.isPending || confirmDeleteMutation.isPending) return
    setShowDeleteModal(false)
    setDeleteRequest(null)
    setDeleteError('')
    requestDeleteMutation.reset()
    confirmDeleteMutation.reset()
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="Audit Logs"
          description="Track system activity, account actions, settings changes, and security events."
          icon={FiActivity}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isSuperAdmin ? (
            <button
              type="button"
              onClick={openDeleteModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-red-700"
            >
              <FiTrash2 className="h-4 w-4" />
              Delete Audit Logs
            </button>
          ) : null}
        </div>
      </div>

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isError ? (
        <StatusAlert type="error" message={error?.message || 'Failed to load audit logs.'} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Logs" value={summary.total} helper="All audit entries" icon={FiDatabase} />
        <StatCard label="Created" value={summary.created} helper="Create actions" icon={FiPlus} tone="emerald" />
        <StatCard label="Updated" value={summary.updated} helper="Save/edit actions" icon={FiActivity} tone="blue" />
        <StatCard label="Deleted" value={summary.deleted} helper="Delete actions" icon={FiTrash2} tone="red" />
        <StatCard label="Last 24 Hours" value={summary.last24Hours} helper="Recent activity" icon={FiClock} tone="amber" />
      </section>

      <AuditLogFilters
        search={search}
        setSearch={(value) => { setSearch(value); setPage(1) }}
        action={action}
        setAction={(value) => { setAction(value); setPage(1) }}
        module={module}
        setModule={(value) => { setModule(value); setPage(1) }}
        modules={modules}
        from={from}
        setFrom={(value) => { setFrom(value); setPage(1) }}
        to={to}
        setTo={(value) => { setTo(value); setPage(1) }}
        onReset={resetFilters}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      <AuditLogTable
        logs={logs}
        isLoading={isLoading}
        pagination={pagination}
        onView={setSelectedLog}
        page={page}
        setPage={setPage}
        limit={limit}
        setLimit={setLimit}
      />

      {selectedLog ? (
        <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      ) : null}

      {showDeleteModal ? (
        <DeleteAuditLogsModal
          onClose={closeDeleteModal}
          onRequestCode={(password) => requestDeleteMutation.mutate(password)}
          onConfirmCode={(code) => confirmDeleteMutation.mutate(code)}
          requestData={deleteRequest}
          errorMessage={deleteError}
          isRequesting={requestDeleteMutation.isPending}
          isDeleting={confirmDeleteMutation.isPending}
        />
      ) : null}
    </main>
  )
}

export default AuditLogs
