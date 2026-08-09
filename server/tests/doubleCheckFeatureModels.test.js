import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('project review separates API payload from named review documents and shows real cadastral numbers', () => {
  const modal = read('client/src/components/System/projectComponents/AddLotProjectModal.jsx')
  const review = read('client/src/components/Shared/DoubleCheckComponents/ProjectDoubleCheck.jsx')
  assert.match(modal, /const apiPayload = \{/)
  assert.match(modal, /const reviewData = \{/)
  assert.match(modal, /await onSave\(apiPayload, reviewData\)/)
  assert.doesNotMatch(modal, /reviewTitle:/)
  assert.match(review, /Cadastral Lot/)
  assert.match(review, /pick\(document, 'reviewTitle', 'name', 'document_name'\)/)
})

test('listing document state is canonical and review never exposes database aliases or timestamps', () => {
  const add = read('client/src/components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx')
  const editDocs = read('client/src/components/Lot_Projects/ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal.jsx')
  const reserve = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const unit = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx')
  const review = read('client/src/components/Shared/DoubleCheckComponents/ListingDoubleCheck.jsx')
  for (const source of [add, editDocs, reserve, unit]) {
    const normalizeStart = source.indexOf('normalizeDocument') >= 0 ? source.indexOf('normalizeDocument') : source.indexOf('normalizeListingDocument')
    const window = source.slice(normalizeStart, normalizeStart + 1500)
    assert.doesNotMatch(window, /\.\.\.document/)
  }
  assert.doesNotMatch(review, /document_is_reusable|document_created_at|document_updated_at|lot_project_default_document_is_required|lot_project_default_document_status/)
  assert.match(review, /document\.name/)
  assert.match(review, /document\.source/)
  assert.match(review, /requirementLabel/)
})

test('seller group project rates use project names and never synthesize titles from pool rates', () => {
  const review = read('client/src/components/Shared/DoubleCheckComponents/SellerGroupDoubleCheck.jsx')
  const create = read('client/src/components/System/sellerGroupComponents/NewGroupModal.jsx')
  const edit = read('client/src/components/System/sellerGroupComponents/EditGroupModal.jsx')
  assert.match(review, /projectName/)
  assert.doesNotMatch(review, /Seller Group Pool Rate:/)
  assert.match(create, /projectName:/)
  assert.match(edit, /projectName:/)
})

test('reservation review explicitly covers buyer, document, financial and seller sections', () => {
  const source = read('client/src/components/Shared/DoubleCheckComponents/ReservationDoubleCheck.jsx')
  assert.match(source, /principalBuyerReviewFields/)
  assert.match(source, /buyerEmploymentReviewFields/)
  assert.match(source, /secondBuyerReviewFields/)
  for (const phrase of ['Listing & Pricing', 'Buyer Information', 'Document Checklist', 'Payment Terms & Financials', 'Seller Assignment']) {
    assert.match(source, new RegExp(phrase.replace(/[&]/g, '\\&')))
  }
})

test('feature-specific reviews omit known non-user implementation fields', () => {
  const attendance = read('client/src/components/Shared/DoubleCheckComponents/AttendanceDoubleCheck.jsx')
  const cashAdvance = read('client/src/components/Shared/DoubleCheckComponents/CashAdvanceDoubleCheck.jsx')
  const buyerForm = read('client/src/components/Shared/DoubleCheckComponents/BuyerFormDoubleCheck.jsx')
  const commission = read('client/src/components/Shared/DoubleCheckComponents/CommissionReleaseDoubleCheck.jsx')
  assert.doesNotMatch(attendance, /label=['\"]Source['\"]/)
  assert.doesNotMatch(cashAdvance, /label=['\"]Status['\"]/)
  assert.doesNotMatch(buyerForm, /Submitted At|label=['\"]Action['\"]/)
  assert.doesNotMatch(commission, /Can Release|Can Hold|Can Unhold|Release Button Label|Retention Ready|Payment Complete/)
  assert.match(commission, /Selected Release/)
})

test('user review conditionally displays admin type and employee review renders named work days', () => {
  const user = read('client/src/components/Shared/DoubleCheckComponents/UserDoubleCheck.jsx')
  const employee = read('client/src/components/Shared/DoubleCheckComponents/EmployeeDoubleCheck.jsx')
  assert.match(user, /role.*admin|admin.*role/i)
  assert.match(user, /Admin Type/)
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) assert.match(employee, new RegExp(day))
})

test('document template and upload reviews preserve meaningful names and local file preview', () => {
  const template = read('client/src/components/Shared/DoubleCheckComponents/DocumentTemplateDoubleCheck.jsx')
  const upload = read('client/src/components/Shared/DoubleCheckComponents/DocumentUploadDoubleCheck.jsx')
  assert.match(template, /templateName|template_name/)
  assert.match(template, /pick\(document, 'documentName', 'document_name', 'name', 'reviewTitle'\)/)
  const listCard = read('client/src/components/Shared/DoubleCheckComponents/core/DoubleCheckListCard.jsx')
  assert.match(upload, /previewUrl/)
  assert.match(listCard, /Preview File/)
})
