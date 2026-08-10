import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('add and edit document forms do not expose reusable as a user choice', () => {
  const add = read('client/src/components/System/documentComponents/AddDocument.jsx')
  const edit = read('client/src/components/System/documentComponents/EditDocument.jsx')

  for (const source of [add, edit]) {
    assert.doesNotMatch(source, /Reusable Across Units/)
    assert.doesNotMatch(source, /document_is_reusable/)
    assert.match(source, /sm:grid-cols-2/)
  }
})

test('document library does not display a redundant reusable column', () => {
  const source = read('client/src/components/System/documentComponents/DocumentLibrary.jsx')
  assert.doesNotMatch(source, />Reusable</)
  assert.doesNotMatch(source, /document\.document_is_reusable/)
  assert.match(source, /md:grid-cols-5/)
})

test('document API always stores documents as reusable regardless of request payload', () => {
  const source = read('server/controllers/System/documents.controller.js')
  const addStart = source.indexOf('export const addDocument')
  const templateStart = source.indexOf('export const addTemplate', addStart)
  const editStart = source.indexOf('export const editDocument')
  const editEnd = source.indexOf('export const editTemplate', editStart)
  const add = source.slice(addStart, templateStart)
  const edit = source.slice(editStart, editEnd)

  for (const block of [add, edit]) {
    assert.doesNotMatch(block, /document_is_reusable\s*=\s*true/)
    assert.doesNotMatch(block, /Boolean\(document_is_reusable\)/)
    assert.match(block, /document_is_reusable/)
    assert.match(block, /[\s\S]*?1,\s*document_status,/)
  }
})

test('migration normalizes any historical non-reusable documents to reusable', () => {
  const source = read('server/migrations/20260809_documents_always_reusable.sql')
  assert.match(source, /UPDATE documents[\s\S]*document_is_reusable = 1/)
  assert.match(source, /MODIFY COLUMN document_is_reusable TINYINT\(1\) NOT NULL DEFAULT 1/)
})


