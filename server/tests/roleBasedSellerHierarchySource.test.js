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

test('create and edit user screens filter reporting parents to the exact required role', async () => {
  const [createSource, editSource] = await Promise.all([
    readSource('../../client/src/components/System/userComponents/CreateUserModal.jsx'),
    readSource('../../client/src/components/System/userComponents/EditUserModal.jsx'),
  ]);

  for (const source of [createSource, editSource]) {
    assert.match(source, /broker:\s*"broker_network_manager"/);
    assert.match(source, /manager:\s*"broker"/);
    assert.match(source, /agent:\s*"manager"/);
    assert.match(source, /seller\.role === getRequiredParentRole\(form\.role\)/);
    assert.match(source, /role === "agent" \? "Sales Commission Rate" : "Override Commission Rate"/);
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

test('member rate editor exposes one role-specific rate field', async () => {
  const source = await readSource('../../client/src/components/System/sellerGroupComponents/MemberRatesModal.jsx');

  assert.match(source, /isAgent \? 'Sales Commission Rate' : 'Override Commission Rate'/);
  assert.match(source, /onSubmit\?\.\(\{ rate: numericRate, rateStatus \}\)/);
  assert.doesNotMatch(source, /Parent Override Rate/);
  assert.doesNotMatch(source, /Direct Commission Rate/);
});

test('seller group routes no longer expose system direct-sales-agent creation', async () => {
  const source = await readSource('../routers/System/sellerGroup.routers.js');

  assert.doesNotMatch(source, /direct-sales-agents/);
  assert.doesNotMatch(source, /createDirectSalesAgent/);
  assert.doesNotMatch(source, /toggleDirectSalesAgentStatus/);
});

test('role-rate migration mirrors agent sales rates and parent override rates', async () => {
  const source = await readSource('../migrations/20260719_role_based_seller_rates.sql');

  assert.match(source, /user\.role = 'agent'/);
  assert.match(source, /user\.role IN \('manager', 'broker', 'broker_network_manager'\)/);
  assert.match(source, /INSERT INTO agent_lot_project_direct_rates/);
  assert.match(source, /INSERT INTO seller_hierarchy_lot_project_overrides/);
  assert.match(source, /BNM -> Broker -> Manager -> Agent/);
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

