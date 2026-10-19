import { sellerAuditRows } from '../../client/src/utils/sellerAuditHistory.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getAuditChanges, getAuditEvidenceCoverage, getAuditExtraFields, getAuditReferences, redactEvidence, safeAuditText } from '../../client/src/utils/auditReportEvidence.js'
import { PERMISSIONS, roleHasPermission } from '../config/permissions.js'
import { getExactAuditReferences, parseAuditReportFilters, redactReportMetadata } from '../utils/auditReportValidation.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (file) => fs.readFileSync(path.resolve(here, '../../',file),'utf8')

test('Audit Report routes require separate export permission; archived history has separate authority', () => {
  const route=read('server/routers/System/auditLogs.router.js')
  const controller=read('server/controllers/System/auditReport.controller.js')
  assert.match(route,/\/report\/data.*AUDIT_LOGS_EXPORT/)
  assert.match(route,/\/report\/cases.*AUDIT_LOGS_EXPORT/)
  assert.match(route,/\/report\/record.*AUDIT_LOGS_EXPORT/)
  assert.match(controller,/filters\.includeArchived && !roleHasPermission\(actor, PERMISSIONS\.AUDIT_LOGS_ARCHIVE\)/)
  assert.match(controller,/WHERE NOT EXISTS \(SELECT 1 FROM audit_logs active_log/)
  assert.match(controller,/al\.audit_log_id < \?/)
  assert.match(controller,/audit_log_id DESC LIMIT \?/)
  assert.match(controller,/PERMISSIONS.WORKFLOW_AUDIT_REVIEW/)
  assert.doesNotMatch(controller,/DELETE FROM audit_logs|UPDATE audit_logs SET/)
  assert.equal(roleHasPermission({role:'operations_staff',permissions:[PERMISSIONS.AUDIT_LOGS_VIEW]},PERMISSIONS.AUDIT_LOGS_EXPORT),false)
  assert.equal(roleHasPermission({role:'auditor',permissions:[PERMISSIONS.AUDIT_LOGS_EXPORT]},PERMISSIONS.AUDIT_LOGS_EXPORT),true)
})

test('Filter input is validated to avoid ambiguous time ranges and invalid actions', () => {
  assert.deepEqual(parseAuditReportFilters({from:'2026-10-01',to:'2026-10-13',action:'update',includeArchived:'true'}),{from:'2026-10-01',to:'2026-10-13',action:'update',module:'all',search:'',includeArchived:true})
  assert.throws(()=>parseAuditReportFilters({from:'2026-10-13',to:'2026-10-01'}),/valid date range/i)
  assert.throws(()=>parseAuditReportFilters({action:'DROP TABLE'}),/valid audit action/i)
})

test('Before/after extraction preserves real fields, including zero and nested changes',()=>{
  const changes=getAuditChanges({metadata:{before:{area:300,pricing:{cashPrice:0,installment:1300}},after:{area:322,pricing:{cashPrice:1200,installment:1500}}}})
  assert.equal(changes.length,3)
  assert.ok(changes.some((r)=>r.path==='area' && r.before==='300' && r.after==='322'))
  assert.ok(changes.some((r)=>r.path==='pricing.cashPrice' && r.before==='0' && r.after==='1200'))
  assert.deepEqual(getAuditChanges({metadata:{}}),[])
  assert.deepEqual(getAuditChanges({metadata:{before:{password:'a'},after:{password:'b'}}}).map((x)=>[x.field,x.before,x.after]),[['Password','[REDACTED]','[REDACTED]']])
  assert.deepEqual(getAuditChanges({metadata:{changes:[{field:'unitId',oldValue:'LA-1',newValue:'LA-1A'}]}}).map((r)=>[r.before,r.after]),[['LA-1','LA-1A']])
})

test('Excel values escape formula injection, metadata redacts secrets and accounts',()=>{
  for(const str of ['=2+2','+SUM(1,2)','-1+CMD','@DDE',' \t=HYPERLINK("x")']) assert.equal(safeAuditText(str)[0],"'")
  assert.equal(safeAuditText('LA-0208'),'LA-0208')
  assert.deepEqual(redactEvidence({token:'leak',nested:{password:'secret',bank_account_number:'12345678'}}),{token:'[REDACTED]',nested:{password:'[REDACTED]',bank_account_number:'****5678'}})
  assert.deepEqual(redactReportMetadata({verificationCode:'456789',bankAccountNumber:'0123456789'}),{verificationCode:'[REDACTED]',bankAccountNumber:'****6789'})
})

test('Case links require explicit metadata ids; history is not inferred by shared unit names',()=>{
  assert.deepEqual(getExactAuditReferences({entityLabel:'LA-0208'}),{reviewId:null,caseId:null})
  assert.deepEqual(getAuditReferences({reviewId:200,auditCaseId:300}),{reviewId:200,caseId:300})
  const code=read('server/controllers/System/auditReport.controller.js')
  assert.match(read('server/utils/auditReportValidation.js'),/getExactAuditReferences/)
  assert.match(code,/operational_review_id IN/)
  assert.doesNotMatch(code,/WHERE[^`]+entity_label = r\.entity_label/)
})

test('Frontend includes all modal fields, five sheets, filter reuse and paged retrieval',()=>{
  const page=read('client/src/pages/System/AuditLogs.jsx')
  const modal=read('client/src/components/System/auditLogsComponents/ExportAuditReportModal.jsx')
  const excel=read('client/src/utils/auditReportExcel.js')
  for(const name of ['Report Summary','Audit Trail','Before & After Changes','Reviews & Audit Cases','Seller & Manager Changes','Technical Details']) assert.ok(excel.includes(name),name)
  for(const heading of ['User Email','Action','Module','Entity','Title','Description','Reason','IP Address']) assert.ok(excel.includes(heading),heading)
  assert.match(page,/ExportAuditReportModal/)
  assert.match(modal,/result\.hasMore/)
  assert.match(modal,/100000/)
  assert.match(modal,/includeArchived/)
  assert.match(modal,/includeCaseHistory/)
  assert.match(modal,/\/audit-logs\/report\/record/)
  assert.match(read('client/src/utils/apiClient.js'),/audit-logs\\\/report/)
  assert.match(read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx'),/getAuditChanges/)
  assert.equal(getAuditExtraFields({metadata:{reason:'survey mistake',newStatus:'Approved'}}).reason,'survey mistake')
  assert.equal(getAuditExtraFields({title:'Requested client document resubmission',module:'Documents',entityLabel:'Proof of Identity',metadata:{}}).newStatus,'Needs Resubmission')
})

test('Workbook generator retains full modal details and maps documented changes into six readable sheets', () => {
  // Use a tiny workbook stand-in so this test remains independent of Vite and
  // the client-only xlsx-js-style package in the text-source test environment.
  const src = read('client/src/utils/auditReportExcel.js')
    .replace(/^import .*\n/gm, '')
    .replace(/export const /g, 'const ')
  const encodeCell = ({r,c}) => {
    let n=c+1, out=''; while(n) {n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)};
    return `${out}${r+1}`
  }
  const XLSX = { utils: {
    book_new:()=>({SheetNames:[],Sheets:{}}),
    aoa_to_sheet:(a)=>Object.fromEntries(a.flatMap((row,r)=>row.map((cell,c)=>[encodeCell({r,c}),cell]))),
    encode_cell: encodeCell, encode_range:()=> 'A1:Z90',
    book_append_sheet:(book,ws,name)=>{book.SheetNames.push(name);book.Sheets[name]=ws},
  }}
  const build = new Function('XLSX','getAuditChanges','getAuditEvidenceCoverage','getAuditExtraFields','getAuditReferences','redactEvidence','safeAuditText','formatPhilippineDateTime','sellerAuditRows',
    `${src}\nreturn buildAuditReportWorkbook;`)(XLSX,getAuditChanges,getAuditEvidenceCoverage,getAuditExtraFields,getAuditReferences,redactEvidence,safeAuditText,(v)=>v,sellerAuditRows)
  const wb=build({logs:[{
    id:12,createdAt:'2026-10-13T03:41:00Z',actorName:'Office Staff',actorEmail:'staff@example.com',actorRole:'operations_staff',
    action:'update',module:'Attendance',entityLabel:'LA-0208',entityType:'listing',entityId:'77',title:'Corrected attendance time',
    description:'Audit explanation exactly as recorded',source:'Current',ipAddress:'1.2.3.4',userAgent:'Browser',
    metadata:{before:{area:300,price:1300},after:{area:322,price:1500},reason:'=formula',actualTimeIn:'10:10:00',actualTimeOut:'20:20:00',reviewId:55,password:'hidden',requestId:'req-a'},
  }],cases:{reviews:[],events:[],cases:[]},filters:{},generatedBy:'Super Admin'})
  assert.deepEqual(wb.SheetNames,['Report Summary','Audit Trail','Before & After Changes','Reviews & Audit Cases','Seller & Manager Changes','Technical Details'])
  const main=wb.Sheets['Audit Trail']
  assert.equal(main['A2'].v,'12')
  assert.equal(main['M2'].v,'Audit explanation exactly as recorded')
  assert.equal(main['N2'].v,"'=formula")
  assert.equal(main['W2'].v,'20:20:00')
  assert.equal(wb.Sheets['Before & After Changes']['G2'].v,'Area')
  assert.equal(wb.Sheets['Before & After Changes']['H2'].v,'300')
  assert.equal(wb.Sheets['Before & After Changes']['I2'].v,'322')
  assert.match(wb.Sheets['Technical Details']['L2'].v,/\[REDACTED\]/)
  assert.doesNotMatch(wb.Sheets['Technical Details']['L2'].v,/hidden/)
})


