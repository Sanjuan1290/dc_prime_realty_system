import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiRefreshCw, FiSettings } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EditSettingsModal from '../../components/Lot_Projects/SettingsComponents/EditSettingsModal/EditSettingsModal'
import { useFetch, useFetchPut } from '../../utils/useFetch'

const daySuffix = (value) => {
  const number = Number(value || 0)
  if (!number) return '-'
  if ([11, 12, 13].includes(number % 100)) return `${number}th of the month`
  const last = number % 10
  if (last === 1) return `${number}st of the month`
  if (last === 2) return `${number}nd of the month`
  if (last === 3) return `${number}rd of the month`
  return `${number}th of the month`
}

const InfoItem = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-sm font-black text-slate-950">{value || '-'}</p>
  </div>
)

const SettingCard = ({ title, description, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        {description}
      </p>
    </div>

    <div className="mt-5">{children}</div>
  </section>
)

const Settings = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [alert, setAlert] = useState(null)

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-project-settings', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/settings`),
    enabled: Boolean(projectSlug),
  })

  const settings = data?.data || {}
  const project = data?.project || {}
  const canEdit = Boolean(data?.canEdit)

  const updateSettingsMutation = useMutation({
    mutationFn: (payload) => useFetchPut(`/projects/lot-projects/${projectSlug}/settings`, payload),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Saving project settings...' })
    },
    onSuccess: (result) => {
      setShowEdit(false)
      setAlert({ type: 'success', message: result?.message || 'Project settings saved successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-project-settings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError?.message || 'Failed to save settings.' })
    },
  })

  const handleSaveSettings = (updatedSettings) => {
    updateSettingsMutation.mutate(updatedSettings)
  }

  const handleRefresh = () => {
    setAlert({ type: 'info', message: 'Refreshing project settings...' })
    refetch()
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}
      {isLoading ? <StatusAlert type="loading" message="Loading project settings..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing project settings..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load settings.'} /> : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={`${project.name || 'Lot Project'} Settings`}
          description="Manage commission release days, reservation contact, and company information."
          icon={FiSettings}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canEdit) {
                setAlert({ type: 'warning', message: 'Only super admin can edit project settings.' })
                return
              }

              setShowEdit(true)
              setAlert({ type: 'info', message: 'Edit Settings opened.' })
            }}
            disabled={isLoading || updateSettingsMutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiEdit2 className="h-4 w-4" />
            {canEdit ? 'Edit Settings' : 'View Only'}
          </button>
        </div>
      </section>

      {!canEdit && !isLoading ? (
        <StatusAlert type="info" message="Settings are view-only for this account. Only super admin can edit release days and project contact details." />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <SettingCard
          title="Commission Release Days"
          description="Allowed days when Super Admin can release eligible commissions."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="First Release Day" value={daySuffix(settings.releaseDayOne)} />
            <InfoItem label="Second Release Day" value={daySuffix(settings.releaseDayTwo)} />
          </div>
        </SettingCard>

        <SettingCard
          title="Reservation Contact"
          description="Default assistance contact shown for reservation-related concerns."
        >
          <div className="grid gap-3">
            <InfoItem label="Name" value={settings.reservationContactName} />
            <InfoItem label="Email" value={settings.reservationContactEmail} />
            <InfoItem label="Contact Number" value={settings.reservationContactNumber} />
          </div>
        </SettingCard>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-950">Company Information</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Used for printouts, headers, and system identity.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoItem label="Company Name" value={settings.companyName} />
          <InfoItem label="Company Email" value={settings.companyEmail} />
          <InfoItem label="Company Contact Number" value={settings.companyContactNumber} />
        </div>
      </section>

      {showEdit ? (
        <EditSettingsModal
          settings={settings}
          isSaving={updateSettingsMutation.isPending}
          onClose={() => {
            if (updateSettingsMutation.isPending) return
            setShowEdit(false)
            setAlert({ type: 'info', message: 'Edit cancelled.' })
          }}
          onSave={handleSaveSettings}
        />
      ) : null}
    </main>
  )
}

export default Settings
