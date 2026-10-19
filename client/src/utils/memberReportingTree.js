const numberId = value => Number(value || 0)

// Reconstruct the reporting tree from the saved reporting parent, not a historical
// replacement, sales origin or the Manager-Member junction table.
export const getMemberReportingView = (members, selectedUserId) => {
  const rows = (Array.isArray(members) ? members : []).filter(row => !numberId(row.is_system_dummy))
  const byId = new Map(rows.map(row => [numberId(row.user_id), row]))
  const selected = byId.get(numberId(selectedUserId)) || null
  if (!selected) return { selected: null, parent: null, chain: [], direct: [], descendants: [], incomplete: false }
  const children = new Map()
  for (const row of rows) {
    const parentId = numberId(row.reports_under_user_id ?? row.accredited_seller_reports_under_user_id)
    if (parentId) children.set(parentId, [...(children.get(parentId) || []), row])
  }
  const direct = children.get(numberId(selected.user_id)) || []
  const descendants = []
  const visited = new Set([numberId(selected.user_id)])
  let incomplete = false
  const stack = direct.map(row => ({ row, level: 1 })).reverse()
  while (stack.length) {
    const { row, level } = stack.pop()
    const id = numberId(row.user_id)
    if (visited.has(id)) { incomplete = true; continue }
    visited.add(id)
    descendants.push({ ...row, reportingDepth: level, isDirect: level === 1 })
    const nested = children.get(id) || []
    for (let index = nested.length - 1; index >= 0; index--) stack.push({ row: nested[index], level: level + 1 })
  }
  const chain = []
  const parentsSeen = new Set([numberId(selected.user_id)])
  let current = selected
  while (numberId(current.reports_under_user_id ?? current.accredited_seller_reports_under_user_id)) {
    const parentId = numberId(current.reports_under_user_id ?? current.accredited_seller_reports_under_user_id)
    if (parentsSeen.has(parentId)) { incomplete = true; break }
    parentsSeen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) { incomplete = true; break }
    chain.unshift(parent)
    current = parent
  }
  const parentId = numberId(selected.reports_under_user_id ?? selected.accredited_seller_reports_under_user_id)
  return { selected, parent: parentId ? byId.get(parentId) || null : null, chain, direct, descendants, incomplete }
}

