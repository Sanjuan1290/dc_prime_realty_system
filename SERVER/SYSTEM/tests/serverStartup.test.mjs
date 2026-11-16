import test from 'node:test'
import assert from 'node:assert/strict'
import {checkStartupDatabase,readStartupTimeout} from '../services/serverStartup.service.js'

test('database startup releases the connection only after SELECT 1 succeeds',async()=>{
  let released=0
  const connection={query:async options=>{assert.equal(options.sql,'SELECT 1');assert.equal(options.timeout,100)},release:()=>released++,destroy:()=>assert.fail('Healthy connection was destroyed')}
  await checkStartupDatabase({getConnection:async()=>connection},{timeoutMs:100})
  assert.equal(released,1)
})
test('a stalled connection acquisition fails within the overall deadline',async()=>{
  await assert.rejects(checkStartupDatabase({getConnection:()=>new Promise(()=>{})},{timeoutMs:25}),{code:'DATABASE_STARTUP_TIMEOUT',stage:'connection'})
})
test('a connection arriving after the deadline is destroyed without running a query',async()=>{
  let acquired, destroyed=0
  const promise=new Promise(resolve=>{acquired=resolve})
  await assert.rejects(checkStartupDatabase({getConnection:()=>promise},{timeoutMs:25}),{code:'DATABASE_STARTUP_TIMEOUT'})
  acquired({destroy:()=>destroyed++,query:()=>assert.fail('Late connection queried'),release:()=>assert.fail('Late connection returned to pool')})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(destroyed,1)
})
test('a stalled SELECT 1 is bounded and its connection is discarded',async()=>{
  let destroyed=0
  const connection={query:()=>new Promise(()=>{}),destroy:()=>destroyed++,release:()=>assert.fail('Stalled connection returned to pool')}
  await assert.rejects(checkStartupDatabase({getConnection:async()=>connection},{timeoutMs:25}),{code:'DATABASE_STARTUP_TIMEOUT',stage:'query'})
  assert.equal(destroyed,1)
})
test('connection failures retain their actionable code and stage',async()=>{
  const error=Object.assign(new Error('Sensitive driver details'),{code:'ER_ACCESS_DENIED_ERROR'})
  await assert.rejects(checkStartupDatabase({getConnection:async()=>{throw error}},{timeoutMs:100}),{code:'ER_ACCESS_DENIED_ERROR',stage:'connection'})
})
test('query failures discard the connection and retain the query stage',async()=>{
  let destroyed=0
  const connection={query:async()=>{throw Object.assign(new Error('failed'),{code:'ER_BAD_DB_ERROR'})},destroy:()=>destroyed++,release:()=>assert.fail('Failed connection returned to pool')}
  await assert.rejects(checkStartupDatabase({getConnection:async()=>connection},{timeoutMs:100}),{code:'ER_BAD_DB_ERROR',stage:'query'})
  assert.equal(destroyed,1)
})
test('startup deadlines have defaults and reject unbounded or invalid configuration',()=>{
  assert.equal(readStartupTimeout(undefined,30000,'TIMEOUT'),30000)
  assert.equal(readStartupTimeout('',30000,'TIMEOUT'),30000)
  assert.equal(readStartupTimeout('15000',30000,'TIMEOUT'),15000)
  for(const value of ['0','-1','NaN','Infinity','1.5','120001'])assert.throws(()=>readStartupTimeout(value,30000,'TIMEOUT'),/TIMEOUT must be an integer/)
})
