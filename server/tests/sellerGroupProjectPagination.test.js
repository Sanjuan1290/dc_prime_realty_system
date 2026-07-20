import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const projectFields = fs.readFileSync(
  path.join(root, 'client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  'utf8'
)
const sellerGroupPage = fs.readFileSync(
  path.join(root, 'client/src/pages/System/SellerGroup.jsx'),
  'utf8'
)
const sellerGroupController = fs.readFileSync(
  path.join(root, 'server/controllers/System/sellerGroup.controller.js'),
  'utf8'
)

test('Realty project accreditation editor displays at most five projects per page', () => {
  assert.match(projectFields, /const PROJECTS_PER_PAGE = 5/)
  assert.match(projectFields, /filteredProjects\.slice\(pageStart, pageStart \+ PROJECTS_PER_PAGE\)/)
  assert.match(projectFields, /Page \{page\} of \{totalPages\}/)
})

test('Realty Records supports project filtering and compact all-project summaries', () => {
  assert.match(sellerGroupPage, /All Projects/)
  assert.match(sellerGroupPage, /project: projectFilter/)
  assert.match(sellerGroupPage, /View all projects/)
  assert.match(sellerGroupPage, /selectedProjectId=\{projectFilter\}/)
})

test('seller group API filters paginated Realty records by active project accreditation', () => {
  assert.match(sellerGroupController, /const projectId = Math\.max\(Number\(req\.query\.project\) \|\| 0, 0\)/)
  assert.match(sellerGroupController, /FROM seller_group_lot_project_rates project_filter/)
  assert.match(sellerGroupController, /project_filter\.seller_group_lot_project_rate_status = 'active'/)
})
