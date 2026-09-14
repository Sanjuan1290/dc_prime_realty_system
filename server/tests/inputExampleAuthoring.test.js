import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('input example decorator renders only authored data-example values on free-form controls', () => {
  const decorator = read('client/src/components/Shared/InputExampleDecorator.jsx')
  assert.match(decorator, /\[data-example\]/)
  assert.match(decorator, /TEXTAREA/)
  assert.match(decorator, /\['text', 'number'\]/)
  assert.doesNotMatch(decorator, /first name|middle name|rate\|percentage|currency|amount\|fee|inferExample/)
})

test('business-specific examples are authored on their own fields', () => {
  const priceList = read('client/src/pages/Lot_Projects/Dashboard.jsx')
  const rates = read('client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx')
  assert.match(priceList, /data-example=['\"]20 months['\"]/)
  assert.doesNotMatch(priceList, /data-example=['\"][^'\"]*₱/)
  assert.match(rates, /data-example=['\"]8%['\"]/)
  assert.match(rates, /Division Manager Rate['\"], ['\"]1%/)
  assert.match(rates, /Sales Agent Rate['\"], ['\"]5%/)
})

test('example helper text remains visually secondary', () => {
  const css = read('client/src/index.css')
  assert.match(css, /\.dc-input-example[\s\S]*?font-size:\s*10px/)
  assert.match(css, /font-style:\s*italic/)
})
