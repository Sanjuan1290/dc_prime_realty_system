import test from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../db/connect.js';
import {
  LOT_PROJECT_OPTIONS_QUERY,
  getLotProjectOptions,
  mapLotProjectOption,
} from '../controllers/System/projects.controller.js';

test('lot project workspace options query loads the project location', () => {
  assert.match(LOT_PROJECT_OPTIONS_QUERY, /\blot_project_location\b/);
  assert.match(LOT_PROJECT_OPTIONS_QUERY, /\blot_project_location_code\b/);
});

test('lot project workspace option exposes raw and normalized location fields', () => {
  const option = mapLotProjectOption({
    lot_project_id: 1,
    lot_project_name: 'Bailen Project',
    lot_project_slug: 'bailen-project',
    lot_project_location: 'Pantihan, Cavite',
    lot_project_location_code: 'LA',
    lot_project_status: 'active',
  });

  assert.equal(option.lot_project_location, 'Pantihan, Cavite');
  assert.equal(option.location, 'Pantihan, Cavite');
  assert.equal(option.locationCode, 'LA');
  assert.equal(option.routePath, '/lot-projects/bailen-project');
});

test('lot project workspace options endpoint returns the database location', async () => {
  const originalQuery = db.query;
  let responseBody = null;
  let responseStatus = 200;

  db.query = async (query) => {
    assert.equal(query, LOT_PROJECT_OPTIONS_QUERY);
    return [[{
      lot_project_id: 2,
      lot_project_name: 'Prime Enclave Project',
      lot_project_slug: 'prime-enclave-project',
      lot_project_location: 'Maragondon, Cavite',
      lot_project_location_code: 'PE',
      lot_project_status: 'active',
    }]];
  };

  const response = {
    status(value) {
      responseStatus = value;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
  };

  try {
    await getLotProjectOptions({}, response);
  } finally {
    db.query = originalQuery;
  }

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.data[0].location, 'Maragondon, Cavite');
  assert.equal(responseBody.data[0].lot_project_location, 'Maragondon, Cavite');
});
