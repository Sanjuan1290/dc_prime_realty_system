import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildSellerGroupReviewPayload } from '../../client/src/components/System/sellerGroupComponents/groupReview.js'
import { buildEmployeeReviewPayload } from '../../client/src/components/System/employeeComponents/employeeReview.js'

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('seller group final review preserves the actual project name and normalizes rate values', () => {
  const review = buildSellerGroupReviewPayload({
    groupType: 'in_house',
    groupHeadName: 'Maria Santos',
    projects: [
      { lot_project_id: 10, lot_project_name: 'Luntiang Aguinaldo' },
      { lot_project_id: 20, lot_project_name: 'Pantihan Maragondon' },
    ],
    form: {
      seller_group_name: 'North Star Team',
      seller_group_description: 'Internal sales team',
      seller_group_status: 'active',
      project_rates: [
        {
          lot_project_id: 10,
          seller_group_pool_rate: '8',
          division_manager_rate: '1',
          sales_director_rate: '1',
          unit_manager_rate: '1',
          sales_agent_rate: '5.00',
        },
        {
          lot_project_id: 20,
          seller_group_pool_rate: 8,
          division_manager_rate: 1,
          sales_director_rate: 1,
          unit_manager_rate: 1,
          sales_agent_rate: 5,
        },
      ],
    },
  })

  assert.equal(review.groupInformation.groupName, 'North Star Team')
  assert.equal(review.groupInformation.groupHead, 'Maria Santos')
  assert.equal(review.projectRates[0].reviewTitle, 'Luntiang Aguinaldo')
  assert.equal(review.projectRates[1].reviewTitle, 'Pantihan Maragondon')
  assert.equal(review.projectRates[0].poolRate, 8)
  assert.equal(review.projectRates[0].salesAgentRate, 5)
  assert.equal('lot_project_id' in review.projectRates[0], false)
  assert.equal('commission_structure_type' in review.projectRates[0], false)
})

test('external group review shows the project name and only the applicable pool rate', () => {
  const review = buildSellerGroupReviewPayload({
    groupType: 'external',
    projects: [{ lot_project_id: 7, lot_project_name: 'Prime Enclave' }],
    form: {
      seller_group_name: 'ABC Realty',
      seller_group_status: 'active',
      project_rates: [{ lot_project_id: 7, seller_group_pool_rate: 9 }],
      external_account: {
        first_name: 'Ana',
        middle_name: '',
        last_name: 'Reyes',
        email: 'ana@example.com',
        contact_no: '09171234567',
        tin_no: '123',
        prc_no: '456',
        address: 'Cavite',
      },
    },
  })

  assert.equal(review.projectRates[0].reviewTitle, 'Prime Enclave')
  assert.deepEqual(Object.keys(review.projectRates[0]), ['reviewTitle', 'poolRate'])
  assert.equal(review.externalRepresentative.firstName, 'Ana')
  assert.equal(review.groupInformation.groupType, 'External Group')
})

test('employee final review converts numeric work days into actual weekday names', () => {
  const review = buildEmployeeReviewPayload({
    employee_code: 'EMP-0001',
    first_name: 'Juan',
    middle_name: 'Santos',
    last_name: 'Dela Cruz',
    employment_type: 'part_time',
    employee_status: 'active',
    monthly_salary: 20000,
    work_days: [1, 3, 5],
    shift_start: '08:00',
    shift_end: '17:00',
    break_minutes: 60,
  })

  assert.deepEqual(review.workSchedule.workDays, ['Monday', 'Wednesday', 'Friday'])
  assert.equal(review.employeeInformation.employmentType, 'Part Time')
  assert.equal(review.employeeInformation.status, 'Active')
})

test('group and employee modals use curated review payloads instead of raw arrays', async () => {
  const [newGroup, editGroup, employee] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
    readSource('../../client/src/components/System/employeeComponents/EmployeeModal.jsx'),
  ])

  for (const source of [newGroup, editGroup]) {
    assert.match(source, /buildSellerGroupReviewPayload/)
    assert.match(source, /payload:\s*buildSellerGroupReviewPayload/)
    assert.match(source, /Preparing \$\{groupLabel\} review/)
    assert.match(source, /Opening Review\.\.\./)
  }

  assert.match(employee, /buildEmployeeReviewPayload/)
  assert.match(employee, /payload:\s*buildEmployeeReviewPayload\(payload\)/)
  assert.match(employee, /Preparing employee review/)
})

test('shared array titles only use identifier-like fields and never arbitrary business values', async () => {
  const provider = await readSource('../../client/src/components/Shared/MutationReviewProvider.jsx')

  assert.doesNotMatch(provider, /getMeaningfulItemScalar/)
  assert.match(provider, /projectrates:\s*'Project'/)
  assert.match(provider, /workdays:\s*'Work Day'/)
  assert.match(provider, /item\.lot_project_name/)
  assert.match(provider, /item\.seller_group_name/)
  assert.match(provider, /item\.employee_name/)
  assert.match(provider, /Never promote an arbitrary amount, rate, status/)
  assert.match(provider, /No accredited projects are selected for this group\./)
  assert.match(provider, /No work days are selected for this employee\./)
})

test('known array-based final-review flows preserve real business labels instead of relying on fallback titles', async () => {
  const [
    projectModal,
    addTemplate,
    reservation,
    listingEditor,
    accredited,
    documentUpload,
    paymentProof,
  ] = await Promise.all([
    readSource('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx'),
    readSource('../../client/src/components/System/documentComponents/DocumentAddTemplate.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx'),
    readSource('../../client/src/pages/System/Accredited.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Documents/UploadDocumentModal.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx'),
  ])

  assert.match(projectModal, /reviewTitle:\s*document\.name \|\| document\.document_name/)
  assert.match(addTemplate, /reviewTitle:\s*document\.document_name/)
  assert.match(reservation, /name:\s*document\.name \|\| document\.document_name/)
  assert.match(listingEditor, /name:\s*document\.name \|\| document\.document_name/)
  assert.match(accredited, /selectedReleases/)
  assert.match(documentUpload, /fileName:\s*file\.name/)
  assert.match(paymentProof, /fileName:\s*file\.name/)
})
