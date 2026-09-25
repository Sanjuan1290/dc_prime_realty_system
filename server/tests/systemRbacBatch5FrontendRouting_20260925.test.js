import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../client/src/App.jsx');
const clientPermissions = read('../../client/src/config/permissions.js');
const protectedRoute = read('../../client/src/components/Auth/ProtectedPermissionRoute.jsx');
const systemLayout = read('../../client/src/layout/SystemLayout.jsx');
const lotLayout = read('../../client/src/layout/LotLayout.jsx');
const login = read('../../client/src/auth/Login.jsx');
const changePassword = read('../../client/src/auth/ChangePassword.jsx');
const workspaceList = read('../../client/src/pages/System/ProjectWorkspaceList.jsx');
const projectsPage = read('../../client/src/pages/System/Projects.jsx');
const documentsPage = read('../../client/src/pages/System/Documents.jsx');
const listingsPage = read('../../client/src/pages/Lot_Projects/Listings.jsx');
const listingProfilePage = read('../../client/src/pages/Lot_Projects/ListingProfile.jsx');
const paymentsSoa = read('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
const commissionPage = read('../../client/src/pages/Lot_Projects/Commission.jsx');
const releaseModal = read('../../client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const accreditedPage = read('../../client/src/pages/System/Accredited.jsx');
const lotSettingsPage = read('../../client/src/pages/Lot_Projects/Settings.jsx');
const settingsAuthModal = read('../../client/src/components/Shared/SettingsAuthorizationModal.jsx');
const usersController = read('../controllers/System/users.controllers.js');
const listingProfileController = read('../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
const settingsController = read('../controllers/Lot_Projects/Settings/Settings.controller.js');
const projectsRouter = read('../routers/System/projects.routers.js');

test('all six system roles share one permission-controlled route tree', () => {
  assert.match(app, /SYSTEM_USER_ROLES\.map\(\(role\) =>/);
  assert.match(app, /path=\{`\/portal\/\$\{role\}`\}/);
  assert.match(app, /protect\(PERMISSIONS\.SYSTEM_REPORTS_VIEW/);
  assert.match(app, /protect\(PERMISSIONS\.LOT_PROJECT_VIEW/);
  assert.match(app, /path="\/portal\/access-denied"/);
});

test('direct React routes enforce permission and project scope', () => {
  assert.match(protectedRoute, /hasPermission\(user, permission\)/);
  assert.match(protectedRoute, /projectScoped/);
  assert.match(protectedRoute, /hasProjectScope\(user, projectSlug\)/);
  assert.match(protectedRoute, /\/portal\/access-denied/);
  assert.match(app, /<LotListings \/>, \{ projectScoped: true \}/);
  assert.match(app, /<LotCommission \/>, \{ projectScoped: true \}/);
  assert.match(app, /<ProjectPriceListPrintPage \/>, \{ projectScoped: true \}/);
});

test('system role URLs canonicalize to the signed-in account role', () => {
  assert.match(systemLayout, /SYSTEM_USER_ROLES\.includes\(requestedRole\)/);
  assert.match(systemLayout, /requestedRole !== user\.role/);
  assert.match(systemLayout, /canonicalPath = suffix \? `\/portal\/\$\{user\.role\}\/\$\{suffix\}` : `\/portal\/\$\{user\.role\}`/);
});

test('login supports email or account code and lands on first permitted module', () => {
  assert.match(login, /Email or Account Code/);
  assert.match(login, /identifier/);
  assert.match(login, /getFirstAllowedSystemPath/);
  assert.match(changePassword, /getFirstAllowedSystemPath/);
  assert.match(clientPermissions, /SYSTEM_LANDING_CANDIDATES/);
});

test('project workspace selection lands on the first allowed project tab', () => {
  assert.match(clientPermissions, /LOT_PROJECT_LANDING_CANDIDATES/);
  assert.match(clientPermissions, /getFirstAllowedLotProjectPath/);
  assert.match(workspaceList, /getFirstAllowedLotProjectPath\(user, slug\)/);
  assert.match(lotLayout, /\.filter\(\(item\) => hasPermission\(user, item\.permission\)\)/);
});

test('current-user hydration includes selected project slugs for client scope guards', () => {
  assert.match(usersController, /hydrateAdminProjectAccess\(\[user\]\)/);
  assert.match(clientPermissions, /Array\.isArray\(user\.projects\)/);
  assert.match(clientPermissions, /project\?\.slug \|\| project\?\.lot_project_slug/);
});

test('global project, document, and listing actions use independent granular permissions', () => {
  assert.match(projectsPage, /SYSTEM_PROJECTS_CREATE/);
  assert.match(projectsPage, /SYSTEM_PROJECTS_EDIT/);
  assert.match(projectsPage, /SYSTEM_PROJECTS_DELETE/);
  assert.match(documentsPage, /SYSTEM_DOCUMENTS_CREATE/);
  assert.match(documentsPage, /SYSTEM_DOCUMENTS_EDIT/);
  assert.match(documentsPage, /SYSTEM_DOCUMENTS_DELETE/);
  assert.match(listingsPage, /LOT_LISTINGS_IMPORT/);
  assert.match(listingsPage, /LOT_LISTINGS_IMPORT_UNDO/);
  assert.match(listingsPage, /LOT_LISTINGS_CREATE/);
  assert.match(listingsPage, /LOT_LISTINGS_DELETE/);
  assert.match(listingsPage, /LOT_LISTING_PROFILE_VIEW/);
});

test('listing profile hides protected tabs/actions and payment actions are independently gated', () => {
  for (const permission of [
    'LOT_BUYER_PROFILE_EDIT', 'LOT_PAYMENTS_VIEW', 'LOT_PAYMENTS_CREATE', 'LOT_PAYMENTS_EDIT',
    'LOT_PAYMENT_DELETE', 'LOT_BUYER_DOCUMENTS_VIEW', 'LOT_BUYER_DOCUMENTS_UPDATE',
    'LOT_ACCOUNT_HISTORY_VIEW', 'LOT_PRINTOUTS_USE', 'LOT_COMMISSIONS_VIEW',
  ]) assert.match(listingProfilePage, new RegExp(permission));
  assert.match(listingProfilePage, /visibleTabs/);
  assert.match(paymentsSoa, /canCreate = false/);
  assert.match(paymentsSoa, /canEdit = false/);
  assert.match(paymentsSoa, /canDelete = false/);
});

test('listing-profile API no longer leaks payments, documents, or commission data without their view permissions', () => {
  assert.match(listingProfileController, /canViewPayments/);
  assert.match(listingProfileController, /canViewDocuments/);
  assert.match(listingProfileController, /canViewCommissions/);
  assert.match(listingProfileController, /canViewPayments[\s\S]*await getListingPayments/);
  assert.match(listingProfileController, /canViewDocuments[\s\S]*await getListingDocuments/);
  assert.match(listingProfileController, /canViewCommissions[\s\S]*await loadListingCommissionSnapshot/);
  assert.match(listingProfileController, /if \(!canViewPayments\)[\s\S]*balance: 'Restricted'/);
});

test('commission release, hold, and unhold remain independent in the UI', () => {
  assert.match(commissionPage, /LOT_COMMISSIONS_RELEASE/);
  assert.match(commissionPage, /LOT_COMMISSIONS_HOLD/);
  assert.match(commissionPage, /LOT_COMMISSIONS_UNHOLD/);
  assert.match(releaseModal, /canRelease/);
  assert.match(releaseModal, /canHold/);
  assert.match(releaseModal, /canUnhold/);
});

test('project settings are permission-delegated but retain password plus email-code verification', () => {
  assert.match(projectsRouter, /settings\/code'[\s\S]*LOT_SETTINGS_MANAGE[\s\S]*requireCurrentPassword/);
  assert.doesNotMatch(settingsController, /Only the exact Super Admin can change project settings/);
  assert.match(settingsController, /canEditProjectSettings\(actor\)/);
  assert.match(settingsController, /verifyAndConsumeSensitiveAction\(connection/);
  assert.match(settingsController, /LOT_PROJECT_SETTINGS_ACTION/);
  assert.match(lotSettingsPage, /authorizationLabel="Current Account"/);
  assert.match(settingsAuthModal, /authorizationLabel = 'Super Admin'/);
});

test('accredited seller print/upload UI follows dedicated permissions', () => {
  assert.match(accreditedPage, /SYSTEM_ACCREDITED_PRINT/);
  assert.match(accreditedPage, /SYSTEM_ACCREDITED_UPLOAD_PROOF/);
  assert.match(accreditedPage, /canOpenProofWorkspace/);
  assert.match(accreditedPage, /readOnly=\{!canUpload\}/);
  assert.match(accreditedPage, /\/portal\/accredited\/proof-of-income\/print/);
});
