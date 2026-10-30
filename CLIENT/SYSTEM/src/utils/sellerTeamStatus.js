// Display-only labels for the existing read-only staffing assessment.
// Keep API status values unchanged: they are also used by filters and audits.
const noDirectReports = Object.freeze({
  division_manager: 'No Sales Directors',
  sales_director: 'No Unit Managers',
  unit_manager: 'No Sales Agents',
})

export const getTeamCompletenessLabel = (team, role = team?.role) => {
  switch (team?.status) {
    case 'complete': return 'Team Complete'
    case 'partial': return 'Some Teams Incomplete'
    case 'inactive': return 'Inactive'
    case 'not_applicable': return 'Not Applicable'
    case 'needs_assignment':
      // An SA has no downline to staff. This is an upward-chain problem.
      if (role === 'sales_agent') return 'Assignment Issue'
      // A manager with no direct reports needs their required downline role.
      if (Number(team?.directReportCount || 0) === 0) {
        return noDirectReports[role] || 'Team Below Incomplete'
      }
      // The manager is already assigned: one or more lower branches are incomplete.
      return 'Team Below Incomplete'
    default: return 'Unknown'
  }
}

export const getTeamCompletenessHint = (team, role = team?.role) => {
  if (!team) return 'Team information has not loaded yet.'
  const details = (team.messages || []).filter(Boolean).join('. ')
  if (team.status === 'complete') {
    return role === 'sales_agent'
      ? 'This Sales Agent has an active, complete reporting chain.'
      : 'All required teams below this manager have active members.'
  }
  if (team.status === 'inactive') return 'The seller account is inactive.'
  if (role === 'division_manager') {
    return [
      'Division Managers report directly to the Developer. This status refers to the teams below them, not a missing manager.',
      details,
    ].filter(Boolean).join(' ')
  }
  return details || 'Review this seller’s reporting structure in Check Seller Setup.'
}

