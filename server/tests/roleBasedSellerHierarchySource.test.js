import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('reservation checklist visibly shows templates and adds missing template documents without replacing saved listing requirements', async () => {
  const [modalSource, reservationSource] = await Promise.all([
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveDocumentChecklistModal.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx'),
  ]);

  assert.match(modalSource, /Document Templates/);
  assert.match(modalSource, /Add Template/);
  assert.match(modalSource, /already selected/);
  assert.match(modalSource, /Existing document requirements stay unchanged/);
  assert.match(reservationSource, /reservationDocumentTemplates/);
  assert.match(reservationSource, /normalizeTemplateRequirement/);
  assert.match(reservationSource, /const addTemplateDocuments = \(template\) =>/);
  assert.match(reservationSource, /filter\(\(document\) => !isDocumentAdded/);
  assert.doesNotMatch(reservationSource, /selectedTemplateDocumentIds/);
});

test('in-house group details can add a member directly into the current group', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Add Member/);
  assert.match(source, /<CreateUserModal/);
  assert.match(source, /initialSellerGroupId=\{String\(group\.id \|\| groupId\)\}/);
  assert.match(source, /lockSellerGroup/);
  assert.match(source, /allowedRoles=\{\[[\s\S]*'division_manager'[\s\S]*'sales_director'[\s\S]*'unit_manager'[\s\S]*'sales_agent'[\s\S]*\]\}/);
});

test('create and edit user screens use the renamed in-house reporting hierarchy', async () => {
  const [createSource, editSource] = await Promise.all([
    readSource('../../client/src/components/System/userComponents/CreateUserModal.jsx'),
    readSource('../../client/src/components/System/userComponents/EditUserModal.jsx'),
  ]);

  for (const source of [createSource, editSource]) {
    assert.match(source, /sales_director:\s*"division_manager"/);
    assert.match(source, /unit_manager:\s*"sales_director"/);
    assert.match(source, /sales_agent:\s*"unit_manager"/);
    assert.match(source, /seller\.role === getRequiredParentRole\(form\.role\)/);
    assert.match(source, /Inherited Commission Rates/);
    assert.doesNotMatch(source, /broker_network_manager/);
  }
});

test('in-house group-head forms offer Division Manager or Sales Director accounts only', async () => {
  const [newGroupSource, editGroupSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
  ]);

  for (const source of [newGroupSource, editGroupSource]) {
    assert.match(source, /\['division_manager', 'sales_director'\]\.includes\(seller\.role\)/);
  }
});

test('group details use fixed project rates rather than per-member rate editing', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, /Project Commission Structure/);
  assert.match(source, /Each member inherits the fixed project rate for their position/);
  assert.doesNotMatch(source, /MemberRatesModal/);
  assert.doesNotMatch(source, /Edit Rate/);
});

test('group routes no longer expose system direct-sales-agent creation', async () => {
  const source = await readSource('../routers/System/sellerGroup.routers.js');

  assert.doesNotMatch(source, /direct-sales-agents/);
  assert.doesNotMatch(source, /createDirectSalesAgent/);
  assert.doesNotMatch(source, /toggleDirectSalesAgentStatus/);
});

test('new migration renames roles and stores both commission structure types', async () => {
  const source = await readSource('../migrations/20260725_in_house_external_groups_and_role_rename.sql');

  assert.match(source, /division_manager_rate/);
  assert.match(source, /sales_director_rate/);
  assert.match(source, /unit_manager_rate/);
  assert.match(source, /sales_agent_rate/);
  assert.match(source, /commission_structure_type/);
  assert.match(source, /seller_group_type/);
  assert.match(source, /external_group/);
});

test('top-level in-house accounts become the group head and previews require a complete chain', async () => {
  const [usersSource, groupsSource, commissionSource] = await Promise.all([
    readSource('../controllers/System/users.controllers.js'),
    readSource('../controllers/System/sellerGroup.controller.js'),
    readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js'),
  ]);

  assert.match(usersSource, /assignTopLevelSellerAsGroupHead/);
  assert.match(usersSource, /isGroupHeadRole\(role\) && !normalizedReportsUnderUserId/);
  assert.match(groupsSource, /UPDATE seller_groups SET seller_group_head_user_id = \?/);
  assert.match(groupsSource, /previousHead\.role === 'sales_director'/);
  assert.match(commissionSource, /requireGroupHead: true/);
  assert.match(commissionSource, /Only active Sales Agents can be assigned/);
});


