import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  auditActivityTitle,
  formatAuditRecordedValue,
  getAuditChanges,
  getAuditDisplayChanges,
  getAuditExtraFields,
} from '../../../CLIENT/SYSTEM/src/utils/auditReportEvidence.js'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('the refund code request uses the authorization modal and the final PUT still calls Double-Check', () => {
  const page = read('CLIENT/SYSTEM/src/pages/Lot_Projects/ListingProfile.jsx')
  assert.match(page, /listingId\}\/cancellation-code`\s*,\s*payload\s*,\s*\{ confirmationHandled: 'compact' \}/)
  assert.match(page, /useFetchPut\(`\/projects\/lot-projects\/.*\/listings\/.*`, workflowPayload, \{\s*doubleCheck:/)
  const router = read('SERVER/SYSTEM/routers/System/projects.routers.js')
  assert.match(router, /cancellation-code', requireCancellationActionPermission, requireCurrentPassword/)
  const controller = read('SERVER/SYSTEM/controllers/Lot_Projects/Listings/Listings.controller.js')
  assert.match(controller, /verifyAndConsumeSensitiveAction\(connection, \{\s*verificationId,/)
})

test('previous listing logs show the saved status change without phantom attendance or listing fields', () => {
  const log = {
    title: 'Cancelled pending cancellation',
    module: 'Listings',
    entityType: 'lot_project_listing',
    metadata: {
      requestId: 'test-request',
      before: { status: 'pending_for_cancellation', soldSubstatus: null },
      after: { status: 'sold', soldSubstatus: 'active', cadastralLots: ['-'], documentRequirements: null },
    },
  }
  assert.deepEqual(getAuditExtraFields(log), { requestId: 'test-request' })
  assert.deepEqual(getAuditChanges(log).map(({path}) => path), ['status', 'soldSubstatus'])
  assert.deepEqual(getAuditDisplayChanges(log), [{
    field: 'Listing status', before: 'Pending Cancellation', after: 'Sold / Active', path: 'status',
  }])
  assert.equal(auditActivityTitle(log), 'Restored sale to active status')
})

test('recorded refund values and real empty or zero values are presented accurately', () => {
  const details = getAuditExtraFields({
    module: 'Listings',
    metadata: { cancellationSettlement: {
      refundType: 'partial_refund', refundAmount: 100000, discontinuedAmount: 40000, refundDate: '2026-11-18',
      refundReference: null, settlementNotes: 'undefined',
    } },
  })
  assert.equal(formatAuditRecordedValue('refundType', details.refundType), 'Partial Refund')
  assert.equal(formatAuditRecordedValue('refundAmount', details.refundAmount), '₱100,000.00')
  assert.equal(formatAuditRecordedValue('discontinuedAmount', details.discontinuedAmount), '₱40,000.00')
  assert.equal(formatAuditRecordedValue('refundDate', details.refundDate), 'Nov 18, 2026')
  assert.equal(formatAuditRecordedValue('refundAmount', '0'), '₱0.00')
  assert.equal(formatAuditRecordedValue('documentRequirements', '[]'), 'None')
  assert.equal(formatAuditRecordedValue('cadastralLots', '["109-A","109-B"]'), '109-A, 109-B')
  assert.equal(formatAuditRecordedValue('documentRequirements', '[{"name":"Intent to Buy","isRequired":1}]'), 'Intent to Buy · Required')
  assert.deepEqual(Object.keys(details), ['refundType', 'refundAmount', 'discontinuedAmount', 'refundDate'])
  assert.equal(getAuditChanges({ metadata: { changes: [{field: 'Status', before: null, after: 'active'}] } })[0].before, '(empty)')
  assert.equal(getAuditExtraFields({ module: 'Documents', action: 'reject', metadata: { newStatus: 'Rejected' } }).newStatus, 'Needs Resubmission')
})

test('listing audit output uses actual before and after document and cadastral changes', () => {
  const source = read('SERVER/SYSTEM/controllers/Lot_Projects/Listings/Listings.controller.js')
  const log = source.slice(source.indexOf('const auditTitle = statusTransitionAction'), source.indexOf('// Every governed change'))
  for (const side of ['before', 'after']) {
    assert.ok(log.includes('cadastralLots: reviewCadastralDiff.' + side))
    assert.ok(log.includes('documentRequirements: reviewDocumentsDiff.' + side))
  }
  assert.doesNotMatch(log, /cadastralLots: Array\.isArray\(req\.body/)
  assert.match(log, /\.\.\.updatedListingFinancials/)
})
