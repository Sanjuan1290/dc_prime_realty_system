import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('project review separates API payload from named review documents and shows real cadastral numbers', () => {
  const modal = read('CLIENT/SYSTEM/src/components/System/projectComponents/AddLotProjectModal.jsx')
  const review = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/ProjectDoubleCheck.jsx')
  assert.match(modal, /const apiPayload = \{/)
  assert.match(modal, /const reviewData = \{/)
  assert.match(modal, /await onSave\(apiPayload, reviewData\)/)
  assert.doesNotMatch(modal, /reviewTitle:/)
  assert.match(review, /Cadastral Lot/)
  assert.match(review, /pick\(document, 'reviewTitle', 'name', 'document_name'\)/)
})

test('listing document state is canonical and review never exposes database aliases or timestamps', () => {
  const add = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx')
  const editDocs = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal.jsx')
  const reserve = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const unit = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx')
  const review = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/ListingDoubleCheck.jsx')
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
  const review = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/SellerGroupDoubleCheck.jsx')
  const create = read('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/NewGroupModal.jsx')
  const edit = read('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/EditGroupModal.jsx')
  assert.match(review, /projectName/)
  assert.doesNotMatch(review, /Seller Group Pool Rate:/)
  assert.match(create, /projectName:/)
  assert.match(edit, /projectName:/)
})

test('reservation review explicitly covers buyer, document, financial and seller sections', () => {
  const source = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/ReservationDoubleCheck.jsx')
  assert.match(source, /principalBuyerReviewFields/)
  assert.match(source, /buyerEmploymentReviewFields/)
  assert.match(source, /secondBuyerReviewFields/)
  for (const phrase of ['Listing & Pricing', 'Buyer Information', 'Document Checklist', 'Payment Terms & Financials', 'Seller Assignment']) {
    assert.match(source, new RegExp(phrase.replace(/[&]/g, '\\&')))
  }
})

test('feature-specific reviews omit known non-user implementation fields', () => {
  const buyerForm = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/BuyerFormDoubleCheck.jsx')
  const commission = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/CommissionReleaseDoubleCheck.jsx')
  assert.doesNotMatch(buyerForm, /Submitted At|label=['\"]Action['\"]/)
  assert.doesNotMatch(commission, /Can Release|Can Hold|Can Unhold|Release Button Label|Retention Ready|Payment Complete/)
  assert.match(commission, /Selected Release/)
})

test('user review displays generalized project scope without depending on the removed Admin role', () => {
  const user = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/UserDoubleCheck.jsx')
  assert.match(user, /Project Access/)
  assert.match(user, /projectNames/)
  assert.match(user, /all_projects_access/)
  assert.doesNotMatch(user, /String\(role\).*===.*['"]admin['"]/i)
  assert.doesNotMatch(user, /Admin Type/)
})

test('document template and upload reviews preserve meaningful names and local file preview', () => {
  const template = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/DocumentTemplateDoubleCheck.jsx')
  const upload = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/DocumentUploadDoubleCheck.jsx')
  assert.match(template, /templateName|template_name/)
  assert.match(template, /pick\(document, 'documentName', 'document_name', 'name', 'reviewTitle'\)/)
  const listCard = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/core/DoubleCheckListCard.jsx')
  assert.match(upload, /previewUrl/)
  assert.match(listCard, /Preview File/)
})

test('payment review omits redundant SOA row labels while retaining account and payment values', () => {
  const payment = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/PaymentDoubleCheck.jsx')
  assert.doesNotMatch(payment, /Apply To SOA Row|label: ['"]SOA Row['"]/)
  assert.match(payment, /Account Reference/)
  assert.match(payment, /Payment Type/)
  assert.match(payment, /Payment Date/)
})



