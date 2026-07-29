import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Add and Edit Project include the Title Number text field', async () => {
  const modal = await read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx');

  assert.match(modal, /titleNumber:/);
  assert.match(modal, /label="Title Number"[\s\S]*?type="text"/);
  assert.match(modal, /titleNumber: form\.titleNumber\.trim\(\)/);
});

test('Project Details shows Title Number and hides Project ID and Document Template', async () => {
  const details = await read('../../client/src/components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal.jsx');

  assert.match(details, /label="Title Number"/);
  assert.doesNotMatch(details, /label="Project ID"/);
  assert.doesNotMatch(details, /label="Document Template"/);
});

test('project API persists and returns lot_project_title_number', async () => {
  const [projectsController, sharedController, dashboardController] = await Promise.all([
    read('../controllers/System/projects.controller.js'),
    read('../controllers/Lot_Projects/_shared/lotProject.shared.js'),
    read('../controllers/Lot_Projects/Dashboard/Dashboard.controller.js'),
  ]);

  assert.match(projectsController, /lot_project_title_number/);
  assert.match(projectsController, /payload\.titleNumber/);
  assert.match(sharedController, /titleNumber: toNullable\(/);
  assert.match(sharedController, /titleNumber: project\.lot_project_title_number/);
  assert.match(dashboardController, /titleNumber: project\.lot_project_title_number/);
});

test('migration adds the optional lot_project_title_number column', async () => {
  const migration = await read('../migrations/20260725_lot_project_title_number.sql');

  assert.match(migration, /ADD COLUMN lot_project_title_number VARCHAR\(150\) NULL/);
  assert.match(migration, /information_schema\.columns/);
});
