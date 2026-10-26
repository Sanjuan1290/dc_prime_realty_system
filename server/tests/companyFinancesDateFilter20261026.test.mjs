import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, resolve} from 'node:path'
import {financeRangeOptions, getFinancePresetRange} from '../../client/src/pages/System/companyFinanceDateRanges.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const source=readFileSync(resolve(root,'client/src/pages/System/CompanyFinances.jsx'),'utf8')

test('finance range dropdown uses all seven Reports presets',()=>{
  assert.deepEqual(financeRangeOptions.map(x=>x.value),['this_month','last_month','2_months','3_months','6_months','12_months','custom'])
  assert.match(source, /Report Date Filter/)
  assert.match(source, /<select aria-label="Date range" value={dateRange}/)
  assert.doesNotMatch(source, /<button[^>]*>This Month<\/button>/)
})
test('month presets cover entire calendar months across year boundaries',()=>{
  const cases=[
    ['this_month','2026-10-26','2026-10-01','2026-10-31'],
    ['last_month','2026-10-26','2026-09-01','2026-09-30'],
    ['2_months','2026-10-26','2026-09-01','2026-10-31'],
    ['3_months','2026-10-26','2026-08-01','2026-10-31'],
    ['6_months','2026-10-26','2026-05-01','2026-10-31'],
    ['12_months','2026-10-26','2025-11-01','2026-10-31'],
    ['last_month','2026-01-20','2025-12-01','2025-12-31'],
    ['3_months','2026-01-20','2025-11-01','2026-01-31'],
    ['this_month','2024-02-19','2024-02-01','2024-02-29'],
  ]
  for(const [key,today,from,to] of cases) assert.deepEqual(getFinancePresetRange(key,today),{from,to},`${key} ${today}`)
  assert.equal(getFinancePresetRange('custom','2026-10-26'),null)
  assert.equal(getFinancePresetRange('not-a-range','2026-10-26'),null)
})
test('Custom preserves current values and unlocks dates; presets lock dates',()=>{
  assert.match(source,/if\(value==='custom'\) return/)
  assert.match(source,/disabled={!isCustomRange}/)
  assert.match(source,/changeDate\(setFrom,e.target.value\)/)
  assert.match(source,/changeDate\(setTo,e.target.value\)/)
  assert.match(source,/const changeRange=\(value\)=>\{[\s\S]*?setPage\(1\)/)
  assert.match(source,/const changeDate=\(setter,value\)=>\{setPage\(1\);setter\(value\)\}/)
})
test('finance results and CSV export both use selected from/to and prevent invalid requests',()=>{
  assert.match(source,/queryKey:\['company-finances',from,to,page\]/)
  assert.match(source,/enabled:!!user&&Boolean\(from&&to\)&&from<=to/)
  assert.match(source,/new URLSearchParams\(\{from,to,page:String\(page\)\}\)/)
  assert.match(source,/new URLSearchParams\(\{from,to\}\)/)
})
