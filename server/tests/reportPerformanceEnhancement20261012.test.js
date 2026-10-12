import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildPerformanceRankings, loadProjectPerformance } from '../controllers/Lot_Projects/Dashboard/reportPerformance.service.js'
import { mergePerformance, rankPerformance, exportPerformanceCsv } from '../../client/src/utils/reportPerformance.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')

const sale = (account_id, seller_id, group_id, group_type, value = 780000) => ({ account_id, seller_id, seller_name: `Seller ${seller_id}`, group_id, group_name: `Network ${group_id}`, group_type, sale_amount: value, cash_collected: 221600 })
const earned = (seller_id, group_id, group_type, gross) => ({ seller_id, seller_name: `Seller ${seller_id}`, group_id, group_name: `Network ${group_id}`, group_type, gross_commission: gross, released_commission: gross / 5, remaining_commission: gross * .8, eligible_commission: gross / 5 })

test('one buyer account counts once for originating seller and network even with four earners', () => {
  const result = buildPerformanceRankings({ sales: [sale(30001,4,8,'in_house'), sale(30001,4,8,'in_house')], commissions: [earned(4,8,'in_house',31200),earned(5,8,'in_house',12480),earned(6,8,'in_house',9870),earned(7,8,'in_house',8850)] })
  assert.equal(result.groupPerformance.length, 1)
  assert.equal(result.groupPerformance[0].units, 1)
  assert.equal(result.groupPerformance[0].salesAmount, 780000)
  assert.equal(result.sellerPerformance.reduce((total, seller) => total+seller.units, 0), 1)
  assert.equal(result.sellerPerformance.length, 4)
  assert.equal(result.sellerPerformance.find((r) => r.id === 5).grossCommission, 12480)
  assert.equal(result.sellerPerformance.find((r) => r.id === 5).salesAmount, 0)
})

test('two different buyer accounts from a resold unit still count as two sales', () => {
  const result = buildPerformanceRankings({ sales: [sale(30001,4,8,'in_house'), sale(30002,4,8,'in_house',850000)] })
  assert.equal(result.groupPerformance[0].units, 2)
  assert.equal(result.groupPerformance[0].salesAmount, 1630000)
})

test('in-house company profit and external network commission are not conflated', () => {
  const result = buildPerformanceRankings({
    sales: [sale(30001,4,8,'in_house'),sale(30002,12,9,'external',800000)],
    commissions: [earned(4,8,'in_house',31200), earned(12,9,'external',64000)],
    profits: [{group_id:8, group_name:'Network 8',group_type:'in_house',gross_profit:7800,released_profit:1560,remaining_profit:6240}],
  })
  const inHouse = result.groupPerformance.find((r) => r.id === 8)
  const external = result.groupPerformance.find((r) => r.id === 9)
  assert.equal(inHouse.companyProfit, 7800)
  assert.equal(inHouse.grossCommission, 7800)
  assert.equal(inHouse.releasedCommission, 1560)
  assert.equal(external.companyProfit, 0)
  assert.equal(external.grossCommission, 64000)
  assert.equal(external.releasedCommission, 12800)
})

test('system aggregation joins stable IDs across projects without mixing networks and sellers', () => {
  const a = buildPerformanceRankings({ sales: [sale(30001,4,8,'in_house')], profits: [{group_id:8,group_type:'in_house',gross_profit:7800}] })
  const b = buildPerformanceRankings({ sales: [sale(30002,4,8,'in_house',500000),sale(30003,12,9,'external',900000)] })
  const projects = [{id:1,name:'Project A',...a},{id:2,name:'Project B',...b}]
  const combinedNetworks = mergePerformance(projects,'groupPerformance')
  const combinedSellers = mergePerformance(projects,'sellerPerformance')
  assert.equal(combinedNetworks.length,2)
  const net = combinedNetworks.find((r)=>r.id===8)
  assert.equal(net.units,2)
  assert.equal(net.projectCount,2)
  assert.equal(net.salesAmount,1280000)
  assert.equal(combinedSellers.find((r)=>r.id===4).units,2)
  assert.equal(rankPerformance(combinedNetworks,{networkType:'external'}).length,1)
  assert.equal(rankPerformance(combinedNetworks,{metric:'units'})[0].id,8)
})

