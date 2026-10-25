// Stable references derive from the saved source ID, never from a COUNT or client value.
export const makeCommissionCashReference = ({ date, unitCode, id, kind }) => {
  const dateKey = String(date || '').slice(0, 10).replaceAll('-', '');
  const unit = String(unitCode || 'UNIT').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const kinds = { seller: 'SR', company: 'NP', proof: 'PR' };
  const number = Number(id);
  if (!/^\d{8}$/.test(dateKey) || !Number.isSafeInteger(number) || number <= 0 || !kinds[kind])
    throw new Error('A saved release/receipt ID and date are required for a Cash reference.');
  return `CASH-${dateKey}-${unit}-${kinds[kind]}${String(number).padStart(6, '0')}`;
};
