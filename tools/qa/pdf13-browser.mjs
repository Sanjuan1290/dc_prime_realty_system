// Render production React components with synthetic fixtures and loopback-only APIs.
import { chromium } from 'playwright-core';
import { createServer } from '../../CLIENT/SYSTEM/node_modules/vite/dist/node/index.js';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = resolve(root, 'QA_REPORTS/.runtime/pdf13');
const output = resolve(root, 'QA_REPORTS/evidence/pdf13');
mkdirSync(runtime, { recursive: true });
mkdirSync(output, { recursive: true });
const file = path => resolve(root, path).replaceAll('\\', '/');
const entry = resolve(runtime, 'harness.jsx');
writeFileSync(entry, `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter} from 'react-router-dom';
import BulkEditMembersModal from ${JSON.stringify(file('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/BulkEditMembersModal.jsx'))};
import Projects from ${JSON.stringify(file('CLIENT/SYSTEM/src/pages/System/Projects.jsx'))};
import ReleaseDetailsModal from ${JSON.stringify(file('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx'))};
import {PERMISSIONS} from ${JSON.stringify(file('CLIENT/SYSTEM/src/config/permissions.js'))};
const params=new URLSearchParams(location.search),view=params.get('view')||'bulk',access=params.get('access')||'all',scenario=params.get('scenario')||'';
const baseMember={user_status:'active',accredited_seller_status:'active',is_system_dummy:0};
const agents=Array.from({length:55},(_,index)=>({...baseMember,user_id:index+1,accredited_seller_id:index+101,first_name:'QA Agent',last_name:String(index+1).padStart(3,'0'),role:'sales_agent',account_code:'QA-'+String(index+1).padStart(3,'0'),accredited_seller_reports_under_user_id:101}));
const managers=[{...baseMember,user_id:101,first_name:'Current',last_name:'Manager',role:'unit_manager',account_code:'UM-101'}, {...baseMember,user_id:102,first_name:'New',last_name:'Manager',role:'unit_manager',account_code:'UM-102'}, {...baseMember,user_id:103,first_name:'Inactive',last_name:'Manager',role:'unit_manager',user_status:'inactive'}, {...baseMember,user_id:104,first_name:'Sales',last_name:'Director',role:'sales_director',account_code:'SD-104'}];
const permissions=access==='readonly'?[PERMISSIONS.SYSTEM_PROJECTS_VIEW]:access==='edit'?[PERMISSIONS.SYSTEM_PROJECTS_VIEW,PERMISSIONS.SYSTEM_PROJECTS_EDIT]:access==='delete'?[PERMISSIONS.SYSTEM_PROJECTS_VIEW,PERMISSIONS.SYSTEM_PROJECTS_DELETE]:Object.values(PERMISSIONS);
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});
client.setQueryData(['currentUser'],{user:{id:1,role:access==='all'?'system_admin':'operations_staff',permissions}});
client.setQueryData(['documents'],{documents:[]});client.setQueryData(['templates'],{templates:[],template_documents:[]});client.setQueryData(['lot-project-document-compliance'],{data:{projects:[],units:[]}});
const percent=Number(params.get('percent')??35.04),seller={commissionId:1,seller:'QA Seller',sellerGroupId:1,client:'QA Buyer',unit:'QA-0401',project:'QA Project',tcp:643500,paid:225500,paymentPercent:percent,grossCommission:46800,released:0,releaseMilestones:[]};
client.setQueryData(['network-company-profit','qa-pdf13'],{data:[{id:9,accountId:90001,networkId:1,network:'QA Network',payee:'QA Company',buyer:'QA Buyer',unit:'QA-0401',totalProfit:20000,released:4000,remaining:16000,stages:[]},{id:10,accountId:90002,networkId:1,network:'Other buyer account',payee:'Other company',stages:[]}]});
function App(){const [show,setShow]=useState(true);return view==='projects'?<Projects/>:view==='commission'?<ReleaseDetailsModal projectSlug="qa-pdf13" commissionGroup={{accountId:90001,unit:'QA-0401',client:'QA Buyer',paymentPercent:percent,sellers:[seller]}} onClose={()=>{}} onAction={()=>{}}/>:<><button id="open-bulk" onClick={()=>setShow(true)}>Open bulk edit</button>{show?<BulkEditMembersModal groupId={30001} members={scenario==='no-manager'?agents:[...agents,...managers]} onClose={()=>setShow(false)} onSaved={()=>{window.savedCallbacks=(window.savedCallbacks||0)+1}}/>:null}</>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter><App/></MemoryRouter></QueryClientProvider>);`);
const css = readdirSync(resolve(root, 'CLIENT/SYSTEM/dist/assets')).find(name => name.startsWith('index-') && name.endsWith('.css'));
if (!css) throw new Error('Build the System client before running this browser check.');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/@fs/${file('CLIENT/SYSTEM/dist/assets/' + css)}"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry.replaceAll('\\', '/')}"></script></body></html>`;
const server = await createServer({
  configFile: false, envDir: false, root: resolve(root, 'CLIENT/SYSTEM'),
  resolve: { dedupe: ['react', 'react-dom', '@tanstack/react-query', 'react-router-dom'] }, css: { postcss: { plugins: [] } },
  plugins: [{ name: 'pdf13-fixture', configureServer(dev) { dev.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/') return next();
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  }); } }],
  server: { host: '127.0.0.1', port: 4193, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
let browser;
const checks = [], errors = [], externalRequests = [], writes = [];
const fixtureProjects = [
  { id: 1, name: 'QA Active Project', status: 'active', listing_count: 10, location: 'QA location', cadastralLots: [] },
  { id: 2, name: 'QA Inactive Project', status: 'inactive', listing_count: 5, location: 'QA location', cadastralLots: [] },
  { id: 3, name: 'QA Empty Project', status: 'active', listing_count: 0, location: 'QA location', cadastralLots: [] },
];
let projects = structuredClone(fixtureProjects), rejectedCorrection = false;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { externalRequests.push(url.href); return route.abort(); }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue();
    const path = url.pathname.slice('/api/v1'.length), method = request.method();
    const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (method === 'GET' && path === '/projects/lot-projects') return respond({ success: true, data: projects });
    if (path.endsWith('/members/bulk-edit/preview')) {
      const input = request.postDataJSON();
      return respond({ success: true, data: { manager: { userId: input.newManagerUserId, name: input.newManagerUserId === 104 ? 'Sales Director' : 'New Manager' },
        stateHash: 'synthetic-current-state', headUserId: 104, crossBranch: true,
        items: input.memberUserIds.map(id => ({ userId: id, sellerId: id + 100, name: `QA Agent ${String(id).padStart(3, '0')}`, previousManagerName: 'Current Manager', newManagerName: 'New Manager', previousPath: ['Current Manager', 'Old Director'], newPath: ['New Manager', 'Sales Director'] })) } });
    }
    if (method !== 'GET') writes.push({ path, method, body: request.postData() ? request.postDataJSON() : null });
    if (path.endsWith('/members/bulk-edit/confirm')) {
      if (new URL(page.url()).searchParams.get('scenario') === 'stale' && !rejectedCorrection) {
        rejectedCorrection = true; return respond({ message: 'Member assignments changed. Refresh the preview before continuing.' }, 409);
      }
      return respond({ success: true, message: 'Members updated successfully.', data: { batchId: 70001, changed: request.postDataJSON().memberUserIds.length } });
    }
    const status = path.match(/^\/projects\/lot-projects\/(\d+)\/status$/);
    if (method === 'PATCH' && status) {
      const project = projects.find(item => item.id === Number(status[1])); project.status = request.postDataJSON().status;
      return respond({ success: true, message: `Lot project status changed to ${project.status}.`, status: project.status });
    }
    const deletion = path.match(/^\/projects\/lot-projects\/(\d+)$/);
    if (method === 'DELETE' && deletion) {
      if (new URL(page.url()).searchParams.get('scenario') === 'new-listing') {
        projects.find(item => item.id === Number(deletion[1])).listing_count = 1;
        return respond({ success: false, can_delete: false, listed_units_count: 1, message: 'QA Empty Project has 1 listed unit(s). It cannot be deleted. Change the project status to inactive instead.' }, 409);
      }
      projects = projects.filter(item => item.id !== Number(deletion[1])); return respond({ success: true, message: 'Project deleted successfully.' });
    }
    return respond({ message: `Unexpected fixture request: ${method} ${path}` }, 500);
  });
  const open = async (query = '') => {
    writes.length = 0; projects = structuredClone(fixtureProjects); rejectedCorrection = false;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4193/?' + query);
    if (!new URLSearchParams(query).has('view')) {
      await page.getByRole('dialog', { name: 'Bulk Edit Members', exact: true }).waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close bulk edit');
    }
  };
  const dialog = () => page.getByRole('dialog', { name: 'Bulk Edit Members', exact: true });
  const row = name => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
  const screenshot = name => page.screenshot({ path: resolve(output, name + '.png'), animations: 'disabled' });
  async function chooseOne() {
    await dialog().getByRole('checkbox', { name: 'Select QA Agent 001', exact: true }).check();
    await dialog().getByRole('button', { name: 'Choose Manager', exact: true }).click();
    await dialog().getByLabel('New Manager', { exact: true }).selectOption('102');
    await dialog().getByRole('button', { name: 'Review Changes', exact: true }).click();
    await dialog().getByText('Current reporting line', { exact: true }).waitFor();
  }
  async function check(name, action) {
    try { await action(); checks.push({ name, status: 'PASS' }); }
    catch (error) { checks.push({ name, status: 'FAIL', reason: error.stack }); await screenshot('failure-' + checks.length).catch(() => {}); }
    console.log(JSON.stringify(checks.at(-1)));
  }

  await check('Member selection survives search, status filtering and pagination; only eligible managers appear', async () => {
    await open(); await dialog().waitFor();
    assert.equal(await dialog().getByRole('button', { name: 'Choose Manager', exact: true }).isDisabled(), true);
    await dialog().getByRole('checkbox', { name: 'Select QA Agent 001', exact: true }).check();
    await dialog().getByRole('button', { name: 'Next member page' }).click();
    await dialog().getByRole('checkbox', { name: 'Select QA Agent 021', exact: true }).check();
    await dialog().getByLabel('Search Members', { exact: true }).fill('QA-001');
    assert.equal(await dialog().getByRole('checkbox', { name: 'Select QA Agent 001', exact: true }).isChecked(), true);
    await dialog().getByLabel('Status', { exact: true }).selectOption('inactive');
    await dialog().getByText('No matching members', { exact: true }).waitFor();
    await dialog().getByLabel('Status', { exact: true }).selectOption('all');
    await dialog().getByLabel('Search Members', { exact: true }).fill('');
    await dialog().getByText('2 of 50 selected', { exact: true }).waitFor(); await screenshot('bulk-select-desktop');
    await dialog().getByRole('button', { name: 'Choose Manager', exact: true }).click();
    const managers = await dialog().getByLabel('New Manager', { exact: true }).locator('option').allTextContents();
    assert.ok(managers.some(name => name.includes('New Manager'))); assert.ok(!managers.some(name => name.includes('Inactive Manager')));
    await dialog().getByLabel('New Manager', { exact: true }).selectOption('102'); await screenshot('bulk-manager-desktop');
    assert.equal(writes.length, 0);
  });
  await check('Review explains future commissions, requires the existing acknowledgment and reason, and saves the exact preview', async () => {
    await open(); await chooseOne();
    await dialog().getByText('Future manager commissions may change', { exact: true }).waitFor();
    await dialog().getByText('Current Manager → Old Director', { exact: true }).waitFor();
    await dialog().getByText('New Manager → Sales Director', { exact: true }).waitFor();
    const save = dialog().getByRole('button', { name: 'Confirm Changes', exact: true });
    assert.equal(await save.isDisabled(), true);
    await dialog().getByLabel(/Reason for Change/).fill('Approved reporting reassignment'); assert.equal(await save.isDisabled(), true);
    await dialog().getByRole('checkbox', { name: /I reviewed the reporting changes/ }).check();
    await screenshot('bulk-review-desktop'); await save.click();
    await dialog().getByText('Members updated successfully', { exact: true }).waitFor();
    assert.equal(writes.length, 1); assert.deepEqual(writes[0].body.memberUserIds, [1]);
    assert.equal(writes[0].body.newManagerUserId, 102); assert.equal(writes[0].body.expectedStateHash, 'synthetic-current-state');
    assert.equal(writes[0].body.expectedHeadUserId, 104); assert.equal(writes[0].body.confirmCrossBranch, true);
    assert.match(writes[0].body.requestKey, /^[0-9a-f-]{36}$/i); assert.equal(await page.evaluate(() => window.savedCallbacks), 1);
  });
  await check('Stale-preview errors retain the form, and returning to the preview resets acknowledgment', async () => {
    await open('scenario=stale'); await chooseOne();
    await dialog().getByLabel(/Reason for Change/).fill('Approved new manager');
    await dialog().getByRole('checkbox', { name: /I reviewed the reporting changes/ }).check();
    await dialog().getByRole('button', { name: 'Confirm Changes', exact: true }).click();
    await dialog().getByRole('alert').getByText(/Member assignments changed/).waitFor();
    assert.equal(await dialog().getByLabel(/Reason for Change/).inputValue(), 'Approved new manager');
    await dialog().getByRole('button', { name: 'Back', exact: true }).click();
    await dialog().getByRole('button', { name: 'Review Changes', exact: true }).click();
    assert.equal(await dialog().getByRole('checkbox', { name: /I reviewed the reporting changes/ }).isChecked(), false);
    assert.equal(writes.length, 1);
  });
  await check('Selection remains capped at fifty, including members on other pages', async () => {
    await open();
    for (let index = 0; index < 3; index++) {
      for (const checkbox of await dialog().getByRole('checkbox').all()) if (await checkbox.isEnabled()) await checkbox.check();
      if (index < 2) await dialog().getByRole('button', { name: 'Next member page' }).click();
    }
    await dialog().getByText('50 of 50 selected', { exact: true }).waitFor();
    assert.equal(await dialog().getByRole('checkbox', { name: 'Select QA Agent 055', exact: true }).isDisabled(), true);
    await dialog().getByRole('button', { name: 'Clear selection' }).click();
    await dialog().getByText('0 of 50 selected', { exact: true }).waitFor();
  });
  await check('Mobile steps fit the viewport, retain visible footer actions, and return focus after Escape', async () => {
    await open(); await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'hidden' }); await page.locator('#open-bulk').focus(); await page.locator('#open-bulk').click();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await dialog().evaluate(node => node.getBoundingClientRect().bottom <= innerHeight));
    }
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot('bulk-select-mobile');
    await chooseOne(); await screenshot('bulk-review-mobile');
    const close = dialog().getByRole('button', { name: 'Close bulk edit' }); await close.focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog().getByRole('button', { name: 'Back', exact: true }).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#open-bulk').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  });
  await check('An empty manager list explains why the next step is unavailable', async () => {
    await open('scenario=no-manager');
    await dialog().getByRole('checkbox', { name: 'Select QA Agent 001', exact: true }).check();
    await dialog().getByRole('button', { name: 'Choose Manager', exact: true }).click();
    await dialog().getByText(/No active Unit Manager is available/).waitFor();
    assert.equal(await dialog().getByRole('button', { name: 'Review Changes', exact: true }).isDisabled(), true);
  });
  await check('Company and seller views share buyer progress and omit the duplicate Payment % card', async () => {
    await open('view=commission');
    const progress = page.getByRole('region', { name: 'Total Payment Made', exact: true });
    await progress.getByText('35.04%', { exact: true }).waitFor();
    assert.equal(Number(await progress.getByRole('progressbar').getAttribute('aria-valuenow')), 35.04);
    await screenshot('company-payment-progress');
    const selector = page.getByRole('combobox', { name: 'Select company or seller commission' });
    assert.ok(!(await selector.locator('option').allTextContents()).some(text => text.includes('Other buyer account')));
    await selector.selectOption('seller:1'); await progress.getByText('35.04%', { exact: true }).waitFor();
    assert.equal(await page.getByText('Payment %', { exact: true }).count(), 0);
    await screenshot('seller-payment-progress');
    for (const percent of [0, 100]) { await open('view=commission&percent=' + percent); await progress.getByText(percent.toFixed(2) + '%', { exact: true }).waitFor(); }
  });
  await check('Projects with listings offer status controls; empty projects retain Delete', async () => {
    await open('view=projects'); await row('QA Active Project').getByRole('button', { name: 'Deactivate', exact: true }).waitFor();
    await row('QA Inactive Project').getByRole('button', { name: 'Activate', exact: true }).waitFor();
    await row('QA Empty Project').getByRole('button', { name: 'Delete', exact: true }).waitFor();
    assert.equal(await row('QA Active Project').getByRole('button', { name: 'Delete', exact: true }).count(), 0); await screenshot('project-status-actions');
    page.once('dialog', dialog => dialog.dismiss()); await row('QA Active Project').getByRole('button', { name: 'Deactivate', exact: true }).click();
    assert.equal(writes.length, 0);
    page.once('dialog', dialog => dialog.accept()); await row('QA Active Project').getByRole('button', { name: 'Deactivate', exact: true }).click();
    await row('QA Active Project').getByRole('button', { name: 'Activate', exact: true }).waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].method, 'PATCH'); assert.deepEqual(writes[0].body, { status: 'inactive' });
    page.once('dialog', dialog => dialog.accept()); await row('QA Inactive Project').getByRole('button', { name: 'Activate', exact: true }).click();
    await row('QA Inactive Project').getByRole('button', { name: 'Deactivate', exact: true }).waitFor();
    assert.equal(writes.length, 2); assert.deepEqual(writes[1].body, { status: 'active' });
  });
  await check('Status buttons respect edit permission, and delete-only access cannot change a listed project', async () => {
    await open('view=projects&access=readonly'); await row('QA Active Project').waitFor();
    assert.equal(await page.getByRole('button', { name: /^(Activate|Deactivate|Delete)$/ }).count(), 0);
    await open('view=projects&access=edit'); await row('QA Empty Project').getByRole('button', { name: 'Deactivate', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Delete', exact: true }).count(), 0);
    await open('view=projects&access=delete'); await row('QA Empty Project').getByRole('button', { name: 'Delete', exact: true }).waitFor();
    assert.equal(await row('QA Active Project').getByRole('button', { name: /^(Activate|Deactivate|Delete)$/ }).count(), 0);
  });
  await check('A newly listed unit still blocks deletion and refreshes the available project action', async () => {
    await open('view=projects&scenario=new-listing');
    const handleDialog = dialog => dialog.message().startsWith('Delete') ? dialog.accept() : dialog.dismiss();
    page.on('dialog', handleDialog);
    await row('QA Empty Project').getByRole('button', { name: 'Delete', exact: true }).click();
    await row('QA Empty Project').getByRole('button', { name: 'Deactivate', exact: true }).waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].method, 'DELETE');
    assert.ok(projects.some(project => project.id === 3));
    page.off('dialog', handleDialog);
  });
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
} finally {
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ checks, errors, externalRequests }, null, 2));
  await browser?.close(); await server.close();
}
if (checks.some(check => check.status !== 'PASS')) process.exitCode = 1;
