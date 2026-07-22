import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const editUserModal = read('client/src/components/System/userComponents/EditUserModal.jsx')
const sellerGroupDetails = read('client/src/pages/System/SellerGroupDetails.jsx')
const sellerGroupController = read('server/controllers/System/sellerGroup.controller.js')

test('Edit User modal defines and uses a complete initial form mapper', () => {
  assert.match(editUserModal, /const getInitialForm = \(user = \{\}/)
  assert.match(editUserModal, /first_name: String\(user\.first_name/)
  assert.match(editUserModal, /seller_group_id: String\(/)
  assert.match(editUserModal, /reports_under_user_id: String\(/)
  assert.match(editUserModal, /accreditation_date: toDateInput\(/)
  assert.match(editUserModal, /useState\(\(\) => getInitialForm\(selectedUser/)
})

test('Realty Members can open the shared Edit User modal', () => {
  assert.match(sellerGroupDetails, /import EditUserModal/)
  assert.match(sellerGroupDetails, /const openEditMember = \(member\) =>/)
  assert.match(sellerGroupDetails, /Edit User/)
  assert.match(sellerGroupDetails, /showEditUser && selectedMember/)
  assert.match(sellerGroupDetails, /initialSellerGroupId=\{String\(group\.id \|\| groupId\)\}/)
  assert.match(sellerGroupDetails, /lockSellerGroup/)
})

test('Realty member payload includes editable user fields', () => {
  for (const field of ['u.first_name', 'u.middle_name', 'u.last_name', 'u.email', 'u.contact_no', 'u.tin_no', 'u.prc_no', 'u.address', 'accredited_seller_accreditation_date AS accreditation_date']) {
    assert.match(sellerGroupController, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
