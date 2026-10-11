import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Edit SOA Terms stays in its own two-step flow before opening Final Double-Check', () => {
  const file = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
  const start = file.indexOf('const SoaTermsModal =')
  const end = file.indexOf('const PaymentsSOA =', start)
  const source = file.slice(start, end)

  assert.match(source, /const goToScheduleStep = \(\) => \{[\s\S]*setStep\(2\)/)
  assert.match(source, /Next: Schedule & Penalty/)
  assert.match(source, /<button type="button" onClick=\{goToScheduleStep\}/)

  assert.match(source, /const proceedToFinalReview = \(\) => \{[\s\S]*if \(step !== 2\) return[\s\S]*onSave\(/)
  assert.match(source, /<form onSubmit=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.match(source, /<button type="button" onClick=\{proceedToFinalReview\}[^>]*>[\s\S]*Proceed to Final Review/)

  assert.doesNotMatch(source, /<button type="submit"[^>]*>[\s\S]{0,250}Proceed to Final Review/)
})

