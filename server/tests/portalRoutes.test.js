import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('all internal route groups live below /portal', () => {
  const app = read('client/src/App.jsx');

  assert.match(app, /<Route path="\/portal" element=\{<Login \/>\}/);
  assert.match(app, /<Route path="\/portal\/change-password" element=\{<ChangePassword \/>\}/);
  assert.match(app, /<Route path="\/portal\/super_admin" element=\{<SystemLayout \/>\}/);
  assert.match(app, /<Route path="\/portal\/admin" element=\{<SystemLayout \/>\}/);
  assert.match(app, /path="\/portal\/lot-projects\/:projectSlug"/);
  assert.match(app, /path="\/portal\/employee-payroll\/release\/print"/);
  assert.match(app, /path="\/portal\/employee-payroll\/logbook\/print"/);
  assert.match(app, /<Route path="\/buyer-form\/:token" element=\{<BuyerForm \/>\}/);
});

test('login, password, permission, and layout redirects use /portal', () => {
  const login = read('client/src/auth/Login.jsx');
  const changePassword = read('client/src/auth/ChangePassword.jsx');
  const permissionRoute = read('client/src/components/Auth/ProtectedPermissionRoute.jsx');
  const permissions = read('client/src/config/permissions.js');
  const systemLayout = read('client/src/layout/SystemLayout.jsx');
  const lotLayout = read('client/src/layout/LotLayout.jsx');

  assert.match(login, /navigate\(`\/portal\/\$\{user\.role\}`/);
  assert.match(login, /Navigate to=\{`\/portal\/\$\{currentUser\.user\.role\}`\}/);
  assert.match(changePassword, /`\/portal\/\$\{role \|\| 'super_admin'\}`/);
  assert.match(permissionRoute, /Navigate to="\/portal"/);
  assert.match(permissions, /'\/portal\/admin\/dashboard'/);
  assert.match(permissions, /'\/portal\/super_admin'/);
  assert.match(systemLayout, /const roleBasePath = `\/portal\/\$\{user\?\.role/);
  assert.match(lotLayout, /const basePath = `\/portal\/lot-projects\/\$\{projectSlug\}`/);
});

test('server-generated frontend links include the portal prefix', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const projects = read('server/controllers/System/projects.controller.js');
  const notifications = read('server/controllers/System/notifications.controller.js');
  const users = read('server/controllers/System/users.controllers.js');

  assert.match(shared, /routePath: `\/portal\/lot-projects\/\$\{project\.lot_project_slug\}`/);
  assert.match(projects, /routePath: `\/portal\/lot-projects\//);
  assert.match(notifications, /`\/portal\/lot-projects\/\$\{row\.lot_project_slug\}\/listings\//);
  assert.match(users, /\/portal\/change-password on next login/);
});
