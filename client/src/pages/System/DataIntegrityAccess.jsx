import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiKey, FiLock, FiShield } from 'react-icons/fi'
import DataIntegrity from './DataIntegrity'
import StatusAlert from '../../components/Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import { isFullAccessAdministrator } from '../../config/permissions'

const DataIntegrityAccess = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: currentUserData, isLoading: isUserLoading, isError: isUserError } = useCurrentUser()
  const [pin, setPin] = useState('')
  const [notice, setNotice] = useState(null)
  const user = currentUserData?.user
  const canAttemptAccess = isFullAccessAdministrator(user)
  const portalHome = `/portal/${user?.role || 'super_admin'}`

  const accessQuery = useQuery({
    queryKey: ['data-integrity-access-session'],
    queryFn: () => useFetch('/data-integrity/access-session', { redirectOnUnavailable: true }),
    enabled: Boolean(user && canAttemptAccess),
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
  })

  const unlockMutation = useMutation({
    mutationFn: () => useFetchPost('/data-integrity/unlock', { pin }, { confirmationHandled: 'technical' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Checking Data Integrity PIN...' }),
    onSuccess: async () => {
      setPin('')
      setNotice(null)
      await queryClient.invalidateQueries({ queryKey: ['data-integrity-access-session'] })
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Unable to unlock Data Integrity.' }),
  })

  const lockMutation = useMutation({
    mutationFn: () => useFetchPost('/data-integrity/lock', {}, { confirmationHandled: 'technical' }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['data-integrity-report'] })
      queryClient.removeQueries({ queryKey: ['data-integrity-account'] })
      await queryClient.invalidateQueries({ queryKey: ['data-integrity-access-session'] })
    },
  })

  if (isUserLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><StatusAlert type="loading" message="Checking system access..." /></main>
  }

  if (isUserError || !user) return <Navigate to="/portal" replace />
  if (!canAttemptAccess) return <Navigate to={portalHome} replace />

  if (accessQuery.isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><StatusAlert type="loading" message="Checking Data Integrity access..." /></main>
  }

  if (accessQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <StatusAlert type="error" message={accessQuery.error?.message || 'Unable to check Data Integrity access.'} />
          <button type="button" onClick={() => navigate(portalHome)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><FiArrowLeft className="h-4 w-4" />Back to Portal</button>
        </div>
      </main>
    )
  }

  const access = accessQuery.data?.data || {}

  if (!access.configured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiShield className="h-5 w-5" /></span>
            <div><h1 className="text-xl font-black text-slate-950">Data Integrity</h1><p className="text-sm font-semibold text-slate-500">PIN-protected read-only system checks</p></div>
          </div>
          <div className="mt-5"><StatusAlert type="error" message="Data Integrity PIN is not configured on the server. Set DATA_INTEGRITY_PINCODE first." /></div>
          <button type="button" onClick={() => navigate(portalHome)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><FiArrowLeft className="h-4 w-4" />Back to Portal</button>
        </div>
      </main>
    )
  }

  if (!access.unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <form
          onSubmit={(event) => { event.preventDefault(); if (pin && !unlockMutation.isPending) unlockMutation.mutate() }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-blue-100 bg-blue-50 p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><FiLock className="h-5 w-5" /></span>
            <h1 className="mt-4 text-2xl font-black text-slate-950">Open Data Integrity</h1>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Enter the private PIN to open the read-only Data Integrity checks.</p>
          </div>
          <div className="p-6">
            {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}
            <label className="mt-4 grid gap-2">
              <span className="text-sm font-black text-slate-700">Data Integrity PIN</span>
              <div className="relative">
                <FiKey className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  autoComplete="off"
                  placeholder="Enter PIN"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-center text-lg font-black tracking-[0.3em] text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </label>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => navigate(portalHome)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">Back</button>
              <button type="submit" disabled={!pin || unlockMutation.isPending} className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{unlockMutation.isPending ? 'Checking...' : 'Open'}</button>
            </div>
          </div>
        </form>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(portalHome)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50"><FiArrowLeft className="h-4 w-4" />Portal</button>
            <div className="hidden sm:block"><p className="text-sm font-black text-slate-950">PIN Protected</p><p className="text-xs font-semibold text-slate-500">Data Integrity is read-only.</p></div>
          </div>
          <button type="button" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"><FiLock className="h-4 w-4" />{lockMutation.isPending ? 'Locking...' : 'Lock'}</button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8"><DataIntegrity /></div>
    </div>
  )
}

export default DataIntegrityAccess
