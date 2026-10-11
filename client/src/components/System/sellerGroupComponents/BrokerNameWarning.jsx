import { FiAlertTriangle } from 'react-icons/fi'

const typeLabel = (type) => (type === 'external' ? 'External Network' : 'In-House Network')

export const BrokerNameWarning = ({ brokerName, matches = [], confirmed, onConfirmChange, disabled = false }) => {
  if (!matches.length) return null
  return (
    <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 md:col-span-2">
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-black">{brokerName.trim() || 'This broker'} is already the broker of {matches.length === 1 ? 'another Network' : `${matches.length} other Networks`}</p>
          <ul className="mt-2 grid gap-1.5">
            {matches.map((match) => (
              <li key={match.seller_group_id} className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                <span className="font-black">{match.seller_group_name}</span>
                {match.realty_name ? `, ${match.realty_name}` : ''}
                <span className="text-amber-700"> ({typeLabel(match.seller_group_type)}, {match.seller_group_status === 'active' ? 'active' : 'inactive'})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold text-amber-900">If this is the same person, edit the existing Network instead of creating a second one.</p>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-black text-amber-950">
            <input type="checkbox" checked={Boolean(confirmed)} onChange={(event) => onConfirmChange(event.target.checked)} disabled={disabled} className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-600" />
            I checked this. It is a different broker with the same name.
          </label>
        </div>
      </div>
    </div>
  )
}