test('CSV escaping and filtering do not add duplicate payouts', () => {
  const row={id:1,group:'Agency, "Corp"',groupType:'external',units:1,salesAmount:123,projectCount:1}
  const csv=exportPerformanceCsv([row],'network')
  assert.match(csv,/"Agency, ""Corp"""/)
  assert.match(csv,/"123"/)
  assert.equal(rankPerformance([row],{networkType:'in_house'}).length,0)
})

test('project performance SQL uses the exact buyer account, sale origin, type, project and dates', async () => {
  const queries=[]
  const connection={query:async (sql,params)=>{queries.push({sql,params});return [[]]}}
  await loadProjectPerformance(connection,17,'2026-10-01','2026-10-31',{hasProfit:true})
  assert.equal(queries.length,3)
  assert.match(queries[0].sql,/a\.lot_project_account_id AS account_id/)
  assert.match(queries[0].sql,/sale_origin_accredited_seller_id/)
  assert.match(queries[0].sql,/lot_project_payment_status = 'Verified'/)
  assert.match(queries[0].sql,/a\.lot_project_id = \?/)
  assert.match(queries[0].sql,/a\.account_status IN \('active','pending_cancellation','closed_fully_paid'\)/)
  assert.match(queries[1].sql,/lot_project_commission_releases/)
  assert.match(queries[2].sql,/lot_project_network_profit_accounts/)
  for(const query of queries){assert.ok(query.params.includes(17));assert.ok(query.params.includes('2026-10-01'));assert.ok(query.params.includes('2026-10-31'))}
})

test('Lot and System Reports use one shared leaderboard and preserve every protected financial KPI', () => {
  const lot=read('client/src/pages/Lot_Projects/Reports.jsx')
  const system=read('client/src/pages/System/Reports.jsx')
  const component=read('client/src/components/Reports/PerformanceLeaderboard.jsx')
  const dashboard=read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
  assert.match(lot,/PerformanceLeaderboard sellers=\{sellerPerformance\}/)
  assert.match(system,/PerformanceLeaderboard sellers=\{crossProjectSellers\}/)
  assert.doesNotMatch(lot,/Network Sales Comparison/)
  assert.match(system,/mergePerformance\(projectReports, 'sellerPerformance'\)/)
  assert.match(component,/Company \/ Network/)
  assert.match(component,/In-House/)
  assert.match(component,/External/)
  assert.match(component,/Export Performance CSV/)
  assert.match(dashboard,/sellerPerformance: rankings\.sellerPerformance/)
  for(const metric of ['Total Gross Sales','Cash Collected','Penalty Summary','Cash Collectibles − Discount','Total Number of Reservations','Total Net Sales','Pending Cancellations','Finalized Cancellations','Refunded Amount','Discontinued Amount']) assert.ok(lot.includes(metric),metric)
  assert.match(system,/totalGrossSales: roundMoney|totalGrossSales/) // existing formula untouched
  assert.match(dashboard,/totalGrossSales: totalSales/)
})

test('performance loader maps project-scoped source rows into independent ledgers', async () => {
  const dataset=[
    [sale(30001,4,8,'in_house'), sale(30002,12,9,'external',960000)],
    [earned(4,8,'in_house',31200),earned(5,8,'in_house',12480),earned(12,9,'external',72000)],
    [{group_id:8,group_name:'Network 8', group_type:'in_house',payee_name:'Saved Realty',gross_profit:7800,eligible_profit:1560,released_profit:1560,remaining_profit:6240}],
  ]
  const queries=[]
  const connection={query: async (sql,params)=>{queries.push({sql,params});return [dataset[queries.length-1]]}}
  const result=await loadProjectPerformance(connection,1,'2026-10-01','2026-10-31')
  assert.equal(result.groupPerformance.length,2)
  assert.equal(result.groupPerformance.find((r)=>r.id===8).payee,'Saved Realty')
  assert.equal(result.groupPerformance.find((r)=>r.id===8).grossCommission,7800)
  assert.equal(result.groupPerformance.find((r)=>r.id===9).grossCommission,72000)
  assert.equal(result.sellerPerformance.filter((r)=>r.units>0).length,2)
  assert.equal(result.sellerPerformance.find((r)=>r.id===5).units,0)
  assert.ok(queries.every((r)=>r.params.includes(1)))
})

