import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Network project rates are post-action review, not Head pre-approval', () => {
  const actions = read('server/config/reviewActions.js');
  assert.match(actions, /'network\.rates\.update': \{[^}]*headApprovalBefore: false/);
});

test('governed action helper lets post-action changes save immediately', () => {
  const service = read('server/services/governedAction.service.js');
  assert.match(service, /if \(!definition\.headApprovalBefore\)/);
  assert.match(service, /authorizationType: 'post_action_review'/);
});

test('Network rate controller no longer returns APR pending for rate saves', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');
  assert.doesNotMatch(controller, /headApprovalPendingResponse/);
  assert.match(controller, /actionKey: 'network\.rates\.update'/);
  assert.match(controller, /createOperationalReview\(connection, \{[\s\S]*actionKey: 'network\.rates\.update'/);
});

