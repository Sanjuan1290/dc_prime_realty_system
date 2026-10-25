// Pure policy for one in-house commission milestone, one account, one Network.
// Callers must first discover the full recipient list from the database.
export const validateExactBulkRecipients = ({ profitId, sellers = [], entries = [] }) => {
  const error = (message) => Object.assign(new Error(message), { statusCode: 400 });
  if (!Number.isSafeInteger(Number(profitId)) || Number(profitId) <= 0 || !Array.isArray(entries) || entries.length > 100)
    throw error('Invalid batch recipients.');
  const expected = new Set([`company:${Number(profitId)}`,
    ...sellers.map(s=>`seller:${Number(s.commissionId)}`)]);
  if (expected.size !== sellers.length+1) throw error('Saved recipient IDs are duplicated.');
  const incoming = new Map();
  for (const entry of entries) {
    const id = Number(entry?.commissionId);
    const key = entry?.type === 'company' ? `company:${Number(profitId)}` :
      entry?.type === 'seller' && Number.isSafeInteger(id) && id > 0 ? `seller:${id}` : '';
    if (!key || incoming.has(key)) throw error('Recipient list has a duplicate or invalid entry.');
    incoming.set(key,entry);
  }
  if (incoming.size !== expected.size || [...expected].some(key=>!incoming.has(key)))
    throw error('Recipients changed. Refresh and review all payees again.');
  return { expected:[...expected], incoming };
};

export const isLiveBulkStageEligible = (computedStatus) => ['Eligible','Released'].includes(computedStatus);
export const countPendingBulkRecipients = (companyStatus, sellerStatuses = []) =>
  Number(companyStatus !== 'Released') + sellerStatuses.filter(status=>status!=='Released').length;
