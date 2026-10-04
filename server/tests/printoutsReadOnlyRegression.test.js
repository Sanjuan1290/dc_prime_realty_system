import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('current buyer account does not become read-only merely because an account object exists', () => {
  const printouts = read(
    'client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx'
  )
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx')

  assert.match(printouts, /readOnly\s*=\s*false/)
  assert.match(printouts, /readOnly:\s*Boolean\(readOnly\)/)
  assert.match(printouts, /readOnly=\{readOnly\}/)

  assert.doesNotMatch(printouts, /readOnly:\s*Boolean\(account\)/)
  assert.doesNotMatch(printouts, /readOnly=\{Boolean\(account\)\}/)

  assert.match(
    listingProfile,
    /<Printouts[\s\S]*account=\{account\}[\s\S]*readOnly=\{readOnly\}/
  )
})
