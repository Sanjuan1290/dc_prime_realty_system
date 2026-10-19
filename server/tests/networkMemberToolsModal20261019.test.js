import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name) => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8')

test('member tools are consolidated and remain permission-gated', () => {
  const page = read('client/src/pages/System/SellerGroupDetails.jsx')
  const modal = read('client/src/components/System/sellerGroupComponents/NetworkMemberToolsModal.jsx')
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
  const page = read('client/src/pages/System/SellerGroupDetails.jsx')
  const setup = read('client/src/components/System/sellerGroupComponents/SellerSetupCheck.jsx')
  assert.match(page, /<FiClock\/> Replacement History/)
  assert.doesNotMatch(page, /<FiRotateCcw\/> Replacement History/)
  assert.match(setup, /createPortal/)
  assert.match(setup, /role="dialog" aria-modal="true"/)
  assert.match(setup, /onViewSeller/)
  assert.match(setup, /Export Results/)
  assert.match(page, /setShowSellerSetupCheck\(false\)[\s\S]*setSelectedMember/)
})
