import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiRefreshCw, FiSettings, FiShield } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import SettingsAuthorizationModal from '../../components/Shared/SettingsAuthorizationModal'
import useCurrentUser from '../../utils/useCurrentUser'
import SystemSettingsForm from '../../components/System/settingsComponents/SystemSettingsForm'
import RoleAccessControl from '../../components/System/settingsComponents/RoleAccessControl'
import { formatDateTime } from '../../utils/formatDateTime'
import {useFetch, useFetchPut, getDoubleCheckNotice} from '../../utils/useFetch'

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
  const [showRoleAccess, setShowRoleAccess] = useState(false)
  const [pendingAuthorization, setPendingAuthorization] = useState(null)

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => useFetch('/system-settings'),
  })

  const settings = data?.data || null

  useEffect(() => {
    if (settings && !isEditing) setForm(mapSettingsToForm(settings))
  }, [settings, isEditing])

  const saveMutation = useMutation({
    mutationFn: (payload) => useFetchPut('/system-settings', payload, {
      doubleCheck: { type: 'settings', scope: 'system', data: { ...payload, code: undefined, verificationCode: undefined, verificationId: undefined }, before: mapSettingsToForm(settings || {}), summary: 'System Settings' },
    }),
    onMutate: () => setAlert({ type: 'loading', message: 'Preparing settings review...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'System settings saved.' })
      setIsEditing(false)
      setPendingAuthorization(null)
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (mutationError) => setAlert(getDoubleCheckNotice(mutationError, 'Failed to save settings.')),
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isEditing || !canManage) return
    setPendingAuthorization({ ...form })
  }

  const handleCancel = () => {
    setForm(mapSettingsToForm(settings || defaultForm))
    setIsEditing(false)
    setAlert(null)
    setPendingAuthorization(null)
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="System Settings"
          description="Global company profile, reservation and commission fallback values, and system status."
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

          {!isEditing ? (
            <button
              type="button"
              onClick={() => canManage && setIsEditing(true)}
              disabled={!canManage || isLoading || isError || !settings}
              title={!canManage ? 'Only the Super Admin can change System Settings. Saving requires the Super Admin password and email verification code.' : 'Edit protected System Settings'}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
            >
              <FiEdit2 className="h-4 w-4" />
              Edit Settings
            </button>
          ) : null}
        </div>
      </div>

      {!canManage ? <ReadOnlyNotice message="System Settings are owner-controlled. The Edit Settings button remains visible for reference but only the Super Admin can use it with password and email verification." /> : null}

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

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <FiShield className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">Role &amp; Access Control</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                Manage default permissions for Admin, Marketing, Sales, Accounting, and Operations. Super Admin always keeps Full System Access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => canManage && setShowRoleAccess((current) => !current)}
            disabled={!canManage}
            title={!canManage ? 'Only the Super Admin can manage Role & Access Control.' : undefined}
            className="h-11 shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {showRoleAccess ? 'Hide Role & Access' : canManage ? 'Manage Role & Access' : 'Super Admin Only'}
          </button>
        </div>
        {!showRoleAccess ? (
          <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-slate-900">5 configurable role templates</p><p className="mt-1 font-semibold text-slate-500">Defaults are copied into new system-user accounts.</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-slate-900">Per-account access stays independent</p><p className="mt-1 font-semibold text-slate-500">Changing a role template does not silently change existing users.</p></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="font-black text-emerald-900">Super Admin · Full System Access</p><p className="mt-1 font-semibold text-emerald-700">Permissions cannot be restricted.</p></div>
          </div>
        ) : null}
      </section>

      {canManage && showRoleAccess ? <RoleAccessControl /> : null}

      <SystemSettingsForm
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isSaving={saveMutation.isPending}
        disabled={!isEditing || !canManage}
        onCancel={handleCancel}
      />

      {pendingAuthorization ? (
        <SettingsAuthorizationModal
          title="Authorize System Settings Change"
          description="System Settings are owner-controlled. Verify the current Super Admin password, reason, and email code before the final review."
          codeEndpoint="/system-settings/code"
          settingsPayload={pendingAuthorization}
          isSaving={saveMutation.isPending}
          onClose={() => !saveMutation.isPending && setPendingAuthorization(null)}
          onConfirm={(authorizedPayload) => saveMutation.mutate(authorizedPayload)}
        />
      ) : null}
    </main>
  )
}

export default Settings

