import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiRefreshCw, FiSettings } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import useCurrentUser from '../../utils/useCurrentUser'
import SystemSettingsForm from '../../components/System/settingsComponents/SystemSettingsForm'
import { formatDateTime } from '../../utils/formatDateTime'
import { useFetch, useFetchPut } from '../../utils/useFetch'

const defaultForm = {
  companyName: '',
  companyEmail: '',
  companyContactNumber: '',
  companyAddress: '',
  companyTin: '',
  systemStatus: 'active',
  maintenanceMessage: '',
  reservationContactName: '',
  reservationContactEmail: '',
  reservationContactNumber: '',
  defaultReleaseDayOne: 7,
  defaultReleaseDayTwo: 22,
}

const mapSettingsToForm = (settings = {}) => ({
  companyName: settings.companyName || '',
  companyEmail: settings.companyEmail || '',
  companyContactNumber: settings.companyContactNumber || '',
  companyAddress: settings.companyAddress || '',
  companyTin: settings.companyTin || '',
  systemStatus: settings.systemStatus || 'active',
  maintenanceMessage: settings.maintenanceMessage || '',
  reservationContactName: settings.reservationContactName || '',
  reservationContactEmail: settings.reservationContactEmail || '',
  reservationContactNumber: settings.reservationContactNumber || '',
  defaultReleaseDayOne: settings.defaultReleaseDayOne || 7,
  defaultReleaseDayTwo: settings.defaultReleaseDayTwo || 22,
})

const Settings = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = currentUserData?.user?.role === 'super_admin'
  const queryClient = useQueryClient()
  const [form, setForm] = useState(defaultForm)
  const [alert, setAlert] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => useFetch('/system-settings'),
  })

  const settings = data?.data || null

  useEffect(() => {
    if (settings && !isEditing) setForm(mapSettingsToForm(settings))
  }, [settings, isEditing])

  const saveMutation = useMutation({
    mutationFn: (payload) => useFetchPut('/system-settings', payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving system settings...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'System settings saved.' })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to save settings.' }),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isEditing || !canManage) return
    saveMutation.mutate(form)
  }

  const handleCancel = () => {
    setForm(mapSettingsToForm(settings || defaultForm))
    setIsEditing(false)
    setAlert(null)
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="System Settings"
          description="Global company profile, reservation fallback contact, release days, and system status."
          icon={FiSettings}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching || saveMutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canManage && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isLoading || isError || !settings}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiEdit2 className="h-4 w-4" />
              Edit Settings
            </button>
          ) : null}
        </div>
      </div>

      {!canManage ? <ReadOnlyNotice message="Admin can review system settings. Only a Super Admin can edit and save changes." /> : null}

      {alert ? (
        <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} />
      ) : null}

      {isError ? (
        <StatusAlert type="error" message={error?.message || 'Failed to load system settings.'} />
      ) : null}

      {isLoading ? (
        <StatusAlert type="loading" message="Loading system settings..." />
      ) : null}

      {settings?.updatedAt ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
          Last saved by <span className="font-black text-slate-900">{settings.updatedByName || 'System'}</span> on{' '}
          <span className="font-black text-slate-900">{formatDateTime(settings.updatedAt)}</span>.
        </section>
      ) : null}

      <SystemSettingsForm
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isSaving={saveMutation.isPending}
        disabled={!isEditing || !canManage}
        onCancel={handleCancel}
      />
    </main>
  )
}

export default Settings


