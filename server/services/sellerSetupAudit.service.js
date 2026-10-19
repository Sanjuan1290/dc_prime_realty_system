import { getRequiredParentRole, SELLER_ROLE_LABELS } from '../controllers/System/sellerHierarchyRules.js';
import { buildSellerTeamCompleteness } from './sellerTeamCompleteness.service.js';

// Pure and read-only. Never attempt to repair seller data while collecting findings.
const numberId = (value) => Number(value || 0);
const userActive = (row) => row?.user_status === 'active';
const sellerActive = (row) => row?.accredited_seller_status === 'active';
const sellerName = (row) => String(row?.full_name || row?.account_code || 'Seller').trim();
const issue = (code, message, severity = 'blocking') => ({ code, message, severity });

export const buildSellerSetupAudit = ({ group, members = [], managerLinks = [], projects = [], assignedCounts = [] }) => {
  const sellers = members.filter((row) => Number(row.is_system_dummy || 0) !== 1);
  const lookup = new Map(sellers.map((row) => [numberId(row.user_id), row]));
  const teamAudit = buildSellerTeamCompleteness(sellers);
  const teams = new Map(teamAudit.records.map((row) => [row.userId, row]));
  const linksByChild = new Map();
  for (const link of managerLinks) {
    const key = numberId(link.managed_user_id);
    if (!linksByChild.has(key)) linksByChild.set(key, []);
    linksByChild.get(key).push(numberId(link.manager_user_id));
  }
  const countBySeller = new Map(assignedCounts.map((row) => [numberId(row.assigned_accredited_seller_id), Number(row.buyer_count || 0)]));
  const headId = numberId(group.seller_group_head_user_id);
  const activeProjects = projects.filter((row) => row.seller_group_lot_project_rate_status === 'active' && row.lot_project_status === 'active');
  const networkWarnings = [];
  if (group.seller_group_status !== 'active') networkWarnings.push('Network is inactive');
  if (!headId) networkWarnings.push('No Division Manager assigned as Network Head');
  if (!activeProjects.length) networkWarnings.push('No active project commission setup');
  const head = lookup.get(headId);
  if (headId && !head) networkWarnings.push('Network Head is not a member of this Network');
  if (head && head.role !== 'division_manager') networkWarnings.push('Network Head must be a Division Manager');

  const records = sellers.map((seller) => {
    const issues = [];
    const add = (code, message, severity = 'blocking') => {
      if (!issues.some((x) => x.code === code)) issues.push(issue(code, message, severity));
    };
    const active = userActive(seller) && sellerActive(seller);
    if (userActive(seller) !== sellerActive(seller)) add('STATUS_MISMATCH','Account and seller status do not match','warning');
    if (!active) add('SELLER_INACTIVE','Seller is inactive');
    if (group.seller_group_status !== 'active') add('NETWORK_INACTIVE','Network is inactive');
    if (!activeProjects.length) add('PROJECT_SETUP','No active project commission setup');
    if (!head) add('HEAD_MISSING','No valid Network Head assigned');
    else if (head.role !== 'division_manager') add('HEAD_WRONG_ROLE','Network Head must be a Division Manager');
    else if (!userActive(head) || !sellerActive(head)) add('HEAD_INACTIVE','Division Manager is inactive');
    const visited = new Set();
    let current = seller;
    for (let depth=0;depth<6 && current;depth++) {
      const currentUserId = numberId(current.user_id);
      if (visited.has(currentUserId)) { add('CYCLE','Reporting assignments form a loop');break; }
      visited.add(currentUserId);
      if (current.role === 'division_manager') {
        if (numberId(current.accredited_seller_reports_under_user_id)) add('DM_PARENT','Division Manager must report to the Developer');
        break;
      }
      const expectedRole = getRequiredParentRole(current.role);
      if (!expectedRole) { add('INVALID_ROLE','This seller has an incorrect position'); break; }
      const parentId = numberId(current.accredited_seller_reports_under_user_id);
      if (!parentId) { add('NO_PARENT',`No ${SELLER_ROLE_LABELS[expectedRole]} assigned`);break; }
      const parent = lookup.get(parentId);
      if (!parent) { add('PARENT_NOT_IN_NETWORK','Assigned manager is not part of this Network');break; }
      if (parent.role !== expectedRole) { add('PARENT_ROLE',`Expected ${SELLER_ROLE_LABELS[expectedRole]} as manager`);break; }
      if (!userActive(parent) || !sellerActive(parent)) add('INACTIVE_PARENT',`${SELLER_ROLE_LABELS[parent.role]} is inactive`);
      const managedLinks = linksByChild.get(currentUserId) || [];
      if (managedLinks.length !== 1 || managedLinks[0] !== parentId) add('MANAGER_LINK','Manager records do not match','warning');
      current = parent;
      if (depth===5) add('LONG_CHAIN','Reporting chain could not be completed');
    }
    if (seller.role === 'division_manager' && (linksByChild.get(numberId(seller.user_id)) || []).length) add('DM_LINK','Division Manager has an unexpected manager link','warning');
    const severity = !active ? 'inactive' : issues.some((i) => i.severity === 'blocking') ? 'blocked' : issues.length ? 'attention' : 'ready';
    return {
      accreditedSellerId: numberId(seller.accredited_seller_id), userId: numberId(seller.user_id),
      name: sellerName(seller), role: seller.role,
      accountStatus: seller.user_status, sellerStatus: seller.accredited_seller_status,
      readiness: severity, issueCount: issues.length,
      team: teams.get(numberId(seller.user_id)) || null,
      assignedBuyerCount: countBySeller.get(numberId(seller.accredited_seller_id)) || 0,
      issues,
    };
  });
  return {
    group: { id: numberId(group.seller_group_id), name: group.seller_group_name, status: group.seller_group_status },
    networkWarnings,
    teamSummary: teamAudit.summary,
    summary: { total: records.length, ready: records.filter((r)=>r.readiness==='ready').length,
      attention: records.filter((r)=>r.readiness==='attention').length,
      blocked: records.filter((r)=>r.readiness==='blocked').length,
      inactive: records.filter((r)=>r.readiness==='inactive').length },
    records,
  };
};


