/** Pure validation and exact decimal arithmetic (integer centavos). */
export const problem = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw problem('INVALID_DATE', 'Use YYYY-MM-DD.');
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw problem('INVALID_DATE', 'Date is not valid.');
  return value;
}
export function phpCents(value) {
  if (typeof value !== 'string' && typeof value !== 'number') throw problem('INVALID_AMOUNT', 'Enter a positive peso amount.');
  const raw = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw problem('INVALID_AMOUNT', 'Amount must have up to 2 decimals.');
  const [whole, fraction=''] = raw.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (cents <= 0n || cents > 9999999999999999n) throw problem('INVALID_AMOUNT', 'Amount is outside supported range.');
  return cents;
}
export function pesos(value) {
  const n = BigInt(value); const abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2,'0')}`;
}
export function money(value) { return pesos(phpCents(value)); }
export function dateInManila() {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Manila', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validateTransaction(body, today=dateInManila()) {
  const kind = body?.kind;
  if (!['income','expense'].includes(kind)) throw problem('INVALID_KIND', 'Choose income or expense.');
  const amount = money(body?.amount);
  const transaction_date = validDate(body?.transaction_date);
  if (transaction_date > today) throw problem('FUTURE_DATE', 'Future transactions cannot be posted.');
  const category_id = Number(body?.category_id);
  if (!Number.isSafeInteger(category_id) || category_id <= 0) throw problem('INVALID_CATEGORY', 'Choose a category.');
  const description = String(body?.description??'').trim();
  if (!description || description.length > 240) throw problem('INVALID_DESCRIPTION', 'Description must contain 1–240 characters.');
  const notes = String(body?.notes??'').trim();
  if (notes.length > 1000) throw problem('INVALID_NOTES', 'Notes are too long.');
  return {kind,amount,transaction_date,category_id,description,notes:notes || null};
}
export function validateRange(query={}, today=dateInManila()) {
  const from = validDate(query.from ?? `${today.slice(0,7)}-01`);
  const to = validDate(query.to ?? today);
  if (from > to) throw problem('INVALID_RANGE', 'From date cannot follow To date.');
  return {from,to};
}
export function summarizeRows(rows, from, to) {
  // Only posted rows affect cash; all-history account starts at PHP 0.00.
  let opening=0n, moneyIn=0n, moneyOut=0n;
  for (const r of rows) {
    if (r.status !== 'posted' || r.transaction_date > to) continue;
    const amount = phpCents(String(r.amount));
    const delta = r.kind === 'income' ? amount : -amount;
    if (r.transaction_date < from) opening += delta;
    else if (r.kind === 'income') moneyIn += amount;
    else moneyOut += amount;
  }
  return {opening_balance:pesos(opening),money_in:pesos(moneyIn),money_out:pesos(moneyOut),net_change:pesos(moneyIn-moneyOut),closing_balance:pesos(opening+moneyIn-moneyOut),currency:'PHP'};
}
export function canWrite(role) { return ['admin','accountant'].includes(role); }
export function canAdmin(role) { return role === 'admin'; }
