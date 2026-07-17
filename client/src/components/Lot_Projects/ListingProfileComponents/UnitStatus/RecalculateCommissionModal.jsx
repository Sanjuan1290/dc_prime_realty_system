import { useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLock,
  FiRefreshCw,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const roleLabel = (value) =>
  String(value || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

/**
 * Confirms rebuilding the unit commission from the assigned seller's current
 * hierarchy. The API remains the source of truth for release-lock validation.
 */
const RecalculateCommissionModal = ({
  listing,
  commissionState = {},
  isSaving = false,
  onClose,
  onConfirm,
}) => {
  const [confirmed, setConfirmed] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState(null)

  const currentHierarchy = useMemo(
    () => (Array.isArray(commissionState.currentHierarchy) ? commissionState.currentHierarchy : []),
    [commissionState.currentHierarchy]
  )

  const isAllowed = Boolean(commissionState.allowed)
  const unitId = listing?.unit_id || listing?.unitCode || '-'

  const submit = async (event) => {
    event.preventDefault()

    if (!isAllowed) {
      setNotice({
        type: 'warning',
        message: commissionState.reason || 'This commission cannot be recalculated.',
      })
      return
    }

    if (!password) {
      setNotice({
        type: 'warning',
        message: 'Enter your current Super Admin password to authorize recalculation.',
      })
      return
    }

    if (!confirmed) {
      setNotice({
        type: 'warning',
        message: 'Confirm that you understand the unreleased commission rows will be replaced.',
      })
      return
    }

    setNotice({
      type: 'loading',
      message: `Recalculating the commission hierarchy for ${unitId}...`,
    })

    try {
      await onConfirm?.({ password })
      onClose?.()
    } catch (error) {
      setNotice({
        type: 'error',
        message: error?.message || 'Failed to recalculate the unit commission.',
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form
        onSubmit={submit}
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiRefreshCw className={`h-5 w-5 ${isSaving ? 'animate-spin' : ''}`} />
            </span>

            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950">Recalculate Unit Commission</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Rebuild {unitId} using the assigned seller&apos;s current reporting hierarchy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close commission recalculation"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {notice ? (
            <StatusAlert
              type={notice.type}
              message={notice.message}
              onClose={notice.type === 'loading' ? undefined : () => setNotice(null)}
            />
          ) : null}

          <StatusAlert
            type={isAllowed ? 'success' : 'warning'}
            title={isAllowed ? 'Recalculation available' : 'Recalculation locked'}
            message={commissionState.reason || 'Commission release status could not be verified.'}
          />

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Unit</p>
              <p className="mt-1 text-sm font-black text-slate-950">{unitId}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Assigned Seller</p>
              <p className="mt-1 text-sm font-black text-slate-950">{listing?.seller || '-'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Current Rows</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {Number(commissionState.commissionCount || currentHierarchy.length || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Released Amount</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {money(commissionState.releasedAmount)}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <FiUsers className="h-4 w-4 text-blue-700" />
              <div>
                <h3 className="text-sm font-black text-slate-950">Current Saved Hierarchy</h3>
                <p className="text-xs font-semibold text-slate-500">
                  These unreleased rows will be replaced by the current seller hierarchy.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-white">
                  <tr>
                    {['Seller', 'Role', 'Reports Under', 'Rate', 'Commission'].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {currentHierarchy.length ? (
                    currentHierarchy.map((row) => (
                      <tr key={row.commissionId || `${row.accreditedSellerId}-${row.role}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-950">{row.sellerName || '-'}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.sellerGroup || 'No group'}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.roleLabel || roleLabel(row.role)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{row.reportsUnder || '-'}</td>
                        <td className="px-4 py-3 font-black text-blue-700">{Number(row.rate || 0).toFixed(2)}%</td>
                        <td className="px-4 py-3 font-black text-slate-950">{money(row.grossCommission)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                        No saved commission hierarchy exists for this unit yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-black">Before continuing</p>
                <p className="mt-1 font-semibold">
                  The assigned seller will not change. Only the commission hierarchy, rates, amounts, and unreleased milestones will be rebuilt from the seller&apos;s current reports-under structure.
                </p>
              </div>
            </div>
          </div>

          {isAllowed ? (
            <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                  <FiLock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <label htmlFor="commission-recalculation-password" className="block text-sm font-black text-slate-900">
                    Super Admin Password <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Enter your current password to authorize this sensitive action.
                  </p>

                  <div className="relative mt-3">
                    <input
                      id="commission-recalculation-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setNotice(null)
                      }}
                      disabled={isSaving}
                      autoComplete="current-password"
                      placeholder="Enter your current password"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-12 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={isSaving}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                    </button>
                  </div>

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    The password is verified by the server and removed before the recalculation controller runs.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {isAllowed ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked)
                  setNotice(null)
                }}
                disabled={isSaving}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  I understand this replaces the unreleased commission hierarchy.
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  Released commissions and release receipts are never modified by this action.
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>

          <button
            type="submit"
            disabled={!isAllowed || !password || !confirmed || isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? (
              <>
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                Recalculating...
              </>
            ) : (
              <>
                <FiCheckCircle className="h-4 w-4" />
                Recalculate Commission
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default RecalculateCommissionModal
