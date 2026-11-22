import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNDO_WINDOW_SECONDS,
  UNDO_CODE_TTL_SECONDS,
  UNDO_CODE_MAX_ATTEMPTS,
  UNDO_CODE_SEND_LIMIT,
  createUndoVerificationCode,
  hashUndoReviewToken,
  hashUndoVerificationCode,
  isUndoLocked,
  maskEmail,
  undoSecondsRemaining,
  validUndoAuthorizationId,
  verifyUndoVerificationCode,
} from '../src/importUndoVerification.js';

test('normal undo window is exactly 24 hours from committed_at',()=>{
  const committed='2026-11-22 10:00:00';
  const start=Date.parse('2026-11-22T10:00:00Z');
  assert.equal(UNDO_WINDOW_SECONDS,86400);
  assert.equal(isUndoLocked(committed,start+UNDO_WINDOW_SECONDS*1000-1),false);
  assert.equal(isUndoLocked(committed,start+UNDO_WINDOW_SECONDS*1000),true);
  assert.equal(isUndoLocked(null,start),true,'missing timestamps must lock normal undo');
  assert.equal(undoSecondsRemaining(committed,start),86400);
  assert.equal(undoSecondsRemaining(committed,start+86399*1000),1);
  assert.equal(undoSecondsRemaining(committed,start+86400*1000),0);
});

test('Admin email verification codes are six digits, salted, and timing-safe verified',()=>{
  assert.equal(UNDO_CODE_TTL_SECONDS,600);
  assert.equal(UNDO_CODE_MAX_ATTEMPTS,5);
  assert.equal(UNDO_CODE_SEND_LIMIT,3);
  const code=createUndoVerificationCode();
  assert.match(code,/^\d{6}$/);
  const stored=hashUndoVerificationCode(code);
  assert.match(stored.salt,/^[a-f0-9]{32}$/);
  assert.match(stored.hash,/^[a-f0-9]{64}$/);
  assert.equal(verifyUndoVerificationCode(code,stored.salt,stored.hash),true);
  assert.equal(verifyUndoVerificationCode('000000',stored.salt,stored.hash),false);
  assert.equal(verifyUndoVerificationCode('not-a-code',stored.salt,stored.hash),false);
});

test('Admin email is masked and verification authorization IDs are validated',()=>{
  assert.equal(maskEmail('robert@example.com'),'ro****@example.com');
  assert.equal(maskEmail('a@example.com'),'a**@example.com');
  assert.equal(validUndoAuthorizationId('f47ac10b-58cc-4372-a567-0e02b2c3d479'),true);
  assert.equal(validUndoAuthorizationId('not-an-id'),false);
});

test('one-time authorization is bound to the reviewed balance token',()=>{
  const first='a'.repeat(64),second='b'.repeat(64);
  assert.match(hashUndoReviewToken(first),/^[a-f0-9]{64}$/);
  assert.notEqual(hashUndoReviewToken(first),hashUndoReviewToken(second));
});
