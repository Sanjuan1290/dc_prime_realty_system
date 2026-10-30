import test from 'node:test'
import assert from 'node:assert/strict'
import { getReviewRecordLink } from '../../../CLIENT/SYSTEM/src/utils/reviewRecordLinks.js'

const baseReview = {
  entity_type: 'lot_project_lmf_schedule',
  entity_id: '728',
  lot_project_slug: 'sample-project',
  recordLocation: { kind: 'listing_profile', listingId: 101, accountId: 302, scheduleId: 728 },
}

test('verified review link uses exact unit, buyer account and schedule after reload', () => {
  const href = getReviewRecordLink({ review: baseReview, reviewId: 55, mode: 'view' })
  const url = new URL(href, 'https://example.test')
  assert.equal(url.pathname, '/portal/lot-projects/sample-project/listings/101/accounts/302')
  assert.equal(url.searchParams.get('scheduleId'), '728')
  assert.equal(url.searchParams.get('reviewId'), '55')
  assert.equal(url.searchParams.get('reviewView'), '1')
  assert.equal(url.searchParams.get('workflowAction'), null)
})

test('correction link carries audit context but never confuses view with edit', () => {
  const href = getReviewRecordLink({
    review: baseReview, reviewId: 55, auditCaseId: 12,
    mode: 'correct', workflowAction: 'lmf_correction',
  })
  const url = new URL(href, 'https://example.test')
  assert.equal(url.searchParams.get('workflowAction'), 'lmf_correction')
  assert.equal(url.searchParams.get('reviewView'), null)
  assert.equal(url.searchParams.get('auditCaseId'), '12')
  assert.equal(url.searchParams.get('scheduleId'), '728')
})

test('review link rejects missing backend-verified listing/account destination', () => {
  assert.equal(getReviewRecordLink({
    review: { ...baseReview, recordLocation: { kind: 'listing_profile', listingId: null } },
    reviewId: 55,
  }), null)
  assert.equal(getReviewRecordLink({
    review: { ...baseReview, entityExists: false }, reviewId: 55,
  }), null)
})

test('commission review uses commission ID and does not imply edit permissions', () => {
  const href = getReviewRecordLink({
    review: { entity_type: 'lot_project_commission', entity_id: '901', lot_project_slug: 'sample-project' },
    reviewId: 55, mode: 'view',
  })
  const url = new URL(href, 'https://example.test')
  assert.equal(url.pathname, '/portal/lot-projects/sample-project/commissions')
  assert.equal(url.searchParams.get('commissionId'), '901')
  assert.equal(url.searchParams.get('reviewView'), '1')
})

