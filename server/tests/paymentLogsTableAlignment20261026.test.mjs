import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../client/src/pages/Lot_Projects/PaymentLogs.jsx', import.meta.url), 'utf8')

const columns = [...source.matchAll(/\{ label: '([^']+)', width: (\d+)(?:, align: '([^']+)')? \}/g)]

test('audit table defines all 15 readable columns at widths that do not crush cell text', () => {
  assert.equal(columns.length, 15)
  assert.equal(new Set(columns.map((match) => match[1])).size, 15)
  assert.ok(columns.every((match) => Number(match[2]) >= 90))
  assert.ok(Number(columns.at(-1)[2]) >= 300, 'Description must have sufficient width')
  assert.ok(Number(columns.find((match) => match[1] === 'Reference ID')[2]) >= 200)
  assert.match(source, /min-w-\[2600px\] table-fixed/)
  assert.match(source, /<colgroup>[\s\S]*auditTableColumns\.map\(\(column\)/)
  assert.match(source, /auditTableColumns\.map\(\(column\) => \(\s*<th/)
  assert.match(source, /overflow-x-auto overscroll-x-contain/)
})

test('audit headers and amount values follow the same right-alignment rule', () => {
  assert.equal(columns.find((match) => match[1] === 'Amount / Direction')[3], 'right')
  assert.match(source, /column\.align === 'right' \? 'text-right' : 'text-left'/)
  assert.match(source, /<td className="px-4 py-4 align-top text-right tabular-nums leading-5">/)
  assert.match(source, /whitespace-nowrap font-black text-slate-950">\{money\(log\.amount\)\}/)
})

test('audit values are aligned at row top, IDs remain intact, names and descriptions wrap at boundaries', () => {
  assert.match(source, /const auditCellClass = 'px-4 py-4 align-top text-left leading-5'/)
  for (const field of ['accountReference', 'unit']) {
    assert.match(source, new RegExp(`whitespace-nowrap[^>]*>\\{log\\.${field}\\}`))
  }
  for (const field of ['project', 'buyer', 'payee', 'paymentType', 'referenceId', 'encodedBy', 'actionDescription']) {
    assert.match(source, new RegExp(`break-words[^>]*>\\{log\\.${field}`))
  }
  assert.match(source, /role="region" aria-label="Payment and commission release history table" tabIndex=\{0\}/)
})

test('table keeps all five data categories and financial directions without modifying log data or filters', () => {
  for (const field of ['actionAtText', 'category', 'project', 'accountReference', 'accountStatus', 'unit', 'buyer', 'payee', 'amount', 'paymentType', 'paymentMethod', 'referenceId', 'actionLabel', 'encodedBy', 'actionDescription']) {
    assert.ok(source.includes(`log.${field}`), `${field} must remain rendered`)
  }
  assert.match(source, /paginatedLogs\.map\(\(log\)/)
  assert.match(source, /log\.direction === 'outgoing'/)
  assert.match(source, /queryKey: \['lot-payment-logs', projectSlug, queryString\]/)
  assert.match(source, /colSpan=\{15\}/)
})
