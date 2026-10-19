import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildReviewAuditFilter } from '../services/reviewAuditLinks.service.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8')
const importReview={
  operational_review_id:240001,
  action_key:'network.members.import',
  entity_type:'seller_group',
  entity_id:'90001',
  after_snapshot_json:JSON.stringify({groupId:90001,importBatchId:30001,importedCount:3}),
}

test('an updated Network creation review finds its exact legacy member-import audit entry',()=>{
 const result=buildReviewAuditFilter(importReview,[{event_type:'created',message:'Network creation saved and queued for review.'}]);
 assert.match(result.sql,/\$\.reviewId/)
 assert.match(result.sql,/seller_network_member_import/)
 assert.match(result.sql,/\$\.import_batch_id/)
 assert.match(result.sql,/al\.module = 'Groups'/)
 assert.deepEqual(result.values,['240001','90001','30001','90001'])
 assert.doesNotMatch(result.sql,/LIKE '\%|metadata_json AS CHAR/)
})

test('another import batch in the same Network is never matched using the Network alone',()=>{
 const result=buildReviewAuditFilter(importReview,[])
 assert.deepEqual(result.values,['240001','90001','30001'])
 assert.match(result.sql,/al\.entity_id = \? AND JSON_UNQUOTE\(JSON_EXTRACT\(al\.metadata_json, '\$\.import_batch_id'\)\) = \?/)
 assert.doesNotMatch(result.sql,/al\.module = 'Groups'/)
})

test('reviews other than supported legacy operations retain explicit review ID filter',()=>{
 const result=buildReviewAuditFilter({...importReview,action_key:'network.rates.update'},[])
 assert.deepEqual(result.values,['240001'])
 assert.equal(result.sql,"(JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.reviewId')) = ?)")
})

test('a seller-created review can identify its exact accreditation event, but not unrelated seller actions',()=>{
 const result=buildReviewAuditFilter({operational_review_id:240003,action_key:'seller.create',entity_type:'accredited_seller',entity_id:'90001'})
 assert.deepEqual(result.values,['240003','90001'])
 assert.match(result.sql,/al\.module = 'Accreditation'/)
 assert.match(result.sql,/al\.title = 'Accredited seller'/)
})

test('the review record preview quotes TiDB/MySQL ROW keyword in both import readers',()=>{
 const service=read('server/services/reviewExtraRecord.service.js')
 assert.ok(service.includes("excel_row_number AS \\`row\\`"))
 assert.ok(service.includes("source_row AS \\`row\\`"))
 assert.doesNotMatch(service,/\bAS row\b/)
})

test('Audit Logs uses Review source linkage for BOTH list and count, without changing the normal list',()=>{
 const controller=read('server/controllers/System/auditLogs.controller.js')
 assert.match(controller,/buildReviewAuditFilter\(reviewRows\[0\], reviewEvents\)/)
 assert.match(controller,/conditions\.push\(reviewFilter\.sql\)/)
 assert.match(controller,/values\.push\(\.\.\.reviewFilter\.values\)/)
 assert.match(controller,/FROM audit_logs al \$\{whereSql\}/)
 const page=read('client/src/pages/System/AuditLogs.jsx')
 assert.match(page,/Found \$\{pagination\.total\} Audit Log/)
 assert.match(page,/Review History still shows the saved review events/)
 const modal=read('client/src/components/Shared/ReviewExtraRecordModal.jsx')
 assert.match(modal,/Try Again/)
 assert.match(modal,/query\.refetch\(\)/)
})
