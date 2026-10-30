import { useState } from 'react'
import { getSavedReviewRevisions } from '../../utils/reviewRevisionHistory'
import { humanizeKey } from '../../utils/reviewSnapshotFormat'

export default function ReviewVersionedSpecial({ beforeValue, afterValue, events = [], revision = 1, actionKey, children }) {
  const [selected, setSelected] = useState('latest')
  const versions = getSavedReviewRevisions({ before: beforeValue, after: afterValue, events, latestRevision: revision, actionKey })
  const chosen = selected === 'latest' ? versions[0] : versions.find(item => item.revision === Number(selected)) || versions[0]
  if (!chosen) return <p className="rounded-xl border border-amber-200 p-4 text-sm text-amber-800">No saved snapshot evidence for this review.</p>
  return <div className="space-y-3" aria-label="Saved special review history">
    {versions.length > 1 ? <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Saved Version
      <select value={selected} onChange={event => setSelected(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
        <option value="latest">Latest Saved Version (Version {versions[0].revision})</option>
        {versions.slice(1).map(item => <option value={item.revision} key={item.revision}>Version {item.revision}</option>)}
      </select>
    </label> : null}
    <p className="text-xs font-semibold text-slate-600">Version {chosen.revision} · Action Performed: {chosen.actionKey ? humanizeKey(chosen.actionKey.replaceAll('.', '_')) : 'Not recorded for this version'}</p>
    {chosen.beforeEvidence === 'prior-saved' ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">The Before snapshot is the preceding saved version, not a verified immediate pre-action record.</p> : null}
    {chosen.beforeEvidence === 'missing' ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">The Before values for this version were not recorded.</p> : null}
    {children({ before: chosen.before, after: chosen.after })}
  </div>
}

