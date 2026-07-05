import { useMemo, useState } from 'react'
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDollarSign,
  FiLoader,
  FiPauseCircle,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const releaseDate = 'July 7, 2026'

const createMilestones = (grossCommission = 0) => [
  {
    id: 1,
    stage: '1st Release',
    trigger: '20%',
    releasePercent: '20%',
    gross: grossCommission * 0.2,
    deduction: 0,
    status: 'Eligible',
  },
  {
    id: 2,
    stage: '2nd Release',
    trigger: '40%',
    releasePercent: '20%',
    gross: grossCommission * 0.2,
    deduction: 0,
    status: 'Eligible',
  },
  {
    id: 3,
    stage: '3rd Release',
    trigger: '60%',
    releasePercent: '20%',
    gross: grossCommission * 0.2,
    deduction: 0,
    status: 'Pending',
  },
  {
    id: 4,
    stage: '4th Release',
    trigger: '75%',
    releasePercent: '15%',
    gross: grossCommission * 0.15,
    deduction: 0,
    status: 'Pending',
  },
  {
    id: 5,
    stage: 'Retention',
    trigger: '-',
    releasePercent: '25%',
    gross: grossCommission * 0.25,
    deduction: 0,
    status: 'On Hold',
  },
]

const InfoCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
  </div>
)

