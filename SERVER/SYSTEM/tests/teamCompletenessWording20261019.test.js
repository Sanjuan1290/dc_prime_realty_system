import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSellerTeamCompleteness } from '../services/sellerTeamCompleteness.service.js'
import { getTeamCompletenessLabel, getTeamCompletenessHint } from '../../../CLIENT/SYSTEM/src/utils/sellerTeamStatus.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = path => readFileSync(resolve(root, path), 'utf8')
const seller = (id, role, parent = null, active = true) => ({
  user_id: id, accredited_seller_id: id + 100, role,
  accredited_seller_reports_under_user_id: parent,
  user_status: active ? 'active' : 'inactive',
  accredited_seller_status: active ? 'active' : 'inactive',
})
const member = (assessment, id) => assessment.records.find(x => x.userId === id)
const base = [
  seller(1, 'division_manager'),
  seller(2, 'sales_director', 1),
  seller(3, 'unit_manager', 2),
  seller(4, 'sales_agent', 3),
]

test('fully staffed managers AND Sales Agents show Team Complete', () => {
  const report = buildSellerTeamCompleteness(base)
  for (const person of base) {
    const status = member(report, person.user_id)
    assert.equal(getTeamCompletenessLabel(status), 'Team Complete')
  }
  assert.match(getTeamCompletenessHint(member(report, 4)), /complete reporting chain/i)
})

test('realistic head with one incomplete UM is Team Below Incomplete, not Needs Assignment', () => {
  const report = buildSellerTeamCompleteness([...base, seller(5, 'unit_manager', 2)])
  assert.equal(getTeamCompletenessLabel(member(report, 1)), 'Team Below Incomplete')
  assert.equal(getTeamCompletenessLabel(member(report, 2)), 'Some Teams Incomplete')
  assert.equal(getTeamCompletenessLabel(member(report, 5)), 'No Sales Agents')
  assert.equal(getTeamCompletenessLabel(member(report, 3)), 'Team Complete')
  assert.equal(getTeamCompletenessLabel(member(report, 4)), 'Team Complete')
  assert.match(getTeamCompletenessHint(member(report, 1)), /report directly to the Developer/i)
})

test('no direct children gives role-specific wording', () => {
  for (const [members,id,expected] of [
    [[base[0]],1,'No Sales Directors'],
    [[base[0],base[1]],2,'No Unit Managers'],
    [base.slice(0,3),3,'No Sales Agents'],
  ]) assert.equal(getTeamCompletenessLabel(member(buildSellerTeamCompleteness(members), id)), expected)
})

test('an SA without its required parent shows Assignment Issue, not a team staffing warning', () => {
  const report = buildSellerTeamCompleteness([...base, seller(5, 'sales_agent', 12345)])
  assert.equal(getTeamCompletenessLabel(member(report, 5)), 'Assignment Issue')
  assert.equal(getTeamCompletenessLabel(member(report, 4)), 'Team Complete')
})

test('inactive seller remains Inactive and labels do not change the underlying status', () => {
  const report = buildSellerTeamCompleteness([...base.slice(0,3), seller(4, 'sales_agent', 3, false)])
  assert.equal(member(report, 4).status, 'inactive')
  assert.equal(getTeamCompletenessLabel(member(report, 4)), 'Inactive')
  assert.equal(member(report, 3).status, 'needs_assignment')
  assert.equal(getTeamCompletenessLabel(member(report, 3)), 'No Sales Agents')
})

test('table, setup check, CSV export and activation text use consistent wording', () => {
  const table = source('CLIENT/SYSTEM/src/pages/System/SellerGroupDetails.jsx')
  const setup = source('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/SellerSetupCheck.jsx')
  const activation = source('CLIENT/SYSTEM/src/components/System/userComponents/ReactivateSystemUserModal.jsx')
  for (const view of [table, setup]) {
    assert.match(view, /getTeamCompletenessLabel/)
    assert.match(view, /Team Completeness/)
    assert.doesNotMatch(view, /Needs Assignment/)
  }
  assert.match(setup, /'Team Completeness','Active Direct Reports'/)
  assert.match(setup, /getTeamCompletenessLabel\(r\.team, r\.role\)/)
  assert.match(table, /getTeamCompletenessHint\(team, member\.role\)/)
  assert.match(activation, /Team completeness notice/)
})

