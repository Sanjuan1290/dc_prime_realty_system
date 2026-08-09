import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('document template final review uses real document names instead of Item 1 labels', () => {
  const addTemplate = read('client/src/components/System/documentComponents/DocumentAddTemplate.jsx')
  const editTemplate = read('client/src/components/System/documentComponents/EditDocumentTemplate.jsx')
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx')

  for (const source of [addTemplate, editTemplate]) {
    assert.match(source, /buildTemplateReviewPayload/)
    assert.match(source, /reviewTitle:\s*document\.document_name/)
    assert.match(source, /templateDocuments:/)
    assert.match(source, /requirement:\s*toRequiredBoolean/)
    assert.match(source, /payload:\s*buildTemplateReviewPayload/)
  }

  assert.match(provider, /item\.reviewTitle \|\| item\.fileName/)
  assert.match(provider, /\^review\.\?title\$/i)
  assert.match(provider, /title: 'Template Documents'/)
  assert.match(provider, /Verify every selected document and whether it is Required or Optional\./)
})

test('template review has a dedicated template information step', () => {
  const addTemplate = read('client/src/components/System/documentComponents/DocumentAddTemplate.jsx')
  const editTemplate = read('client/src/components/System/documentComponents/EditDocumentTemplate.jsx')
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx')

  for (const source of [addTemplate, editTemplate]) {
    assert.match(source, /templateInformation:/)
    assert.match(source, /templateName:/)
    assert.match(source, /templateDescription:/)
    assert.match(source, /templateStatus:/)
  }

  assert.match(provider, /title: 'Template Information'/)
  assert.match(provider, /Verify the template name, description, and status before continuing\./)
})

test('empty review messaging is clear and nested-only sections do not show a misleading empty warning', () => {
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx')

  assert.doesNotMatch(provider, /No user-facing fields are available in this section\./)
  assert.match(provider, /There are no additional details to review in this section\./)
  assert.match(provider, /hideWhenEmpty=\{nestedEntries\.length > 0\}/)
  assert.match(provider, /No documents are selected for this template\./)
  assert.match(provider, /No files are selected\./)
})

test('template review cancellation is informational and does not claim data was saved', () => {
  const addTemplate = read('client/src/components/System/documentComponents/DocumentAddTemplate.jsx')
  const editTemplate = read('client/src/components/System/documentComponents/EditDocumentTemplate.jsx')

  for (const source of [addTemplate, editTemplate]) {
    assert.match(source, /isReviewCancelled/)
    assert.match(source, /type: 'info'/)
    assert.match(source, /nothing was saved/i)
    assert.match(source, /Preparing template review\.\.\./)
    assert.match(source, /Opening Review\.\.\./)
  }
})

test('empty document-library search state explains whether the search or selection caused it', () => {
  const addTemplate = read('client/src/components/System/documentComponents/DocumentAddTemplate.jsx')
  const editTemplate = read('client/src/components/System/documentComponents/EditDocumentTemplate.jsx')

  for (const source of [addTemplate, editTemplate]) {
    assert.match(source, /No active documents match your search\./)
    assert.match(source, /No additional active documents are available to add\./)
    assert.match(source, /No active documents are available in the Document Library\./)
    assert.doesNotMatch(source, /No available documents found\./)
  }
})
