import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiActivity,
  FiArchive,
  FiClock,
  FiDatabase,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ArchiveAuditLogsModal from '../../components/System/auditLogsComponents/ArchiveAuditLogsModal'
import AuditLogDetailsModal from '../../components/System/auditLogsComponents/AuditLogDetailsModal'
import AuditLogFilters from '../../components/System/auditLogsComponents/AuditLogFilters'
import AuditLogTable from '../../components/System/auditLogsComponents/AuditLogTable'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'
import { isFullAccessAdministrator } from '../../config/permissions'

const StatCard = ({ label, value, helper, icon: Icon, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    red: 'border-red-100 bg-red-50 text-red-950',
    violet: 'border-violet-100 bg-violet-50 text-violet-950',
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

const downloadArchiveExport = async (exportUrl, fallbackFilename) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${exportUrl}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json() : null
    throw new Error(payload?.message || 'Failed to download the audit archive export.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
  const filename = filenameMatch?.[1] || fallbackFilename || 'audit-logs-archive.csv'
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
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
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveRequest, setArchiveRequest] = useState(null)
  const [archiveError, setArchiveError] = useState('')

  const isSuperAdmin = isFullAccessAdministrator(currentUserData?.user)

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

  const requestArchiveMutation = useMutation({
    mutationFn: (payload) => useFetchPost('/audit-logs/archive/request', payload),
    onMutate: () => setArchiveError(''),
    onSuccess: (result) => {
      setArchiveRequest(result?.data || null)
      setArchiveError('')
    },
    onError: (mutationError) => {
      setArchiveError(mutationError?.message || 'Failed to send the verification code.')
    },
  })

  const confirmArchiveMutation = useMutation({
    mutationFn: (code) => useFetchPost('/audit-logs/archive/confirm', {
      verificationId: archiveRequest?.verificationId,
      code,
    }),
    onMutate: () => setArchiveError(''),
    onSuccess: async (result) => {
      setShowArchiveModal(false)
      setArchiveRequest(null)
      setArchiveError('')
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })

      try {
        await downloadArchiveExport(result?.data?.exportUrl, result?.data?.exportFilename)
        setAlert({ type: 'success', message: result?.message || 'Old audit logs were exported and archived.' })
      } catch (downloadError) {
        setAlert({
          type: 'warning',
          message: `${result?.message || 'Old audit logs were archived.'} ${downloadError?.message || 'The export download did not start.'}`,
        })
      }
    },
    onError: (mutationError) => {
      setArchiveError(mutationError?.message || 'Failed to archive audit logs.')
    },
  })

  const summary = data?.summary || { total: 0, created: 0, updated: 0, deleted: 0, last24Hours: 0 }
  const archivePolicy = data?.archivePolicy || {
    retentionDays: 365,
    minRetentionDays: 90,
    maxRetentionDays: 3650,
    archivedTotal: 0,
    eligibleTotal: 0,
    lastArchivedAt: null,
  }
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

  const openArchiveModal = () => {
    setArchiveRequest(null)
    setArchiveError('')
    requestArchiveMutation.reset()
    confirmArchiveMutation.reset()
    setShowArchiveModal(true)
  }

  const closeArchiveModal = () => {
    if (requestArchiveMutation.isPending || confirmArchiveMutation.isPending) return
    setShowArchiveModal(false)
    setArchiveRequest(null)
    setArchiveError('')
    requestArchiveMutation.reset()
    confirmArchiveMutation.reset()
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
              onClick={openArchiveModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
            >
              <FiArchive className="h-4 w-4" />
              Archive Old Logs
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Active Logs" value={summary.total} helper="Current searchable entries" icon={FiDatabase} />
        <StatCard label="Archived" value={archivePolicy.archivedTotal} helper={`${archivePolicy.eligibleTotal} ready to archive`} icon={FiArchive} tone="violet" />
        <StatCard label="Created" value={summary.created} helper="Create actions" icon={FiPlus} tone="emerald" />
        <StatCard label="Updated" value={summary.updated} helper="Save/edit actions" icon={FiActivity} tone="blue" />
        <StatCard label="Delete Actions" value={summary.deleted} helper="Recorded delete events" icon={FiTrash2} tone="red" />
        <StatCard label="Last 24 Hours" value={summary.last24Hours} helper="Recent activity" icon={FiClock} tone="amber" />
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-900">
        <p className="font-black">Audit retention: {archivePolicy.retentionDays} days</p>
        <p className="mt-1">Permanent delete-all is disabled. Only a full-access administrator can export and archive records older than the retention period.</p>
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

      {showArchiveModal ? (
        <ArchiveAuditLogsModal
          onClose={closeArchiveModal}
          onRequestCode={(payload) => requestArchiveMutation.mutate(payload)}
          onConfirmCode={(code) => confirmArchiveMutation.mutate(code)}
          requestData={archiveRequest}
          errorMessage={archiveError}
          isRequesting={requestArchiveMutation.isPending}
          isArchiving={confirmArchiveMutation.isPending}
          defaultRetentionDays={archivePolicy.retentionDays}
          minRetentionDays={archivePolicy.minRetentionDays}
          maxRetentionDays={archivePolicy.maxRetentionDays}
          eligibleCount={archivePolicy.eligibleTotal}
        />
      ) : null}
    </main>
  )
}

export default AuditLogs

