import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPANY_PROFIT_STAGES, splitNetworkProfit } from '../services/networkCompanyProfitTerms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (p) => readFileSync(path.join(root, p), 'utf8');
const service = source('server/services/networkCompanyProfit.service.js');
const controller = source('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js');
const files = source('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfitFiles.controller.js');
const schema = source('server/migrations/20261012_network_company_profit_releases.sql');
const projectRoutes = source('server/routers/System/projects.routers.js');
const accreditedRoutes = source('server/routers/System/accredited.routers.js');
const panel = source('client/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx');
const library = source('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitAcknowledgementLibrary.jsx');

test('five Company Profit stages total 100% and match existing seller triggers', () => {
  assert.deepEqual(COMPANY_PROFIT_STAGES.map((x) => x[2]), [20,20,20,15,25]);
  assert.deepEqual(COMPANY_PROFIT_STAGES.map((x) => x[1]), [20,40,60,75,100]);
  for (const amount of [0.01, 0.03, 7_800, 12_345.67, 999_999.99]) {
    const releases = splitNetworkProfit(amount);
    const cents = Math.round(releases.reduce((sum, stage) => sum + stage.amount, 0) * 100);
    assert.equal(cents, Math.round(amount * 100));
  }
});

test('profit is network-account specific and never a seller commission row', () => {
  assert.match(schema, /UNIQUE KEY uq_network_profit_account \(lot_project_account_id, seller_group_id\)/);
  assert.match(schema, /UNIQUE KEY uq_network_profit_stage \(profit_account_id, release_stage\)/);
  assert.match(schema, /network_profit_signed_files/);
  assert.match(service, /seller_group_type !== 'in_house'/);
  assert.match(service, /ON DUPLICATE KEY UPDATE id = id/);
  assert.match(source('server/controllers/Lot_Projects/Commissions/commissionHierarchy.service.js'), /provisionNetworkCompanyProfit/);
});

test('release mutation protects recipient, money, and duplicate commits', () => {
  assert.match(controller, /FOR UPDATE/);
  assert.match(controller, /release_status = 'Pending'/);
  assert.match(controller, /affectedRows !== 1/);
  assert.match(controller, /profit\.payee_name_snapshot/);
  assert.match(controller, /isCancelled\(profit\.account_status\)/);
  assert.match(controller, /allowedSourceStages\.has\(source\?\.release_status\)/);
  assert.match(controller, /writeAuditLog/);
  assert.match(controller, /createOperationalReview/);
  assert.match(controller, /commission\.release/);
  assert.match(projectRoutes, /requirePermission\(PERMISSIONS\.LOT_COMMISSIONS_RELEASE\), releaseNetworkCompanyProfit/);
  assert.match(panel, /doubleCheck: \{ type: 'commission-release'/);
});

test('signed acknowledgments cannot expose files before scanner approval', () => {
  assert.match(files, /verifyAuthenticatedCloudinaryAsset/);
  assert.match(files, /expectedFolder: folderFor\(record\)/);
  assert.match(files, /assetBytes > 15 \* 1024 \* 1024/);
  assert.match(files, /malware\.status === 'rejected'/);
  assert.match(files, /file\.malware_scan_status !== 'approved'/);
  assert.match(files, /SELECT id FROM lot_project_network_profit_releases WHERE id = \? FOR UPDATE/);
  assert.match(source('server/controllers/System/cloudinaryWebhook.controller.js'), /networkCompanyProfitFilesUpdated/);
  assert.match(projectRoutes, /getNetworkProfitSignedContent/);
});

test('Company Profit shares the Commission Details modal but keeps separate document categories in Accredited Sellers', () => {
  assert.match(source('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx'), /<NetworkCompanyProfitPanel/);
  assert.doesNotMatch(source('client/src/pages/Lot_Projects/Commission.jsx'), /<NetworkCompanyProfitPanel/);
  assert.match(source('client/src/pages/System/Accredited.jsx'), /<NetworkProfitAcknowledgementLibrary/);
  assert.match(accreditedRoutes, /network-company-profit-acknowledgments', requirePermission\(PERMISSIONS\.SYSTEM_ACCREDITED_VIEW\), requirePermission\(PERMISSIONS\.LOT_COMMISSIONS_VIEW\)/);
  assert.match(panel, /Network Company Profit Release Acknowledgment/);
  assert.match(panel, /not an individual seller's Proof of Income/);
  assert.match(library, /readOnly=\{!canUpload\}/);
  assert.match(source('client/src/pages/System/Accredited.jsx'), /hasPermission\(actor, PERMISSIONS\.LOT_COMMISSIONS_VIEW\)/);
});

test('acknowledgment library enforces the authenticated account project scope', () => {
  assert.match(controller, /getUserProjectAccess\(req\.authUser, connection\)/);
  assert.match(controller, /!access\.allProjects && access\.projectIds\.length === 0/);
  assert.match(controller, /p\.lot_project_id IN/);
  assert.match(controller, /access\.allProjects \? \[\] : access\.projectIds/);
});

test('Network profit review can open the commission workspace rather than a broken record link', () => {
  const links = source('client/src/utils/reviewRecordLinks.js');
  assert.match(links, /type === 'lot_project_network_profit_release'/);
  assert.match(links, /networkProfitReleaseId=/);
});

test('Company Profit controller imports only an actual exported money utility', () => {
  assert.match(controller, /import \{ roundProfitMoney \} from '\.\.\/\.\.\/\.\.\/services\/networkCompanyProfitTerms\.js'/);
  assert.match(source('server/services/networkCompanyProfitTerms.js'), /export const roundProfitMoney/);
});
