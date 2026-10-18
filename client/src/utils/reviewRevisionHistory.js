// Only use snapshots that were actually saved. Never reconstruct an older
// revision from the present-day business record.
const parse = (raw) => {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}
export const getSavedReviewRevisions = ({ before, after, events = [], latestRevision = 1 } = {}) => {
  const byRevision = new Map()
  const latest = Number(latestRevision) || 1
  byRevision.set(latest, { revision: latest, before, after })
  for (const event of events) {
    const meta = parse(event.metadata_json)
    if (!meta || typeof meta !== 'object') continue
    const prior = Number(meta.previousRevision || (Number(meta.reviewRevision || 0) - 1))
    const priorBefore = meta.previousBeforeSnapshot
    const priorAfter = meta.previousAfterSnapshot
    if (prior > 0 && prior < latest && (priorBefore != null || priorAfter != null)) {
      if (!byRevision.has(prior)) byRevision.set(prior, {revision:prior,before: priorBefore ?? {},after:priorAfter})
    }
    // Previous routine-review after-values can be retained with the original
    // before snapshot only when the Review still uses that same base.
    if (prior > 0 && prior < latest && meta.previousAfterSnapshot != null && !byRevision.has(prior)) {
      byRevision.set(prior,{revision:prior,before:{},after:meta.previousAfterSnapshot})
    }
  }
  return [...byRevision.values()].sort((a,b)=>b.revision-a.revision)
}
