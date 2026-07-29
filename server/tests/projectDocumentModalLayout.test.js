import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Add and Edit Lot Project use a dedicated two-column document workspace', async () => {
  const modal = await read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx');
  const editModal = await read('../../client/src/components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal.jsx');

  assert.match(modal, /Choose Documents/);
  assert.match(modal, /Documents Added/);
  assert.match(modal, /lg:grid-cols-\[minmax\(0,0\.95fr\)_minmax\(0,1\.05fr\)\]/);
  assert.match(modal, /Document Templates/);
  assert.match(modal, /Document Library/);
  assert.match(editModal, /AddLotProjectModal/);
  assert.match(editModal, /mode="edit"/);
});

test('selected documents render as readable cards without the old cramped row grid', async () => {
  const modal = await read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx');

  assert.match(modal, /selectedDocuments\.map\(\(document\) =>/);
  assert.match(modal, /Review the final checklist and edit each document before saving\./);
  assert.match(modal, /mt-3 grid gap-3 sm:grid-cols-2/);
  assert.match(modal, /break-words text-sm font-black text-slate-950/);
  assert.doesNotMatch(modal, /md:grid-cols-\[1fr_130px_130px_auto\]/);
});

test('template and library lists have separate scrolling areas', async () => {
  const modal = await read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx');

  assert.match(modal, /Search templates\.\.\./);
  assert.match(modal, /Search document library\.\.\./);
  assert.match(modal, /No matching templates found\./);
  assert.match(modal, /No matching library documents found\./);
  assert.match(modal, /Select a template or add documents from the library on the left\./);
});
