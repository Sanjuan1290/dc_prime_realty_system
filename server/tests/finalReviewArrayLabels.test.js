import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('final review array cards use contextual titles instead of generic Item numbers', async () => {
  const provider = await readSource('../../client/src/components/Shared/MutationReviewProvider.jsx')

  assert.doesNotMatch(provider, /`Item \$\{index \+ 1\}`/)
  assert.match(provider, /cadastrallots:\s*'Cadastral Lot'/)
  assert.match(provider, /defaultdocuments:\s*'Default Document'/)
  assert.match(provider, /templatedocuments:\s*'Document'/)
  assert.match(provider, /selectedreleases:\s*'Release'/)
  assert.match(provider, /getItemTitle\(item, index, label\)/)
  assert.match(provider, /item\.releaseStage/)
  assert.match(provider, /item\.unitCode/)
  assert.match(provider, /item\.cadastralLotNo/)
})

test('primitive review arrays display the business value in the card title and do not duplicate it below', async () => {
  const provider = await readSource('../../client/src/components/Shared/MutationReviewProvider.jsx')

  assert.match(provider, /return value && value !== 'Not provided' \? `\$\{noun\} \$\{value\}`/)
  assert.match(provider, /const isObjectItem = Boolean\(item && typeof item === 'object'\)/)
  assert.match(provider, /\{isObjectItem \? <ReviewRows object=\{item\} sectionLabel=\{label\} \/> : null\}/)
})

test('project default documents preserve a review-only document title without duplicating requirement flags', async () => {
  const projectModal = await readSource('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx')
  const provider = await readSource('../../client/src/components/Shared/MutationReviewProvider.jsx')

  assert.match(projectModal, /reviewTitle:\s*document\.name \|\| document\.document_name \|\| 'Document'/)
  const defaultDocumentsBlock = projectModal.slice(
    projectModal.indexOf('defaultDocuments: selectedDocuments.map'),
    projectModal.indexOf('})),', projectModal.indexOf('defaultDocuments: selectedDocuments.map')) + 4
  )
  assert.doesNotMatch(defaultDocumentsBlock, /is_required:/)
  assert.match(provider, /review\.\?\(\?:title\|label\)/)
})

test('empty array messages explain the actual business section', async () => {
  const provider = await readSource('../../client/src/components/Shared/MutationReviewProvider.jsx')

  assert.match(provider, /No default documents are selected for this project\./)
  assert.match(provider, /No cadastral lot numbers were added\./)
  assert.match(provider, /No documents are selected for this template\./)
  assert.match(provider, /No commission release stages are selected\./)
})