test('older schemas can report seller and external network data without profit tables', async () => {
  let calls=0
  const connection={query:async()=>{calls++;return [[]]}}
  const data=await loadProjectPerformance(connection,1,'2026-10-01','2026-10-31',{hasProfit:false})
  assert.equal(calls,2)
  assert.deepEqual(data,{sellerPerformance:[],groupPerformance:[]})
})

test('CSV quoting neutralizes spreadsheet formulas and preserves network names', () => {
  const csv=exportPerformanceCsv([{id:1,group:'=1+1',groupType:'external',units:1,salesAmount:1}], 'network')
  assert.match(csv,/"'=1\+1"/)
})

test('overdue aging is current-state and main financial snapshot formulas remain untouched', () => {
  const dashboard=read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
  const insights=read('client/src/components/Reports/ReportPerformanceInsights.jsx')
  const system=read('client/src/pages/System/Reports.jsx')
  const lot=read('client/src/pages/Lot_Projects/Reports.jsx')
  assert.match(dashboard,/const \[agingRows\] = hasSchedules/)
  assert.match(dashboard,/getLatestActiveScheduleGenerationPredicate\('s'\)/)
  assert.match(dashboard,/overdueAging: currentOverdueAging/)
  assert.match(insights,/Current Overdue Aging/)
  assert.match(insights,/not historical balances reconstructed/)
  assert.match(insights,/In-House Company Profit/)
  assert.match(insights,/External Network Commission/)
  assert.match(system,/ReportPerformanceInsights stats=\{summary\}/)
  assert.match(lot,/ReportPerformanceInsights stats=\{stats\}/)
  assert.match(dashboard,/totalGrossSales: totalSales/)
})

test('detailed report export follows the same granular role permissions as existing reports', () => {
  const system=read('client/src/pages/System/Reports.jsx')
  const lot=read('client/src/pages/Lot_Projects/Reports.jsx')
  assert.match(system,/allowExport=\{canExport\}/)
  assert.match(system,/PERMISSIONS\.SYSTEM_REPORTS_EXPORT/)
  assert.match(lot,/PERMISSIONS\.LOT_REPORTS_EXPORT/)
  assert.match(lot,/allowExport=\{canExportPerformance\}/)
})


test('performance exports write audit logs and preserve project scope and granular permissions', () => {
  const router=read('server/routers/System/projects.routers.js')
  const controller=read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
  const system=read('server/controllers/System/reports.controller.js')
  const guard=read('client/src/utils/apiClient.js')
  const leaderboard=read('client/src/components/Reports/PerformanceLeaderboard.jsx')
  const systemReports=read('client/src/pages/System/Reports.jsx')
  const lotReports=read('client/src/pages/Lot_Projects/Reports.jsx')
  assert.match(router,/router.param\('projectSlug', requireProjectAccessBySlug\)/)
  assert.match(router,/performance-export-audit', requirePermission\(PERMISSIONS\.LOT_REPORTS_EXPORT\), auditLotProjectPerformanceExport/)
  assert.match(router,/router.post\('\/reports\/export-audit', requirePermission\(PERMISSIONS\.SYSTEM_REPORTS_EXPORT\)/)
  assert.match(controller,/export const auditLotProjectPerformanceExport/)
  assert.match(controller,/writeAuditLog\(connection, req/)
  assert.match(system,/isPerformanceCsv \? 'Exported performance rankings to CSV'/)
  assert.match(guard,/performance-export-audit\$\/i/)
  assert.match(leaderboard,/if \(onBeforeExport\) await onBeforeExport/)
  assert.match(systemReports,/reportType: 'performance_csv'/)
  assert.match(lotReports,/performance-export-audit/)
})
