import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildPerformanceRankings, loadProjectPerformance } from '../controllers/Lot_Projects/Dashboard/reportPerformance.service.js'
import { includeUnrankedSellers, mergePerformance, rankPerformance } from '../../../CLIENT/SYSTEM/src/utils/reportPerformance.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
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

test('Network filter separates In-House and External rows', () => {
  const rows = [{ id: 1, group:'Internal', groupType:'in_house', units:2 }, { id:2, group:'External', groupType:'external', units:1 }]
  assert.deepEqual(rankPerformance(rows,{networkType:'in_house'}).map((row)=>row.id),[1])
  assert.deepEqual(rankPerformance(rows,{networkType:'external'}).map((row)=>row.id),[2])
})

test('project performance SQL uses the exact buyer account, sale origin, type, project and dates', async () => {
  const queries=[]
  const connection={query:async (sql,params)=>{queries.push({sql,params});return [[]]}}
  await loadProjectPerformance(connection,17,'2026-10-01','2026-10-31',{hasProfit:true})
  assert.equal(queries.length,4)
  assert.match(queries[0].sql,/a\.lot_project_account_id AS account_id/)
  assert.match(queries[0].sql,/sale_origin_accredited_seller_id/)
  assert.match(queries[0].sql,/lot_project_payment_status = 'Verified'/)
  assert.match(queries[0].sql,/a\.lot_project_id = \?/)
  assert.match(queries[0].sql,/a\.account_status IN \('active','pending_cancellation','closed_fully_paid'\)/)
  assert.match(queries[1].sql,/lot_project_commission_releases/)
  assert.match(queries[2].sql,/lot_project_network_profit_accounts/)
  assert.match(queries[3].sql,/FROM accredited_sellers s/);
  assert.match(queries[3].sql,/COALESCE\(s.is_system_dummy, 0\) = 0/);
  assert.match(queries[3].sql,/seller_group_lot_project_rates/);
  assert.match(queries[3].sql,/accredited_seller_lot_project_rates/);
  assert.match(queries[3].sql,/lot_project_commissions/);
  assert.deepEqual(queries[3].params, [17,17,17]);
  for(const query of queries.slice(0,3)){assert.ok(query.params.includes(17));assert.ok(query.params.includes('2026-10-01'));assert.ok(query.params.includes('2026-10-31'))}
})

