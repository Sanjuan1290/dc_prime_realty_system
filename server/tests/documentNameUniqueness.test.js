import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('document API rejects duplicate names on add and edit', () => {
  const source = read('server/controllers/System/documents.controller.js')
  const addStart = source.indexOf('export const addDocument')
  const addEnd = source.indexOf('export const addTemplate', addStart)
  const editStart = source.indexOf('export const editDocument')
  const editEnd = source.indexOf('export const editTemplate', editStart)
  const add = source.slice(addStart, addEnd)
  const edit = source.slice(editStart, editEnd)

  assert.match(source, /duplicateDocumentNameMessage/)
  assert.match(source, /isDuplicateDocumentNameError/)
  assert.match(add, /TRIM\(document_name\) = \? LIMIT 1/)
  assert.match(add, /status\(409\)/)
  assert.match(edit, /TRIM\(document_name\) = \? AND document_id <> \? LIMIT 1/)
  assert.match(edit, /status\(409\)/)
  assert.match(add, /normalizedDocumentName/)
  assert.match(edit, /normalizedDocumentName/)
})

test('document-name migration removes the known accidental duplicate and adds a unique index', () => {
  const source = read('server/migrations/20260814_unique_document_names.sql')

  assert.match(source, /DOC-SPA-AUTHORIZATION-TO-SIGN-FOR-REPRESENTATIVE/)
  assert.match(source, /DOC-SPA-AUTHORIZATION-TO-SIGN-FOR-REPRESENTATIVES/)
  assert.match(source, /UPDATE template_document_list/)
  assert.match(source, /UPDATE lot_project_default_documents/)
  assert.match(source, /UPDATE lot_project_listing_documents/)
  assert.match(source, /UPDATE lot_project_client_document_files/)
  assert.match(source, /UPDATE lot_project_client_documents/)
  assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_document_name/)
})
