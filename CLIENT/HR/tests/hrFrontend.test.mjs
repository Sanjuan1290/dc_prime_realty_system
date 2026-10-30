import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const get=(rel)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8')
test('HR application has three permission-scoped modules',()=>{
 const app=get('src/App.jsx')
 for(const route of ['employees','attendance-records','payroll'])assert.ok(app.includes("path:'"+route+"'"))
 assert.match(app,/ProtectedPage permission=/)
})
test('HR session is isolated from Realty session',()=>{
 assert.match(get('src/utils/useCurrentUser.js'),/\/auth\/me/)
 assert.doesNotMatch(get('src/utils/useCurrentUser.js'),/\/user\/me/)
 assert.match(get('src/auth/HrLogin.jsx'),/\/auth\/login/)
})
test('staging mutations are disabled by default',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.match(flags,/VITE_HR_STAGING_WRITES === 'true'/)
 assert.match(get('src/utils/apiClient.js'),/HR_READ_ONLY/)
 assert.match(get('src/utils/apiClient.js'),/credentials:'include'/)
})
test('salary release and signed receipts stay off',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.match(flags,/payrollRelease: false/)
 assert.match(flags,/signedReceipts: false/)
 assert.match(get('src/utils/apiClient.js'),/HR_PAYROLL_RELEASE_DISABLED/)
 assert.match(get('src/utils/apiClient.js'),/HR_SIGNED_RECEIPTS_DISABLED/)
 assert.match(get('src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx'),/Batch 9/)
})
test('attendance kiosk disabled until staging approval',()=>{
 assert.match(get('src/App.jsx'),/HR_FEATURE_FLAGS.kiosk/)
 assert.match(get('src/utils/apiClient.js'),/HR_KIOSK_DISABLED/)
})
test('HR app only uses its own API env key',()=>{
 assert.match(get('src/utils/apiClient.js'),/VITE_HR_API_URL/)
 assert.doesNotMatch(get('src/utils/apiClient.js'),/VITE_API_URL[^A-Z]/)
 assert.match(get('.env.example'),/VITE_HR_STAGING_WRITES=false/)
})


test('Cloudflare production bundle permits explicitly approved HR staging writes',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.doesNotMatch(flags,/import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_HR_STAGING_WRITES/)
 const combined=fs.readFileSync(new URL('../../scripts/build-all.mjs',import.meta.url),'utf8')
 assert.match(combined,/process\.env\.VITE_HR_STAGING_WRITES === 'true'/)
 assert.match(combined,/VITE_HR_KIOSK_ENABLED: 'false'/)
})
