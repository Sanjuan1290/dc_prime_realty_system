import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name) => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8')

test('member tools are consolidated and remain permission-gated', () => {
  const page = read('CLIENT/SYSTEM/src/pages/System/SellerGroupDetails.jsx')
  const modal = read('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/NetworkMemberToolsModal.jsx')
  assert.match(page, /<FiTool \/> Member Tools/)
  assert.match(page, /!isExternal && \(canImportMembers \|\| canExportMembers\)/)
  assert.match(page, /onImport=\{\(\) =>/)
  assert.match(page, /onUndo=\{\(\) =>/)
  assert.match(page, /onExport=\{async \(\) =>/)
  assert.match(modal, /canImportMembers \?/) 
  assert.match(modal, /canExportMembers \?/)
  assert.match(modal, /Import Members/)
  assert.match(modal, /Undo Import/)
  assert.match(modal, /Export Members/)
})

test('seller setup opens as an accessible modal, replacement history uses a history clock icon', () => {
  const page = read('CLIENT/SYSTEM/src/pages/System/SellerGroupDetails.jsx')
  const setup = read('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/SellerSetupCheck.jsx')
  assert.match(page, /<FiClock\/> Replacement History/)
  assert.doesNotMatch(page, /<FiRotateCcw\/> Replacement History/)
  assert.match(setup, /createPortal/)
  assert.match(setup, /role="dialog" aria-modal="true"/)
  assert.match(setup, /onViewSeller/)
  assert.match(setup, /Export Results/)
  assert.match(page, /setShowSellerSetupCheck\(false\)[\s\S]*setSelectedMember/)
})


test('latest multiple-DM UI remains intact and the old header actions do not return', () => {
  const page = read('CLIENT/SYSTEM/src/pages/System/SellerGroupDetails.jsx')
  assert.match(page, /member\.role === 'division_manager' && Number\(member\.user_id\) === Number\(group\.headUserId\)/)
  assert.match(page, /Network Head/)
  assert.match(page, /member\.role === 'division_manager' \|\| Number\(member\.user_id\)/)
  assert.doesNotMatch(page, /onClick=\{\(\) => setShowMemberImport\(true\)\}/)
  assert.doesNotMatch(page, /onClick=\{\(\) => setShowImportHistory\(true\)\}/)
  assert.equal((page.match(/<SellerSetupCheck\b/g) || []).length, 1)
})

