// Review version history contains only immutable saved snapshots and the
// operation's own recorded event metadata. Never read current business rows.
const parse = value => {
  if (value == null || value === '') return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const snapshot = value => value == null ? null : parse(value)

// All review types use the same version semantics, regardless of department.
export const getSavedReviewRevisions = ({ before, after, events = [], latestRevision = 1, actionKey = null } = {}) => {
  const latest = Math.max(1, Number(latestRevision) || 1)
  const versions = new Map()
  const get = revision => {
    if (!versions.has(revision)) versions.set(revision, {
      revision, before: null, after: null, actionKey: null,
      beforeEvidence: 'missing', eventType: null, recordedAt: null, actor: null,
    })
    return versions.get(revision)
  }
  const original = get(1)
  original.before = snapshot(before)
  original.beforeEvidence = original.before == null ? 'missing' : 'exact'
  const current = get(latest)
  current.after = snapshot(after)
  current.actionKey = actionKey
  if (latest === 1) {
    current.before = original.before
    current.beforeEvidence = original.beforeEvidence
  }

  for (const event of events) {
    const metadata = parse(event?.metadata_json)
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue
    const revision = Number(metadata.reviewRevision || (metadata.previousRevision ? Number(metadata.previousRevision) + 1 : 0))
    const prior = Number(metadata.previousRevision || revision - 1)
    if (!Number.isInteger(prior) || prior < 1 || prior >= latest ||
      !Number.isInteger(revision) || revision <= prior || revision > latest) continue
    const previous = get(prior)
    const newer = get(revision)
    // Earlier reviews may only have retained the prior AFTER snapshot.
    if (has(metadata, 'previousAfterSnapshot') && metadata.previousAfterSnapshot != null)
      previous.after = snapshot(metadata.previousAfterSnapshot)
    if (has(metadata, 'previousBeforeSnapshot') && metadata.previousBeforeSnapshot != null &&
        (prior === 1 || (!metadata.originalBaselinePreserved && previous.before == null))) {
      previous.before = snapshot(metadata.previousBeforeSnapshot)
      previous.beforeEvidence = 'exact'
    }
    if (metadata.previousActionKey) previous.actionKey = metadata.previousActionKey
    if (metadata.latestActionKey) newer.actionKey = metadata.latestActionKey
    if (has(metadata, 'nextBeforeSnapshot') || has(metadata, 'correctedBeforeSnapshot') || has(metadata, 'headBeforeSnapshot')) {
      const value = has(metadata, 'nextBeforeSnapshot') ? metadata.nextBeforeSnapshot :
        has(metadata, 'correctedBeforeSnapshot') ? metadata.correctedBeforeSnapshot : metadata.headBeforeSnapshot
      newer.before = snapshot(value)
      newer.beforeEvidence = newer.before == null ? 'missing' : 'exact'
    } else if (metadata.previousAfterSnapshot != null && newer.beforeEvidence !== 'exact') {
      // Explicitly labelled as preceding SAVED state, not asserted to be the
      // immediate before-image of a legacy operation.
      newer.before = snapshot(metadata.previousAfterSnapshot)
      newer.beforeEvidence = 'prior-saved'
    }
    if (has(metadata, 'nextAfterSnapshot') || has(metadata, 'correctedAfterSnapshot')) {
      if (revision !== latest) newer.after = snapshot(has(metadata, 'nextAfterSnapshot') ? metadata.nextAfterSnapshot : metadata.correctedAfterSnapshot)
    }
    newer.followUpOnly = metadata.correctionMode === 'manual_follow_up'
    newer.eventType = event.event_type || newer.eventType
    newer.recordedAt = event.created_at || newer.recordedAt
    newer.actor = event.actor_name || (event.actor_user_id ? `User #${event.actor_user_id}` : null)
  }
  // The canonical latest after-image is always the review's saved after value.
  current.after = snapshot(after)
  current.actionKey ||= actionKey
  return [...versions.values()].filter(item => item.after != null || item.before != null)
    .sort((a, b) => b.revision - a.revision)
}

