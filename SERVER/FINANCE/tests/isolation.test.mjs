import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import{join,dirname}from'node:path';import{fileURLToPath}from'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');const read=path=>readFileSync(join(root,path),'utf8');
test('Finance database names only; no Realty/HR SQL tables in code',()=>{
  const files=['src/ledger.js','src/server.js','src/db.js','src/auth.js'];
  for(const f of files){const s=read(f);assert.doesNotMatch(s,/\b(?:employee_payrolls|lot_project_payments|lot_project_commission_releases|company_finance_transactions|dc_prime_hr_db|dc_prime_realty_system_db)\b/,f);}
});
test('Batch 13 import endpoints remain disabled without explicit staging approval',()=>{const s=read('src/server.js');assert.match(s,/FINANCE_IMPORTS_ENABLED==='true'/);assert.match(s,/imports\/preview`,requireRole\('admin'\),requireImportEnabled/);assert.match(s,/imports\/:id\/commit`,requireRole\('admin'\),requireImportEnabled/);});
test('Finance schema has only finance-owned tables',()=>{
  const sql=read('migrations/02_create_finance_schema.sql');
  const tables=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(x=>x[1]);
  assert.deepEqual(tables,['finance_users','finance_sessions','finance_categories','finance_transactions','finance_audit_logs']);
  assert.match(sql,/UNIQUE KEY uq_finance_source/);assert.match(sql,/UNIQUE KEY uq_finance_correction/);
});
test('No delete transaction endpoint; manual adjustments are auditable',()=>{const src=read('src/server.js');assert.doesNotMatch(src,/app\.delete\(/);assert.match(src,/transactions\/:id\/void/);assert.match(src,/transactions\/:id\/correct/);});
test('Protected finance endpoints authenticate and authorize',()=>{const s=read('src/server.js');assert.match(s,/app\.use\(prefix,requireUser\)/);assert.match(s,/requireRole\('admin','accountant'\)/);assert.match(s,/requireRole\('admin'\)/);assert.match(s,/CSRF_ORIGIN/);});
test('Bootstrap refuses existing users',()=>{assert.match(read('scripts/create-admin.mjs'),/COUNT\(\*\) AS n/);assert.match(read('scripts/create-admin.mjs'),/Bootstrap refused/);});
