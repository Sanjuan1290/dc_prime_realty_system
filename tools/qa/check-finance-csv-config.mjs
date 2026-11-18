// Read-only local configuration check: no servers, database calls, or key output.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildFinanceExportSnapshot } from '../../SERVER/SYSTEM/services/companyFinanceExport.service.js';
import { buildSalaryFinanceSnapshot } from '../../SERVER/HR/services/salaryFinanceExport.service.js';
import { buildSignedFinanceCsv as signSystem } from '../../SERVER/SYSTEM/services/financeTransferCsv.js';
import { buildSignedFinanceCsv as signHr } from '../../SERVER/HR/services/financeTransferCsv.js';
import { parseUpload } from '../../SERVER/FINANCE/src/importFile.js';

const require = createRequire(new URL('../../SERVER/SYSTEM/package.json', import.meta.url));
const { parse } = require('dotenv');
const settings = Object.fromEntries(['SYSTEM', 'HR', 'FINANCE'].map(name => {
  const env = parse(readFileSync(new URL(`../../SERVER/${name}/.env`, import.meta.url)));
  const key = env.FINANCE_TRANSFER_SIGNING_SECRET;
  if (typeof key !== 'string' || key.trim().length < 32 || key.length > 512) {
    throw new Error(`${name}: FINANCE_TRANSFER_SIGNING_SECRET is missing or invalid.`);
  }
  return [name, key];
}));
if (settings.SYSTEM !== settings.HR || settings.SYSTEM !== settings.FINANCE) {
  throw new Error('The three signing keys differ. Use the same existing key on SYSTEM, HR, and Finance; do not rotate it independently.');
}

const from = '2026-11-18', to = from;
const company = buildFinanceExportSnapshot({
  from, to, overview: { balance_verified: true, money_in: '100.01', money_out: '0.00', available_balance: '100.01' },
  transactions: [{ reference: 'property:1', source: 'property', kind: 'income', amount: '100.01', txn_date: from, recorded_at: `${from} 08:00:00`, title: 'Synthetic offline check', category: 'Property Collections' }],
});
const hr = buildSalaryFinanceSnapshot({ from, to, events: [{ payload_json: {
  schema_version: '1.0', source_system: 'hr', source_payroll_id: '1', source_event_version: 1,
  event_type: 'salary.cash_released.v1', currency: 'PHP', cash_date: from, recorded_at: `${from}T00:00:00Z`,
  amount: '50.25', direction: 'out', display_label: 'Synthetic offline salary check',
} }] });
for (const [name, sign, snapshot, expectedIncome, expectedExpense] of [
  ['SYSTEM', signSystem, company, '100.01', '0.00'],
  ['HR', signHr, hr, '0.00', '50.25'],
]) {
  const buffer = sign(snapshot, { secret: settings[name] });
  const parsed = await parseUpload({ format: 'csv', buffer }, { secret: settings.FINANCE });
  if (parsed.rows.length !== 1 || parsed.totals.money_in !== expectedIncome || parsed.totals.money_out !== expectedExpense) {
    throw new Error(`${name}: synthetic CSV did not preserve exact totals.`);
  }
  console.log(`${name} -> Finance: configured keys match; synthetic signed CSV verified with exact totals.`);
}
console.log('Local files only. This does not verify deployed backend environment settings.');
