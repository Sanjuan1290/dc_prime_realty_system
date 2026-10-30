import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { groupCommissionRecords, includeCompanyProfitInCommissionGroups } from '../../../CLIENT/SYSTEM/src/utils/commissionRecords.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p) => readFileSync(path.join(root, p), 'utf8')
const page = read('CLIENT/SYSTEM/src/pages/Lot_Projects/Commission.jsx')
const sellers = [
  { id: 1, commissionId: 1, accountId: 10, unit: 'LA-1806', seller: 'DM', sellerGroup: 'North Star Network', grossCommission: 11060.40, released: 2212.08, eligibleToRelease: 0, netRemaining: 8848.32 },
  { id: 2, commissionId: 2, accountId: 10, unit: 'LA-1806', seller: 'SD', sellerGroup: 'North Star Network', grossCommission: 12339.60, released: 2467.92, eligibleToRelease: 0, netRemaining: 9871.68 },
  { id: 3, commissionId: 3, accountId: 10, unit: 'LA-1806', seller: 'UM', sellerGroup: 'North Star Network', grossCommission: 15600, released: 3120, eligibleToRelease: 0, netRemaining: 12480 },
  { id: 4, commissionId: 4, accountId: 10, unit: 'LA-1806', seller: 'SA', sellerGroup: 'North Star Network', grossCommission: 23400, released: 4680, eligibleToRelease: 0, netRemaining: 18720 },
]
const profit = { id: 81, accountId: 10, totalProfit: 7800, released: 1560, remaining: 6240,
  stages: [
    { id: 1, status: 'Released', amount: 1560, canRelease: false },
    { id: 2, status: 'Pending', amount: 1560, canRelease: false },
    { id: 3, status: 'Pending', amount: 1560, canRelease: false },
    { id: 4, status: 'Pending', amount: 1170, canRelease: false },
    { id: 5, status: 'Pending', amount: 1950, canRelease: false },
  ] }

test('LA-1806 combines four seller roles + Company Profit without turning profit into seller row', () => {
  const sellerOnly = groupCommissionRecords(sellers)
  assert.equal(sellerOnly[0].grossCommission, 62400)
  assert.equal(sellerOnly[0].released, 12480)
  const [total] = includeCompanyProfitInCommissionGroups(sellerOnly, [profit])
  assert.equal(total.sellerCount, 4)
  assert.equal(total.sellers.length, 4)
  assert.equal(total.sellerGrossCommission, 62400)
  assert.equal(total.companyProfitGross, 7800)
  assert.equal(total.grossCommission, 70200)
  assert.equal(total.eligibleToRelease, 0)
  assert.equal(total.released, 14040)
  assert.equal(total.netRemaining, 56160)
  assert.deepEqual(sellerOnly[0].sellers, total.sellers)
  assert.equal(sellerOnly[0].grossCommission, 62400, 'source seller aggregate is unchanged')
})

test('Company Profit matches only exact account ID; ignores duplicate profit records and repeated unit IDs', () => {
  const otherSeller = { ...sellers[0], id: 11, commissionId: 11, accountId: 20, grossCommission: 2000, released: 0, netRemaining: 2000 }
  const groups = groupCommissionRecords([...sellers, otherSeller])
  const totals = includeCompanyProfitInCommissionGroups(groups, [profit, profit, { ...profit, id: 82, accountId: 999, totalProfit: 100000 }])
  assert.equal(totals.length, 2)
  assert.equal(totals.find(x => x.accountId === 10).grossCommission, 70200)
  assert.equal(totals.find(x => x.accountId === 20).grossCommission, 2000)
  assert.equal(totals.find(x => x.accountId === 20).companyProfitGross, 0)
})

test('only currently releasable pending Company Profit stages count toward Eligible', () => {
  const [group] = includeCompanyProfitInCommissionGroups(groupCommissionRecords(sellers), [{...profit, stages: [
    { status: 'Released', canRelease: true, amount: 1560 },
    { status: 'Pending', canRelease: true, amount: 1560 },
    { status: 'Pending', canRelease: false, amount: 1560 },
    { status: 'On Hold', canRelease: true, amount: 1170 },
  ]}])
  assert.equal(group.eligibleToRelease, 1560)
})

test('decimal amounts use integer cents without floating point drift', () => {
  const result = includeCompanyProfitInCommissionGroups(groupCommissionRecords([{...sellers[0], grossCommission: 0.1, released: 0, netRemaining: 0.1 }]), [
    { ...profit, totalProfit: 0.2, released: 0.1, stages: [] },
  ])[0]
  assert.equal(result.grossCommission, 0.3)
  assert.equal(result.released, 0.1)
  assert.equal(result.netRemaining, 0.2)
})

test('Commission page shares cached profit query, displays combined totals in cards, desktop and mobile', () => {
  assert.match(page, /queryKey: \['network-company-profit', projectSlug\]/)
  assert.match(page, /includeCompanyProfitInCommissionGroups\(groupCommissionRecords\(records\), profitData\?\.data\)/)
  assert.match(page, /Totals include seller commissions and separately tracked Network Company Profit/)
  assert.match(page, /Includes \{money\(record\.companyProfitGross\)\} Company Profit/)
  assert.match(page, /totalsLoading \|\| totalsError \? '—'/)
  assert.match(page, /refetchProfit\(\)/)
})

