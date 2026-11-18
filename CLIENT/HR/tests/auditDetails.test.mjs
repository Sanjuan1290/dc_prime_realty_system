import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDetails,auditLabel} from '../../shared/auditDetails.js';
test('audit details handle malformed and nested legacy data without exposing verification credentials',()=>{
  assert.match(auditDetails('{broken').description,/not recorded/);
  const details=auditDetails(JSON.stringify({metadata:{before:{salary:15000},after:{salary:16000},password:'private',verification_code:'123456',nested:'{"token":"private","active":true}'}}));
  assert.equal(details.metadata.before.salary,15000);assert.equal(details.metadata.after.salary,16000);
  assert.equal(details.metadata.nested.active,true);assert.doesNotMatch(JSON.stringify(details),/123456|private/);
  assert.equal(auditLabel('netFundRelease'),'Net Fund Release');
});
