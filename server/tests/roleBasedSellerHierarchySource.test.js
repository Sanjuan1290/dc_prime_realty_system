import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('reservation template selection filters the document library without loading the full template', async () => {
  const [modalSource, reservationSource] = await Promise.all([
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveDocumentChecklistModal.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx'),
  ]);

  assert.match(modalSource, /<option value="">All documents<\/option>/);
  assert.doesNotMatch(modalSource, /Load from Template/);
  assert.doesNotMatch(modalSource, /loadSelectedTemplate/);
  assert.match(reservationSource, /selectedTemplateDocumentIds/);
  assert.match(reservationSource, /selectedTemplateDocumentIds\.has\(documentId\)/);
});

test('seller group details can add a user directly into the current group', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.match(source, />Add User<\/button>/);
  assert.match(source, /<CreateUserModal/);
  assert.match(source, /initialSellerGroupId=\{String\(group\.id \|\| groupId\)\}/);
  assert.match(source, /lockSellerGroup/);
});

test('create and edit user screens filter reporting parents and inherit Realty rates', async () => {
  const [createSource, editSource] = await Promise.all([
    readSource('../../client/src/components/System/userComponents/CreateUserModal.jsx'),
    readSource('../../client/src/components/System/userComponents/EditUserModal.jsx'),
  ]);

  for (const source of [createSource, editSource]) {
    assert.match(source, /broker:\s*"broker_network_manager"/);
    assert.match(source, /manager:\s*"broker"/);
    assert.match(source, /agent:\s*"manager"/);
    assert.match(source, /seller\.role === getRequiredParentRole\(form\.role\)/);
    assert.match(source, /Inherited Commission Rates/);
    assert.doesNotMatch(source, /Sales Commission Rate/);
    assert.doesNotMatch(source, /Override Commission Rate/);
    assert.doesNotMatch(source, /project_rates:/);
  }
});

test('group-head screens only offer BNM or Broker accounts', async () => {
  const [newGroupSource, editGroupSource] = await Promise.all([
    readSource('../../client/src/components/System/sellerGroupComponents/NewGroupModal.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/EditGroupModal.jsx'),
  ]);

  for (const source of [newGroupSource, editGroupSource]) {
    assert.match(source, /\['broker_network_manager', 'broker'\]\.includes\(seller\.role\)/);
  }
});

test('individual seller rate editing is absent from the Realty details page', async () => {
  const source = await readSource('../../client/src/pages/System/SellerGroupDetails.jsx');

  assert.doesNotMatch(source, /MemberRatesModal/);
  assert.doesNotMatch(source, /Edit Rate/);
  assert.match(source, /Rates are not repeated per seller/);
});

test('seller group routes no longer expose system direct-sales-agent creation', async () => {
  const source = await readSource('../routers/System/sellerGroup.routers.js');

  assert.doesNotMatch(source, /direct-sales-agents/);
  assert.doesNotMatch(source, /createDirectSalesAgent/);
  assert.doesNotMatch(source, /toggleDirectSalesAgentStatus/);
});

test('fixed-rate migration stores all role rates on the Realty project row', async () => {
  const source = await readSource('../migrations/20260720_group_fixed_project_commission_rates.sql');

  assert.match(source, /bnm_override_rate/);
  assert.match(source, /broker_override_rate/);
  assert.match(source, /manager_override_rate/);
  assert.match(source, /agent_rate/);
  assert.match(source, /single source of truth/);
  assert.match(source, /chk_group_fixed_role_rates_total/);
});

test('top-level BNM or Broker accounts become the group head and reservation previews require a complete chain', async () => {
  const [usersSource, groupsSource, commissionSource, createUserSource] = await Promise.all([
    readSource('../controllers/System/users.controllers.js'),
    readSource('../controllers/System/sellerGroup.controller.js'),
    readSource('../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js'),
    readSource('../../client/src/components/System/userComponents/CreateUserModal.jsx'),
  ]);

  assert.match(usersSource, /assignTopLevelSellerAsGroupHead/);
  assert.match(usersSource, /isGroupHeadRole\(role\) && !normalizedReportsUnderUserId/);
  assert.match(groupsSource, /UPDATE seller_groups SET seller_group_head_user_id = \?/);
  assert.match(groupsSource, /previousHead\.role === 'broker'/);
  assert.match(commissionSource, /requireGroupHead: true/);
  assert.match(commissionSource, /validateSellerReportingChain/);
  assert.match(createUserSource, /canReplaceBrokerHead/);
});
