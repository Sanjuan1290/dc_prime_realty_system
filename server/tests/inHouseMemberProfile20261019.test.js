import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { getMemberReportingView } from '../../client/src/utils/memberReportingTree.js'

const people = [
  { user_id: 1, role: 'division_manager', full_name: 'Head DM', reports_under_user_id: null, user_status: 'active', accredited_seller_status: 'active' },
  { user_id: 2, role: 'sales_director', full_name: 'SD', reports_under_user_id: 1, user_status: 'active', accredited_seller_status: 'active' },
  { user_id: 3, role: 'unit_manager', full_name: 'UM', reports_under_user_id: 2, user_status: 'inactive', accredited_seller_status: 'inactive' },
  { user_id: 4, role: 'sales_agent', full_name: 'SA', reports_under_user_id: 3, user_status: 'active', accredited_seller_status: 'active' },
  { user_id: 5, role: 'division_manager', full_name: 'Second DM', reports_under_user_id: null, user_status: 'active', accredited_seller_status: 'active' },
  { user_id: 6, role: 'sales_director', full_name: 'Second SD', reports_under_user_id: 5, user_status: 'active', accredited_seller_status: 'active' },
  { user_id: 7, role: 'sales_agent', is_system_dummy: 1, reports_under_user_id: 3 },
]

test('read-only profile reports direct members, full downstream team, and correct management chain', () => {
  const result = getMemberReportingView(people, 2)
  assert.equal(result.parent.user_id, 1)
  assert.deepEqual(result.chain.map(row => row.user_id), [1])
  assert.deepEqual(result.direct.map(row => row.user_id), [3])
  assert.deepEqual(result.descendants.map(row => [row.user_id, row.reportingDepth]), [[3, 1], [4, 2]])
  assert.equal(result.descendants[0].user_status, 'inactive')
  assert.equal(result.incomplete, false)
})

test('independent Division Managers have separate teams and no forced Head parent', () => {
  const result = getMemberReportingView(people, 5)
  assert.equal(result.parent, null)
  assert.deepEqual(result.descendants.map(row => row.user_id), [6])
  assert.deepEqual(result.chain, [])
})

test('no data from outside the supplied Network and no system dummy appears', () => {
  assert.equal(getMemberReportingView(people, 999).selected, null)
  assert.deepEqual(getMemberReportingView(people, 3).descendants.map(row => row.user_id), [4])
})

test('invalid cycles and orphan chains terminate safely', () => {
  const cycle = [{ user_id: 10, reports_under_user_id: 11 }, { user_id: 11, reports_under_user_id: 10 }]
  const result = getMemberReportingView(cycle, 10)
  assert.equal(result.incomplete, true)
  assert.deepEqual(result.descendants.map(row => row.user_id), [11])
  const orphan = getMemberReportingView([{ user_id: 1, reports_under_user_id: 99 }], 1)
  assert.equal(orphan.incomplete, true)
})

test('new member View page is permission gated, scoped to the Network, and leaves Edit/Replace intact', async () => {
  const app = await fs.readFile(new URL('../../client/src/App.jsx', import.meta.url), 'utf8')
  const list = await fs.readFile(new URL('../../client/src/pages/System/SellerGroupDetails.jsx', import.meta.url), 'utf8')
  const page = await fs.readFile(new URL('../../client/src/pages/System/InHouseMemberProfile.jsx', import.meta.url), 'utf8')
  const api = await fs.readFile(new URL('../controllers/System/sellerGroup.controller.js', import.meta.url), 'utf8')
  const modal = await fs.readFile(new URL('../../client/src/components/System/sellerGroupComponents/ReplaceManagerModal.jsx', import.meta.url), 'utf8')
  assert.match(app, /accredited\/groups\/in-house\/:groupId\/members\/:memberId.*SYSTEM_SELLER_GROUPS_VIEW/)
  assert.match(list, /aria-label={`View details for/)
  assert.match(list, /Edit Seller/)
  assert.match(list, /Replace Manager/)
  assert.match(page, /fetchJson\(`\/seller-groups\/\$\{groupId\}`\)/)
  assert.match(page, /No team members match these filters/)
  assert.match(api, /u\.address, u\.account_code, u\.can_login/)
  assert.doesNotMatch(modal, /Create a New Manager|onCreateManager/)
})
