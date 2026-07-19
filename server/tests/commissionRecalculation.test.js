import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import {
  requireCurrentPassword,
  requireRole,
} from '../middleware/auth.middleware.js';
import {
  buildCommissionDistribution,
  buildDirectOverrideDistribution,
  hasReleasedCommissionActivity,
} from '../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js';
import { getListingLookupWhere } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const seller = (id, role, name) => ({
  accredited_seller_id: id,
  role,
  full_name: name,
});

test('commission recalculation remains available when no release evidence exists', () => {
  assert.equal(hasReleasedCommissionActivity({}), false);
  assert.equal(hasReleasedCommissionActivity({ releasedAmount: 0 }), false);
});

test('any released amount, released stage, or receipt locks recalculation', () => {
  assert.equal(hasReleasedCommissionActivity({ releasedAmount: 1 }), true);
  assert.equal(hasReleasedCommissionActivity({ releasedCommissionCount: 1 }), true);
  assert.equal(hasReleasedCommissionActivity({ releasedStageCount: 1 }), true);
  assert.equal(hasReleasedCommissionActivity({ receiptCount: 1 }), true);
});

test('agent reporting directly to broker produces agent, broker, and BNM shares', () => {
  const chain = [
    seller(1, 'agent', 'Agent One'),
    seller(3, 'broker', 'Broker One'),
    seller(4, 'broker_network_manager', 'BNM One'),
  ];
  const rateMap = new Map([
    [1, 3],
    [3, 7],
    [4, 8],
  ]);

  const rows = buildCommissionDistribution({
    chain,
    rateMap,
    groupPoolRate: 8,
    saleChannel: 'distributed',
  });

  assert.deepEqual(rows.map((row) => [row.seller.role, row.rate]), [
    ['agent', 3],
    ['broker', 4],
    ['broker_network_manager', 1],
  ]);
});

test('current hierarchy adds the manager share after the agent reports to a manager', () => {
  const chain = [
    seller(1, 'agent', 'Agent One'),
    seller(2, 'manager', 'Manager One'),
    seller(3, 'broker', 'Broker One'),
    seller(4, 'broker_network_manager', 'BNM One'),
  ];
  const rateMap = new Map([
    [1, 3],
    [2, 5],
    [3, 7],
    [4, 8],
  ]);

  const rows = buildCommissionDistribution({
    chain,
    rateMap,
    groupPoolRate: 8,
    saleChannel: 'distributed',
  });

  assert.deepEqual(rows.map((row) => [row.seller.role, row.rate]), [
    ['agent', 3],
    ['manager', 2],
    ['broker', 2],
    ['broker_network_manager', 1],
  ]);
});



test('direct-agent commission uses explicit relationship overrides', () => {
  const chain = [
    seller(1, 'agent', 'Agent One'),
    seller(2, 'manager', 'Manager One'),
    seller(3, 'broker', 'Broker One'),
    seller(4, 'broker_network_manager', 'BNM One'),
  ];
  const overrideRateMap = new Map([
    ['1:2', 1],
    ['2:3', 2],
    ['3:4', 1],
  ]);

  const rows = buildDirectOverrideDistribution({
    chain,
    directRate: 4,
    overrideRateMap,
    groupPoolRate: 8,
  });

  assert.deepEqual(rows.map((row) => [row.seller.role, row.rateType, row.rate]), [
    ['agent', 'direct', 4],
    ['manager', 'override', 1],
    ['broker', 'override', 2],
    ['broker_network_manager', 'override', 1],
  ]);
});

test('direct-agent commission rejects a non-agent assignment', () => {
  assert.throws(
    () => buildDirectOverrideDistribution({
      chain: [seller(2, 'manager', 'Manager One')],
      directRate: 4,
      overrideRateMap: new Map(),
      groupPoolRate: 8,
    }),
    /only active sales agents can be assigned/i
  );
});

test('direct and override allocation cannot exceed the group project pool', () => {
  const chain = [
    seller(1, 'agent', 'Agent One'),
    seller(2, 'manager', 'Manager One'),
  ];

  assert.throws(
    () => buildDirectOverrideDistribution({
      chain,
      directRate: 7,
      overrideRateMap: new Map([['1:2', 2]]),
      groupPoolRate: 8,
    }),
    /exceeds the group project pool/i
  );
});

test('invalid parent ceilings are rejected before commission rows are replaced', () => {
  const chain = [
    seller(1, 'agent', 'Agent One'),
    seller(2, 'manager', 'Manager One'),
  ];
  const rateMap = new Map([
    [1, 5],
    [2, 4],
  ]);

  assert.throws(
    () => buildCommissionDistribution({ chain, rateMap, groupPoolRate: 8 }),
    /cannot be lower than the seller below them/i
  );
});


test('commission recalculation qualifies listing lookup columns with the listing alias', () => {
  assert.deepEqual(getListingLookupWhere('123', 'l'), {
    sql: 'l.lot_project_listing_id = ?',
    params: [123],
  });
  assert.deepEqual(getListingLookupWhere('LA-0101', 'l'), {
    sql: 'l.lot_project_listing_unit_id = ?',
    params: ['LA-0101'],
  });
});


const createMockResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('commission recalculation role guard blocks Admin and allows Super Admin', () => {
  const guard = requireRole('super_admin');

  const adminResponse = createMockResponse();
  let adminNextCalled = false;
  guard(
    { authUser: { role: 'admin' } },
    adminResponse,
    () => { adminNextCalled = true; }
  );

  assert.equal(adminResponse.statusCode, 403);
  assert.equal(adminNextCalled, false);

  const superAdminResponse = createMockResponse();
  let superAdminNextCalled = false;
  guard(
    { authUser: { role: 'super_admin' } },
    superAdminResponse,
    () => { superAdminNextCalled = true; }
  );

  assert.equal(superAdminResponse.statusCode, 200);
  assert.equal(superAdminNextCalled, true);
});

test('commission recalculation password guard requires the current password', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const guard = requireCurrentPassword({
    field: 'password',
    label: 'Super Admin password',
  });

  const missingResponse = createMockResponse();
  let missingNextCalled = false;
  await guard(
    { body: {}, authUser: { password_hash: passwordHash } },
    missingResponse,
    () => { missingNextCalled = true; }
  );

  assert.equal(missingResponse.statusCode, 400);
  assert.match(missingResponse.payload.message, /password is required/i);
  assert.equal(missingNextCalled, false);

  const wrongResponse = createMockResponse();
  let wrongNextCalled = false;
  await guard(
    { body: { password: 'wrong-password' }, authUser: { password_hash: passwordHash } },
    wrongResponse,
    () => { wrongNextCalled = true; }
  );

  assert.equal(wrongResponse.statusCode, 401);
  assert.match(wrongResponse.payload.message, /password is incorrect/i);
  assert.equal(wrongNextCalled, false);
});

test('verified recalculation password is removed before the controller runs', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const guard = requireCurrentPassword({
    field: 'password',
    label: 'Super Admin password',
  });
  const request = {
    body: { password: 'correct-password', acknowledgement: true },
    authUser: { password_hash: passwordHash },
  };
  const response = createMockResponse();
  let nextCalled = false;

  await guard(request, response, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(Object.hasOwn(request.body, 'password'), false);
  assert.equal(request.body.acknowledgement, true);
});

