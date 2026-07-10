import { useEffect, useState } from 'react'
import { FiAlertTriangle, FiEye, FiEyeOff, FiKey, FiMail, FiTrash2, FiX } from 'react-icons/fi'

const inputClass = 'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

const DeleteAuditLogsModal = ({
  onClose,
  onRequestCode,
  onConfirmCode,
  requestData,
  errorMessage,
  isRequesting,
  isDeleting,
}) => {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const codeRequested = Boolean(requestData?.verificationId)
  const busy = isRequesting || isDeleting

  useEffect(() => {
    if (codeRequested) setCode('')
  }, [codeRequested])

  const submitPassword = (event) => {
    event.preventDefault()
    if (!password || busy) return
    onRequestCode(password)
  }

  const submitCode = (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code) || busy) return
    onConfirmCode(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm">
              <FiAlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black text-red-950">Delete Audit Logs</h2>
              <p className="mt-1 text-sm font-semibold text-red-700">
                This action deletes every existing audit record and cannot be undone.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl p-2 text-red-500 transition hover:bg-red-100 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close modal"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {!codeRequested ? (
          <form onSubmit={submitPassword} className="p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Only a super admin can continue. Enter your current password. The system will then email a 6-digit code to your account email.
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-slate-700">Super-admin password</span>
              <div className="relative">
                <FiKey className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                  disabled={busy}
                  className={`${inputClass} pl-11 pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={busy}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {errorMessage ? (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!password || busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiMail className="h-4 w-4" />
                {isRequesting ? 'Sending Code...' : 'Verify Password & Send Code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitCode} className="p-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              A verification code was sent to <span className="font-black">{requestData.maskedEmail}</span>. It expires in {requestData.expiresInMinutes || 10} minutes.
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-slate-700">6-digit verification code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                placeholder="000000"
                disabled={busy}
                className={`${inputClass} text-center text-xl font-black tracking-[0.45em]`}
                required
              />
            </label>

            <p className="mt-3 text-xs font-semibold text-slate-500">
              After verification, all previous records will be removed. The system keeps one new security record showing who performed the deletion.
            </p>

            {errorMessage ? (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!/^\d{6}$/.test(code) || busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 className="h-4 w-4" />
                {isDeleting ? 'Deleting Logs...' : 'Delete All Audit Logs'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default DeleteAuditLogsModal
