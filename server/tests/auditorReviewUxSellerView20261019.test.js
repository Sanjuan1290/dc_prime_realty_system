import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = path => readFileSync(resolve(root, path), 'utf8')

test('Auditor queue uses readable pending statuses and restrained colors without changing workflow status keys', () => {
  const source = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(source, /Awaiting Auditor Review/)
  assert.match(source, /Awaiting Department Head Review/)
  assert.match(source, /Correction Ready for Recheck/)
  assert.match(source, /Needs My Review/)
  assert.match(source, /Unread Notifications/)
  assert.doesNotMatch(source, /bg-violet-50 text-violet-700 border-violet-200/)
  assert.match(source, /reviewStatusLabel\(row.status\)/)
})

test('Review Details explains task and action, never assumes unavailable means deleted', () => {
  const source = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(source, /reviewTaskGuidance/)
  assert.match(source, /What you need to check/)
  assert.match(source, /Review Decision/)
  assert.match(source, /Change already saved/)
  assert.match(source, /This does not necessarily mean the record was deleted/)
  assert.match(source, /Report an Issue/)
  assert.match(source, /How this review works/)
  assert.match(source, /review-changes/)
  assert.match(source, /review-history/)
})

test('Review history defaults to the full saved form and keeps changed fields optional', () => {
  const comparison = read('client/src/components/Shared/ReviewFormComparison.jsx')
  const diff = read('client/src/components/Shared/ReviewSnapshotDiff.jsx')
  assert.match(comparison, /useState\('forms'\)/)
  assert.match(comparison, /Full Form Comparison/)
  assert.match(comparison, /Changed Fields Only/)
  assert.match(comparison, /mode==='forms'/)
  assert.match(comparison, /mode==='changes'\s*\?\s*<ReviewSnapshotDiff/)
  assert.match(comparison, /Not Recorded/)
  assert.match(comparison, /Not Set/)
  assert.match(comparison, /They have not been filled in from live data/)
  assert.match(diff, /No earlier values were saved/)
  assert.doesNotMatch(diff, /This record was newly created, so there are no earlier values/)
})

test('Accredited Sellers includes View for every row with safe internal destinations and preserved filters', () => {
  const directory = read('client/src/pages/System/Accredited.jsx')
  const app = read('client/src/App.jsx')
  assert.match(directory, /aria-label={`View seller/)
  assert.match(directory, /directoryReturnQuery/)
  assert.match(directory, /accredited\/sellers\/\$\{seller.accredited_seller_id\}/)
  assert.match(directory, /accredited\/groups\/in-house/)
  assert.match(app, /accredited\/sellers\/:sellerId.*SYSTEM_ACCREDITED_VIEW/)
  assert.match(app, /members\/:memberId.*SYSTEM_ACCREDITED_VIEW/)
})

test('Read-only seller endpoints are protected by accredited view, exclude dummy accounts and do not return financial records', () => {
  const router = read('server/routers/System/accredited.routers.js')
  const ctrl = read('server/controllers/System/accredited.controller.js')
  const profile = read('client/src/pages/System/InHouseMemberProfile.jsx')
  for (const path of ['/groups/:groupId/member-directory', '/sellers/:sellerId/profile']) {
    assert.ok(router.includes(`router.get('${path}', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW)`), path)
  }
  assert.match(ctrl, /getAccreditedNetworkMemberDirectory/)
  assert.match(ctrl, /getAccreditedSellerDirectoryProfile/)
  assert.match(ctrl, /COALESCE\(a.is_system_dummy, 0\) = 0/)
  assert.match(profile, /fetchJson\(`\/accredited\/groups\/\$\{groupId\}\/member-directory`\)/)
  assert.match(profile, /Back to Accredited Sellers/)
  assert.doesNotMatch(read('client/src/pages/System/AccreditedSellerProfile.jsx'), /useFetchPost|useFetchPatch|useMutation/)
})