const StatusPill = ({ status }) => {
  const styles = {
    Eligible: 'border-blue-200 bg-blue-50 text-blue-700',
    Pending: 'border-amber-200 bg-amber-50 text-amber-700',
    Released: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'On Hold': 'border-slate-200 bg-slate-100 text-slate-600',
  }

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${
        styles[status] || styles.Pending
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

const ActionButton = ({
  children,
  onClick,
  disabled,
  loading,
  variant = 'default',
  icon,
}) => {
  const variants = {
    default:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    primary:
      'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
        variants[variant] || variants.default
      }`}
    >
      {loading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

const ReleaseDetailsModal = ({ commission, onClose, onUpdate }) => {
  const grossCommission = Number(commission.grossCommission || commission.gross || 0)

  const [milestones, setMilestones] = useState(() =>
    createMilestones(grossCommission)
  )

  const [alert, setAlert] = useState({
    type: 'info',
    message:
      'Review the release milestones. Only eligible milestones can be released.',
  })

  const [loadingAction, setLoadingAction] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const releasedTotal = useMemo(
    () =>
      milestones
        .filter((milestone) => milestone.status === 'Released')
        .reduce((sum, milestone) => {
          return sum + Number(milestone.gross || 0) - Number(milestone.deduction || 0)
        }, 0),
    [milestones]
  )

  const netRemaining = Math.max(grossCommission - releasedTotal, 0)

  const previewCommission = {
    ...commission,
    released: releasedTotal,
    netRemaining,
    status:
      releasedTotal <= 0
        ? commission.status
        : netRemaining <= 0
          ? 'Released'
          : 'Partially Released',
  }

  const updateParent = (nextMilestones, message, type = 'success') => {
    const nextReleased = nextMilestones
      .filter((milestone) => milestone.status === 'Released')
      .reduce((sum, milestone) => {
        return sum + Number(milestone.gross || 0) - Number(milestone.deduction || 0)
      }, 0)

    const nextRemaining = Math.max(grossCommission - nextReleased, 0)

    const updatedCommission = {
      ...commission,
      released: nextReleased,
      netRemaining: nextRemaining,
      status:
        nextReleased <= 0
          ? commission.status
          : nextRemaining <= 0
            ? 'Released'
            : 'Partially Released',
    }

    if (onUpdate) {
      onUpdate(updatedCommission, message, type)
    }
  }

  const openConfirm = (milestone, action) => {
    const actionLabel = {
      release: 'release',
      hold: 'hold',
      unhold: 'unhold',
    }

    setConfirmAction({
      milestone,
      action,
      title: `${actionLabel[action]} ${milestone.stage}`,
    })

    setAlert({
      type: 'info',
      message: `Please confirm before you ${actionLabel[action]} ${milestone.stage}.`,
    })
  }

  const handleAction = () => {
    if (!confirmAction) return

    const { milestone, action } = confirmAction
    const key = `${milestone.id}-${action}`

    setConfirmAction(null)
    setLoadingAction(key)

    const loadingMessage = {
      release: `Saving release for ${milestone.stage}...`,
      hold: `Saving hold status for ${milestone.stage}...`,
      unhold: `Removing hold status for ${milestone.stage}...`,
    }

    setAlert({
      type: 'loading',
      message: loadingMessage[action],
    })

    window.setTimeout(() => {
      let nextStatus = milestone.status

      if (action === 'release') nextStatus = 'Released'
      if (action === 'hold') nextStatus = 'On Hold'
      if (action === 'unhold') nextStatus = 'Pending'

      const nextMilestones = milestones.map((item) =>
        item.id === milestone.id ? { ...item, status: nextStatus } : item
      )

      setMilestones(nextMilestones)
      setLoadingAction(null)

      const successMessage = {
        release: `${milestone.stage} released successfully.`,
        hold: `${milestone.stage} has been placed on hold.`,
        unhold: `${milestone.stage} is now pending again.`,
      }

      setAlert({
        type: 'success',
        message: successMessage[action],
      })

      updateParent(nextMilestones, successMessage[action], 'success')
    }, 700)
  }

  const isLoading = (milestone, action) =>
    loadingAction === `${milestone.id}-${action}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="my-2 flex w-full max-w-[900px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <h2 className="text-base font-black text-slate-950">
            Commission Details
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close commission details"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          {alert ? (
            <div className="mb-3">
              <StatusAlert
                type={alert.type}
                message={alert.message}
                onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              />
            </div>
          ) : null}

          {confirmAction ? (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                  <div>
                    <p className="text-sm font-black text-blue-900">
                      Confirm Action
                    </p>
                    <p className="mt-1 text-xs font-semibold text-blue-800">
                      Are you sure you want to {confirmAction.action}{' '}
                      <span className="font-black">
                        {confirmAction.milestone.stage}
                      </span>
                      ?
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction(null)
                      setAlert({
                        type: 'info',
                        message: 'Action cancelled.',
                      })
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    No
                  </button>

                  <button
                    type="button"
                    onClick={handleAction}
                    className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
                  >
                    Yes, Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section>
            <h3 className="text-sm font-black text-slate-950">
              Commission Information
            </h3>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Seller" value={commission.seller} />
              <InfoCard label="Role" value={commission.role} />
              <InfoCard label="Seller Type" value={commission.sellerType} />
              <InfoCard label="Sale Type" value={commission.saleType} />
              <InfoCard label="Commission Base" value={money(commission.commissionBase)} />
              <InfoCard label="Rate" value={`${commission.rate}%`} />
              <InfoCard label="Gross Commission" value={money(grossCommission)} />
              <InfoCard label="Released" value={money(previewCommission.released)} />
              <InfoCard label="Net Remaining" value={money(previewCommission.netRemaining)} />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-950">
              Property / Payment
            </h3>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Client" value={commission.client} />
              <InfoCard label="Unit" value={commission.unit} />
              <InfoCard label="Project" value={commission.project} />
              <InfoCard label="TCP" value={money(commission.tcp)} />
              <InfoCard label="Paid" value={money(commission.paid)} />
              <InfoCard
                label="Payment %"
                value={`${Number(commission.paymentPercent || 0).toFixed(2)}%`}
              />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-950">
              Main Release Milestones
            </h3>

            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">
                Eligible commissions can only be released every 7th and 22nd day
                of the month. Next release date:{' '}
                <span className="font-black">{releaseDate}</span>.
              </p>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        'Stage',
                        'Trigger',
                        'Release %',
                        'Gross',
                        'Deduction',
                        'Net',
                        'Status',
                        'Actions',
                      ].map((head) => (
                        <th
                          key={head}
                          className="px-3 py-3 text-left text-xs font-black text-slate-700"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {milestones.map((milestone) => {
                      const net =
                        Number(milestone.gross || 0) -
                        Number(milestone.deduction || 0)

                      const canRelease = milestone.status === 'Eligible'
                      const canHold =
                        milestone.status === 'Eligible' ||
                        milestone.status === 'Pending'
                      const canUnhold = milestone.status === 'On Hold'

                      return (
                        <tr key={milestone.id} className="align-middle">
                          <td className="px-3 py-4 font-black text-slate-950">
                            {milestone.stage}
                          </td>

                          <td className="px-3 py-4 font-semibold text-slate-600">
                            {milestone.trigger}
                          </td>

                          <td className="px-3 py-4 font-semibold text-slate-600">
                            {milestone.releasePercent}
                          </td>

                          <td className="px-3 py-4 font-semibold text-slate-600">
                            {money(milestone.gross)}
                          </td>

                          <td className="px-3 py-4 font-semibold text-slate-600">
                            {money(milestone.deduction)}
                          </td>

                          <td className="px-3 py-4 font-black text-slate-950">
                            {money(net)}
                          </td>

                          <td className="px-3 py-4">
                            <StatusPill status={milestone.status} />
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex flex-wrap gap-2">
                              {canRelease ? (
                                <ActionButton
                                  variant="primary"
                                  loading={isLoading(milestone, 'release')}
                                  disabled={Boolean(loadingAction)}
                                  icon={<FiDollarSign className="h-3.5 w-3.5" />}
                                  onClick={() => openConfirm(milestone, 'release')}
                                >
                                  Release on {releaseDate}
                                </ActionButton>
                              ) : null}

                              {canHold ? (
                                <ActionButton
                                  loading={isLoading(milestone, 'hold')}
                                  disabled={Boolean(loadingAction)}
                                  icon={<FiPauseCircle className="h-3.5 w-3.5" />}
                                  onClick={() => openConfirm(milestone, 'hold')}
                                >
                                  Hold
                                </ActionButton>
                              ) : null}

                              {canUnhold ? (
                                <ActionButton
                                  loading={isLoading(milestone, 'unhold')}
                                  disabled={Boolean(loadingAction)}
                                  icon={<FiCheckCircle className="h-3.5 w-3.5" />}
                                  onClick={() => openConfirm(milestone, 'unhold')}
                                >
                                  Unhold
                                </ActionButton>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ReleaseDetailsModal