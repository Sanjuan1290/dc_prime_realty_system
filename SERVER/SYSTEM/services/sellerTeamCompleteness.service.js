// Advisory, read-only team staffing diagnostics. Never use this result to determine
// reservation/commission eligibility or to block seller activation.
const roleBelow = Object.freeze({ division_manager: 'sales_director', sales_director: 'unit_manager', unit_manager: 'sales_agent' });
const labels = Object.freeze({ sales_director: 'Sales Director', unit_manager: 'Unit Manager', sales_agent: 'Sales Agent' });
const roleAbove = Object.freeze({ sales_agent: 'unit_manager', unit_manager: 'sales_director', sales_director: 'division_manager' });
const idOf = (seller) => Number(seller?.user_id || 0);
const isActive = (seller) => seller?.user_status === 'active' && seller?.accredited_seller_status === 'active';

export const buildSellerTeamCompleteness = (members = [], { headUserId = null } = {}) => {
  const real = members.filter((member) => Number(member.is_system_dummy || 0) !== 1);
  const lookup = new Map(real.map((seller) => [idOf(seller), seller]));
  const reports = new Map();
  for (const seller of real) {
    if (!isActive(seller)) continue;
    const parentId = Number(seller.accredited_seller_reports_under_user_id || 0);
    if (!reports.has(parentId)) reports.set(parentId, []);
    reports.get(parentId).push(seller);
  }
  const memo = new Map();
  const check = (seller, visiting = new Set()) => {
    const id = idOf(seller);
    if (memo.has(id)) return memo.get(id);
    if (!isActive(seller)) return { status: 'inactive', directReportCount: 0, completeBranches: 0, missingRole: null, messages: [] };
    const requiredRole = roleBelow[seller.role];
    if (!requiredRole) {
      if (seller.role !== 'sales_agent') return { status: 'not_applicable', directReportCount: 0, completeBranches: 0, missingRole: null, messages: [] };
      let current = seller;
      const seen = new Set();
      while (roleAbove[current.role]) {
        if (seen.has(idOf(current))) return { status: 'needs_assignment', directReportCount: 0, completeBranches: 0, missingRole: null, messages: ['Reporting chain contains a cycle'] };
        seen.add(idOf(current));
        const expected = roleAbove[current.role];
        const parent = lookup.get(Number(current.accredited_seller_reports_under_user_id || 0));
        if (!parent || parent.role !== expected || !isActive(parent))
          return { status: 'needs_assignment', directReportCount: 0, completeBranches: 0, missingRole: null, messages: [`Assign an active ${labels[expected] || 'Division Manager'} as reporting manager`] };
        current = parent;
      }
      return { status: 'complete', directReportCount: 0, completeBranches: 0, missingRole: null, messages: [] };
    }
    if (visiting.has(id)) return { status: 'needs_assignment', directReportCount: 0, completeBranches: 0, missingRole: requiredRole, messages: ['Reporting chain contains a cycle'] };
    const children = (reports.get(id) || []).filter((child) => child.role === requiredRole);
    if (!children.length) {
      const result = { status: 'needs_assignment', directReportCount: 0, completeBranches: 0, missingRole: requiredRole, messages: [`No active ${labels[requiredRole]} assigned`] };
      memo.set(id, result);
      return result;
    }
    const next = new Set(visiting); next.add(id);
    const childrenStatuses = children.map((child) => check(child, next));
    const completeBranches = childrenStatuses.filter((result) => result.status === 'complete').length;
    const incomplete = childrenStatuses.length - completeBranches;
    const status = incomplete === 0 ? 'complete' : completeBranches > 0 ? 'partial' : 'needs_assignment';
    const messages = incomplete ? [`${incomplete} of ${children.length} ${labels[requiredRole]} branch(es) incomplete`] : [];
    // When direct reports exist but a lower branch is incomplete, adding another direct
    // report is not the right action; inspect/fix the existing child branch instead.
    const result = { status, directReportCount: children.length, completeBranches, missingRole: null, messages };
    memo.set(id, result);
    return result;
  };
  const records = real.map((seller) => ({
    userId: idOf(seller), accreditedSellerId: Number(seller.accredited_seller_id || 0),
    role: seller.role, ...check(seller),
    // UI hint only. The mutation rechecks all linked sellers in a DB transaction.
    // Include inactive direct reports: they still have a reporting relationship.
    canDeactivateWithoutReplacement: Boolean(roleBelow[seller.role]) && isActive(seller)
      // The designated Network Head cannot be deactivated, even with no team.
      && !(seller.role === 'division_manager' && Number(headUserId || 0) === idOf(seller))
      // Count inactive direct reports too: they remain linked to this manager.
      && !real.some((member) => Number(member.accredited_seller_reports_under_user_id || 0) === idOf(seller)),
  }));
  // Summary represents managerial teams. Sales Agents are tracked separately.
  const managers = records.filter((row) => roleBelow[row.role]);
  const summary = {
    complete: managers.filter((r) => r.status === 'complete').length,
    partial: managers.filter((r) => r.status === 'partial').length,
    needsAssignment: managers.filter((r) => r.status === 'needs_assignment').length,
    inactive: managers.filter((r) => r.status === 'inactive').length,
    agentsNeedingManager: records.filter((r) => r.role === 'sales_agent' && r.status === 'needs_assignment').length,
  };
  return { summary, records };
};


