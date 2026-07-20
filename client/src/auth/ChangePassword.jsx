import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiLock, FiShield } from 'react-icons/fi'
import StatusAlert from '../components/Shared/StatusAlert'
import useCurrentUser from '../utils/useCurrentUser'
import { useFetchPatch } from '../utils/useFetch'

const getDefaultRoute = (role) => `/${role || 'super_admin'}`

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState(null)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: currentUser, isLoading, isError } = useCurrentUser()
  const user = currentUser?.user

  const changePasswordMutation = useMutation({
    mutationFn: () => useFetchPatch('/user/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
    onMutate: () => {
      setNotice({ type: 'loading', message: 'Changing password...' })
    },
    onSuccess: (result) => {
      const updatedUser = result?.user || (user ? { ...user, must_change_password: false } : null)

      if (updatedUser) {
        queryClient.setQueryData(['currentUser'], {
          ...(currentUser || {}),
          user: updatedUser,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      setNotice({ type: 'success', message: result?.message || 'Password changed successfully.' })
      navigate(getDefaultRoute(updatedUser?.role || user?.role), { replace: true })
    },
    onError: (mutationError) => {
      setNotice({ type: 'error', message: mutationError?.message || 'Failed to change password.' })
    },
  })

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      setNotice({ type: 'warning', message: 'Fill in your current password, new password, and confirmation.' })
      return
    }

    if (newPassword.length < 8) {
      setNotice({ type: 'warning', message: 'New password must be at least 8 characters.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setNotice({ type: 'warning', message: 'New password and confirmation do not match.' })
      return
    }

    if (newPassword === currentPassword) {
      setNotice({ type: 'warning', message: 'New password must be different from the current password.' })
      return
    }

    if (newPassword.toLowerCase() === 'password') {
      setNotice({ type: 'warning', message: 'Do not use the temporary default password.' })
      return
    }

    changePasswordMutation.mutate()
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <StatusAlert type="loading" message="Checking your session..." />
      </main>
    )
  }

  if (isError || !user) {
    return <Navigate to="/" replace />
  }

  if (!user.must_change_password) {
    return <Navigate to={getDefaultRoute(user.role)} replace />
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <div className="border-b border-slate-200 bg-slate-950 p-6 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
              <FiShield className="h-6 w-6" />
            </div>

            <h1 className="mt-5 text-2xl font-black">Change Password</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
              Your password was reset. Create a new password before opening the system.
            </p>
          </div>

          <div className="space-y-5 p-6">
            {notice ? (
              <StatusAlert
                type={notice.type}
                message={notice.message}
                onClose={notice.type === 'loading' ? undefined : () => setNotice(null)}
              />
            ) : null}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Signed in as</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.email}
              </p>
              <p className="text-xs font-semibold text-slate-600">{user.email}</p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Current / Temporary Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Enter the reset password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="At least 8 characters"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Repeat the new password"
              />
            </label>

            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiLock className="h-4 w-4" />
              {changePasswordMutation.isPending ? 'Saving...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default ChangePassword


