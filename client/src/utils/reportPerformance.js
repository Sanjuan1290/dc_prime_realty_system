// Stable entity IDs prevent the same seller or Network from being counted as separate
// people/organizations across projects. Project rows remain available for drill-down.
const metricFields = ['units','salesAmount','cashCollected','grossCommission','eligibleCommission','releasedCommission','remainingCommission','companyProfit']
export const mergePerformance = (projects = [], field = 'groupPerformance') => {
  const entities = new Map()
  projects.forEach((project) => {
    const projectId = String(project.id || project.projectId || project.name || '')
    for (const row of project[field] || []) {
      const id = Number(row.id || 0)
      if (!id) continue
      const key = String(id)
      if (!entities.has(key)) {
        entities.set(key, { ...row, ...Object.fromEntries(metricFields.map((metric) => [metric, 0])), projects: [], projectCount: 0 })
      }
      const existing = entities.get(key)
      const projectRow = { id: projectId, name: project.name || '-', ...Object.fromEntries(metricFields.map((metric) => [metric, Number(row[metric] || 0)])) }
      existing.projects.push(projectRow)
      for (const metric of metricFields) existing[metric] = Math.round((existing[metric] + projectRow[metric] + Number.EPSILON) * 100) / 100
      existing.projectCount = existing.projects.length
    }
  })
  return [...entities.values()]
}

export const rankPerformance = (rows = [], { metric = 'salesAmount', search = '', networkType = 'all', role = 'all' } = {}) => {
  const needle = search.trim().toLowerCase()
  return rows.filter((r) => (networkType === 'all' || r.groupType === networkType)
    && (role === 'all' || r.role === role)
    && (!needle || [r.seller,r.group,r.role,r.payee,r.groupType].some((v) => String(v || '').toLowerCase().includes(needle))))
    .sort((a,b) => Number(b[metric] || 0)-Number(a[metric] || 0) || Number(b.units || 0)-Number(a.units || 0) || String(a.group || a.seller).localeCompare(String(b.group || b.seller)))
}
