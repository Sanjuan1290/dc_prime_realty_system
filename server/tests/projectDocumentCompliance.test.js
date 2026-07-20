import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('project document compliance defaults to All Projects', async () => {
  const page = await read('../../client/src/pages/System/Projects.jsx');

  assert.match(page, /useState\('all'\)/);
  assert.match(page, /<option value="all">All Projects<\/option>/);
  assert.match(page, /activeDocumentProjectId !== 'all'/);
  assert.match(page, /activeDocumentProjectId === 'all' \? `\$\{unit\.projectName\} · \$\{unit\.unitId\}`/);
});

test('project account completion counts only accounts with every document submitted or approved', async () => {
  const [controller, page] = await Promise.all([
    read('../controllers/System/projects.controller.js'),
    read('../../client/src/pages/System/Projects.jsx'),
  ]);

  assert.match(controller, /const completedAccountsByProject = new Map\(\)/);
  assert.match(controller, /counts\.totalDocuments > 0/);
  assert.match(controller, /counts\.submittedDocuments === counts\.totalDocuments/);
  assert.match(controller, /accountsWithCompletedDocuments:/);
  assert.doesNotMatch(controller, /accountsWithSubmittedDocuments:/);

  assert.match(page, /No\. of Accounts Docs Completed \/ No\. of Accounts/);
  assert.match(page, /project\.accountsWithCompletedDocuments/);
  assert.doesNotMatch(page, /project\.accountsWithSubmittedDocuments/);
});