test('only Seller Performance Details changes; original Lot charts and financial cards remain', () => {
  const lot = read('CLIENT/SYSTEM/src/pages/Lot_Projects/Reports.jsx')
  const system = read('CLIENT/SYSTEM/src/pages/System/Reports.jsx')
  const component = read('CLIENT/SYSTEM/src/components/Reports/PerformanceLeaderboard.jsx')
  const dashboard = read('SERVER/SYSTEM/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
  assert.match(lot,/PerformanceLeaderboard/)
  assert.match(system,/PerformanceLeaderboard sellers=\{crossProjectSellers\}/)
  assert.match(lot,/Network Sales Comparison/)
  assert.match(lot,/groupChartData = buildBreakdownChartData\(groupPerformance, 'group'\)/)
  for (const label of ['Sales and Settlement Trend','Commission Comparison','Inventory Value Comparison','Unit Status Mix','Recent Unit Records']) assert.ok(lot.includes(label), label)
  assert.match(component,/Seller Performance Details/)
  assert.match(component,/Company \/ Network/)
  assert.match(component,/In-House/)
  assert.match(component,/External/)
  assert.match(component,/Seller Role/)
  assert.match(dashboard,/sellerPerformance: sellerRows\.map/)
  assert.match(dashboard,/groupPerformance: groupRows\.map/)
  assert.match(dashboard,/performanceRankings,/)
  assert.match(lot,/performanceRankings\?\.sellerPerformance/)
  assert.match(system,/dashboard\.performanceRankings\?\.groupPerformance/)
  for (const metric of ['Total Gross Sales','Cash Collected','Penalty Summary','Cash Collectibles − Discount','Total Number of Reservations','Total Net Sales','Pending Cancellations','Finalized Cancellations','Refunded Amount','Discontinued Amount']) {
    assert.ok(lot.includes(metric),metric)
    assert.ok(system.includes(metric),metric)
  }
  assert.match(dashboard,/totalGrossSales: totalSales/)
  assert.doesNotMatch(lot,/ReportPerformanceInsights|overdueAging|performance-export-audit/)
  assert.doesNotMatch(system,/ReportPerformanceInsights|performance_csv/)
  assert.doesNotMatch(component,/Export Performance CSV/)
})

test('performance loader maps project-scoped source rows into independent ledgers', async () => {
  const dataset=[
    [sale(30001,4,8,'in_house'), sale(30002,12,9,'external',960000)],
    [earned(4,8,'in_house',31200),earned(5,8,'in_house',12480),earned(12,9,'external',72000)],
    [{group_id:8,group_name:'Network 8', group_type:'in_house',payee_name:'Saved Realty',gross_profit:7800,eligible_profit:1560,released_profit:1560,remaining_profit:6240}],
    [{seller_id:4,seller_name:'Seller 4',seller_role:'sales_agent',seller_status:'active',group_id:8,group_name:'Network 8',group_type:'in_house'}, {seller_id:50,seller_name:'New Seller',seller_role:'sales_agent',seller_status:'active',group_id:8,group_name:'Network 8',group_type:'in_house'}],
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
  assert.equal(result.sellerPerformance.find((r)=>r.id===50).units,0)
  assert.equal(result.sellerPerformance.find((r)=>r.id===50).grossCommission,0)
  assert.ok(queries.every((r)=>r.params.includes(1)))
})

test('older schemas can report seller and external network data without profit tables', async () => {
  let calls=0
  const connection={query:async()=>{calls++;return [[]]}}
  const data=await loadProjectPerformance(connection,1,'2026-10-01','2026-10-31',{hasProfit:false})
  assert.equal(calls,3)
  assert.deepEqual(data,{sellerPerformance:[],groupPerformance:[]})
})

test('ranking does not mutate unrelated financial KPI input', () => {
  const original = [{id:1, group:'Internal', groupType:'in_house',units:1,salesAmount:50000}]
  assert.equal(rankPerformance(original,{metric:'salesAmount'})[0].salesAmount,50000)
})

test('the separate performance dataset is read only and cannot replace original chart series', () => {
  const dashboard=read('SERVER/SYSTEM/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
  const lot=read('CLIENT/SYSTEM/src/pages/Lot_Projects/Reports.jsx')
  assert.match(dashboard,/const performanceRankings = hasCommissions/)
  assert.match(dashboard,/sellerPerformance: sellerRows\.map/)
  assert.match(dashboard,/groupPerformance: groupRows\.map/)
  assert.match(lot,/const groupPerformance = data\?\.data\?\.groupPerformance/)
  assert.match(lot,/networks=\{data\?\.data\?\.performanceRankings\?\.groupPerformance/)
})

test('performance details retain search, sort, filters, pagination and project breakdown', () => {
  const component = read('CLIENT/SYSTEM/src/components/Reports/PerformanceLeaderboard.jsx')
  for (const label of ['Search performance','Network Type','Rank By','Rows per page','Seller Role','Project breakdown','Details']) assert.ok(component.includes(label),label)
  assert.doesNotMatch(component,/Export Performance CSV/)
})

test('existing PDF export remains unchanged and no detailed performance CSV endpoint remains', () => {
  const system = read('CLIENT/SYSTEM/src/pages/System/Reports.jsx')
  const router = read('SERVER/SYSTEM/routers/System/projects.routers.js')
  const controller = read('SERVER/SYSTEM/controllers/System/reports.controller.js')
  assert.match(system,/Export Management Summary/)
  assert.doesNotMatch(system,/performance_csv|handlePerformanceExport/)
  assert.doesNotMatch(router,/performance-export-audit/)
  assert.doesNotMatch(controller,/isPerformanceCsv/)
})


test('no-sale roster sellers appear as zero-valued rows after performers', () => {
  const roster = [
    {seller_id:8,seller_name:'Brand New Seller',seller_role:'sales_agent',seller_status:'active',group_id:10,group_name:'North Star',group_type:'in_house'},
    {seller_id:9,seller_name:'Inactive Seller',seller_role:'unit_manager',seller_status:'inactive',group_id:10,group_name:'North Star',group_type:'in_house'},
    {seller_id:9,seller_name:'Inactive Seller',seller_role:'unit_manager',seller_status:'inactive',group_id:10,group_name:'North Star',group_type:'in_house'},
  ]
  const ranked = buildPerformanceRankings({ roster, sales:[sale(30001,4,10,'in_house')] })
  assert.equal(ranked.sellerPerformance.length,3)
  assert.equal(ranked.sellerPerformance[0].id,4)
  assert.equal(ranked.sellerPerformance[1].units,0)
  assert.equal(ranked.sellerPerformance[1].grossCommission,0)
  assert.equal(ranked.sellerPerformance.find((r)=>r.id===9).status,'inactive')
  assert.equal(ranked.groupPerformance.length,1) // A no-sale seller must not create a sale or Network earnings.
  assert.deepEqual(rankPerformance(ranked.sellerPerformance, {role:'unit_manager'}).map(r=>r.id),[9])
})

test('System Reports fills unassigned and zero-sale seller directory without duplicating active performers', () => {
  const projectRows=mergePerformance([{id:17,name:'Bailen',sellerPerformance:buildPerformanceRankings({ sales:[sale(30001,4,8,'in_house')] }).sellerPerformance}],'sellerPerformance')
  const all=includeUnrankedSellers(projectRows,[
    {id:4,seller:'Seller 4',role:'sales_agent',groupType:'in_house'},
    {id:21,seller:'New No Project Seller',role:'sales_agent',group:'-',status:'active'},
    {id:22,seller:'Archived Seller',role:'unit_manager',group:'Old Realty',status:'inactive'},
  ])
  assert.equal(all.length,3)
  assert.equal(all.find(r=>r.id===4).units,1)
  assert.equal(all.find(r=>r.id===4).projectCount,1)
  assert.equal(all.find(r=>r.id===21).units,0)
  assert.equal(all.find(r=>r.id===21).projectCount,0)
  assert.deepEqual(all.find(r=>r.id===21).projects,[])
  assert.equal(all.find(r=>r.id===22).status,'inactive')
  assert.equal(rankPerformance(all,{metric:'salesAmount'}).at(-1).salesAmount,0)
})

test('report-only seller directory endpoint enforces report permission and project visibility', () => {
  const router=read('SERVER/SYSTEM/routers/System/projects.routers.js')
  const controller=read('SERVER/SYSTEM/controllers/System/reports.controller.js')
  const performance=read('SERVER/SYSTEM/controllers/Lot_Projects/Dashboard/reportPerformance.service.js')
  const system=read('CLIENT/SYSTEM/src/pages/System/Reports.jsx')
  const component=read('CLIENT/SYSTEM/src/components/Reports/PerformanceLeaderboard.jsx')
  assert.match(router,/reports\/seller-roster', requirePermission\(PERMISSIONS.SYSTEM_REPORTS_VIEW\)/)
  assert.match(controller,/getAccessibleProjectIds\(req.authUser, connection\)/)
  assert.match(controller,/COALESCE\(s.is_system_dummy, 0\) = 0/)
  assert.match(controller,/AND gr.lot_project_id IN/)
  assert.match(performance,/seller_group_lot_project_rate_status = 'active'/)
  assert.match(performance,/accredited_seller_lot_project_rate_status = 'active'/)
  assert.match(performance,/c.accredited_seller_id = s.accredited_seller_id/)
  assert.match(system,/includeUnrankedSellers/)
  assert.match(component,/No sales in period/)
  assert.match(component,/accredited sellers ranked/)
  assert.match(component,/rosterError/)
  assert.match(system,/rosterError=\{shouldLoadLotProjects && sellerRosterQuery.isError\}/)
})


