import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseSalaryEvent, payloadHash, compareSecrets } from '../services/salaryEventContract.js';
import { recordSalaryEvent } from '../services/externalSalaryEvents.service.js';
import { financeActivitySqlFor, computeCashSummary, summarizeCashSources } from '../services/companyFinances.service.js';

const event = (id=randomUUID(), overrides={}) => ({
  schema_version:'1.0',event_id:id,event_type:'salary.cash_released.v1',source_system:'hr',source_payroll_id:'12',source_event_version:1,
  cash_date:'2026-10-27',recorded_at:'2026-10-27T12:00:00.000Z',currency:'PHP',amount:'6749.99',direction:'out',
  reference:'HR-PAYROLL-12-RELEASE-1',display_label:'Salary payment #12',...overrides,
});
const memoryPool = () => {
  const events=new Map(), entries=new Map();
  const db = {
    async beginTransaction(){this.pendingEvents=[];this.pendingEntries=[]},
    async commit(){ for(const [k,v] of this.pendingEvents) events.set(k,v);for(const [k,v] of this.pendingEntries) entries.set(k,v);this.pendingEvents=[];this.pendingEntries=[] },
    async rollback(){this.pendingEvents=[];this.pendingEntries=[]},
    release(){},
    async query(sql,args){
      if (sql.includes('SELECT event_id, source_payroll_id, payload_sha256')) return [[...events.values()].filter(e => e.event_id===args[0] || (e.source_payroll_id===args[1] && e.version===args[2]))];
      if (sql.includes('INSERT INTO finance_external_salary_event_inbox')) { this.pendingEvents.push([args[0],{event_id:args[0],source_payroll_id:args[1],payload_sha256:args[2],version:1}]);return [{affectedRows:1}] }
      if (sql.includes('INSERT INTO finance_external_salary_entries')) { this.pendingEntries.push([args[0],args[3]]);return [{affectedRows:1}] }
      throw Error('unexpected SQL '+sql);
    }
  };
  return {getConnection:async()=>db,events,entries};
};

test('accepts valid immutable cash release and deterministic hash',()=>{
  const e = parseSalaryEvent(event());
  assert.equal(e.amount,'6749.99');
  assert.equal(payloadHash({...e}),payloadHash(Object.fromEntries(Object.entries(e).reverse())));
});
test('rejects malformed amount, dates, amount 0, extra personal information and unsupported event types',()=>{
  for(const overrides of [{amount:'-2.00'},{amount:'0.00'},{amount:6749.99},{cash_date:'2026-02-30'},{event_type:'salary.cash_returned.v1'},{employee_name:'PRIVATE'},{source_event_version:2}])
    assert.throws(()=>parseSalaryEvent(event(randomUUID(),overrides)));
});
test('token compare uses exact matching and rejects short/missing credentials',()=>{
  const secret='x'.repeat(64);
  assert.equal(compareSecrets(secret,secret),true);
  assert.equal(compareSecrets(secret+'!',secret),false);
  assert.equal(compareSecrets('bad','bad'),false);
});
test('one cash release recorded once; identical retry acknowledged; conflicting identity rejected',async()=>{
  const pool=memoryPool();const e=event();
  assert.equal((await recordSalaryEvent(pool,e)).status,'recorded');
  assert.equal((await recordSalaryEvent(pool,e)).status,'already_processed');
  assert.equal(pool.entries.size,1);
  assert.equal(pool.events.size,1);
  await assert.rejects(recordSalaryEvent(pool,{...e,amount:'6750.00'}),{code:'SALARY_EVENT_CONFLICT'});
  await assert.rejects(recordSalaryEvent(pool,event(randomUUID())),{code:'SALARY_EVENT_CONFLICT'});
  assert.equal(pool.entries.size,1);
});
test('legacy mode reads payroll; external mode reads only salary projection without losing other sources',()=>{
  const oldSql=financeActivitySqlFor('legacy'), newSql=financeActivitySqlFor('external');
  assert.match(oldSql,/FROM employee_payrolls p/);
  assert.doesNotMatch(newSql,/FROM employee_payrolls/);
  assert.match(newSql,/FROM finance_external_salary_entries e/);
  for (const source of ['lot_project_payments','lot_project_commission_releases','lot_project_network_profit_releases','lot_project_reservation_history']) assert.ok(oldSql.includes(source)&&newSql.includes(source));
});
test('salary totals and report balance stay consistent with one source',()=>{
  const rows=[{reference:'salary:12',txn_date:'2026-10-27',kind:'expense',amount:'6749.99',source:'salary',recorded_at:'2026-10-27 12:00:00'},
    {reference:'property:1',txn_date:'2026-10-27',kind:'income',amount:'50000.00',source:'property',recorded_at:'2026-10-27 12:00:00'}];
  const summary=computeCashSummary({openingBalance:0,startDate:'2026-10-01',from:'2026-10-01',to:'2026-10-27',activities:rows});
  assert.equal(summary.available_balance,43250.01);
  assert.equal(summarizeCashSources({transactions:summary.transactions}).salary_paid,6749.99);
});
