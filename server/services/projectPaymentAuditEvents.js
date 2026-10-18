// A read-only project audit feed. Buyer collections and outgoing commission payouts
// remain different financial directions; never total these categories together.
export const PROJECT_AUDIT_CATEGORIES = Object.freeze(['buyer_payment', 'seller_commission', 'company_profit']);

export const resolveAuditCategory = (value) => PROJECT_AUDIT_CATEGORIES.includes(value) ? value : 'all';

const toNumber = (value) => Number(value || 0);
const dateOnly = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return '-';
};
const titleCase = (value = '') => String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (char) => char.toUpperCase());

const actorName = (row) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || 'Not recorded';
const timeValue = (value) => {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || '').replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mapSellerReleaseAuditRow = (row, projectName, displayDate) => {
  const name = row.commission_role === 'external_group'
    ? row.seller_group_name_snapshot || row.seller_display_name_snapshot || row.seller_name || 'External Network'
    : row.seller_display_name_snapshot || row.seller_name || 'Unknown seller';
  const date = dateOnly(row.actual_release_date);
  const historical = row.release_entry_mode === 'historical';
  return {
    id: `seller-release-${row.release_id}`,
    category: 'seller_commission', direction: 'outgoing',
    action: 'released', actionLabel: 'Released',
    actionAt: row.action_at, actionAtText: row.recorded_at ? displayDate(row.action_at) : `${dateOnly(row.actual_release_date)} (release date)`,
    project: projectName, accountReference: row.account_reference || '-',
    accountStatus: row.account_status || '-', unit: row.unit || '-',
    buyer: row.buyer || 'No buyer name', payee: name,
    amount: toNumber(row.net_release_amount),
    paymentType: `${row.release_stage} · ${titleCase(row.commission_role)}`,
    paymentMethod: '-',
    referenceId: row.receipt_reference || `Release #${row.release_id}`,
    encodedBy: row.archived ? 'Not retained in archive' : actorName(row),
    actionDescription: `${row.archived ? 'Archived cancellation settlement · ' : ''}${historical ? 'Historical ' : ''}seller commission released to ${name}. Actual release: ${date}. ${row.receipt_reference ? `Proof of Income reference: ${row.receipt_reference}.` : 'No linked Proof of Income receipt reference.'}`,
    releaseId: row.release_id,
  };
};

export const mapCompanyProfitAuditRow = (row, projectName, displayDate) => {
  const name = row.payee_name || row.payee_name_snapshot || row.network_name_snapshot || 'Network payee';
  return {
    id: `company-profit-${row.release_id}`,
    category: 'company_profit', direction: 'outgoing',
    action: 'released', actionLabel: 'Released',
    actionAt: row.action_at, actionAtText: row.recorded_at ? displayDate(row.action_at) : `${dateOnly(row.actual_release_date)} (release date)`,
    project: projectName, accountReference: row.account_reference || '-',
    accountStatus: row.account_status || '-', unit: row.unit || '-',
    buyer: row.buyer || 'No buyer name', payee: name,
    amount: toNumber(row.release_amount),
    paymentType: row.release_stage,
    paymentMethod: row.payment_method || '-',
    referenceId: row.payment_reference || `Release #${row.release_id}`,
    encodedBy: actorName(row),
    actionDescription: `In-House Network Company Profit payout to ${name} (${row.network_name_snapshot || 'Network'}). Actual release: ${dateOnly(row.actual_release_date)}.`,
    releaseId: row.release_id,
  };
};

export const combineProjectPaymentAudit = (buyerPayments = [], sellerReleases = [], companyReleases = [], limit = 300) => {
  const entries = [...buyerPayments, ...sellerReleases, ...companyReleases]
    .sort((a, b) => timeValue(b.actionAt) - timeValue(a.actionAt) || String(b.id).localeCompare(String(a.id)))
    .slice(0, limit);
  const stats = entries.reduce((summary, item) => {
    summary.total += 1;
    summary[item.action] = (summary[item.action] || 0) + 1;
    if (item.category === 'buyer_payment') summary.buyerPaymentLogs += 1;
    if (item.category === 'seller_commission') summary.sellerReleases += 1;
    if (item.category === 'company_profit') summary.companyProfitReleases += 1;
    return summary;
  }, { total: 0, created: 0, updated: 0, deleted: 0, released: 0, buyerPaymentLogs: 0, sellerReleases: 0, companyProfitReleases: 0 });
  return { entries, stats };
};

