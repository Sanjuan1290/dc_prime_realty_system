import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const get=(rel)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8')
test('attendance export is a named, scrollable modal with keyboard focus management',()=>{
 const modal=get('src/components/System/employeeComponents/AttendanceExportModal.jsx')
 assert.match(modal,/items-start justify-center overflow-y-auto/)
 assert.match(modal,/role="dialog" aria-modal="true" aria-labelledby="attendance-export-title"/)
 assert.match(modal,/useModalFocus\(onClose, \{busy:isExporting\}\)/)
 assert.match(modal,/data-dialog-close/)
})
test('HR application has permission-scoped employee, attendance, payroll and audit modules',()=>{
 const app=get('src/App.jsx')
 for(const route of ['employees','attendance-records','payroll','audit-logs'])assert.ok(app.includes("path:'"+route+"'"))
 assert.match(app,/ProtectedPage permission=/)
})
test('HR session is isolated from Realty session',()=>{
 assert.match(get('src/utils/useCurrentUser.js'),/\/auth\/me/)
 assert.doesNotMatch(get('src/utils/useCurrentUser.js'),/\/user\/me/)
 assert.match(get('src/auth/HrLogin.jsx'),/\/auth\/login/)
})
test('live mutations are enabled with an explicit read-only override',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.match(flags,/VITE_HR_READ_ONLY !== 'true'/)
 assert.match(get('src/utils/apiClient.js'),/HR_READ_ONLY/)
 assert.match(get('src/utils/apiClient.js'),/credentials:'include'/)
})
test('salary releases are live; signed storage remains a separate feature',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.match(flags,/payrollRelease: import\.meta\.env\.VITE_HR_READ_ONLY !== 'true'/)
 assert.match(flags,/signedReceipts: false/)
 assert.match(get('src/utils/apiClient.js'),/HR_PAYROLL_RELEASE_DISABLED/)
 assert.match(get('src/utils/apiClient.js'),/HR_SIGNED_RECEIPTS_DISABLED/)
 assert.match(get('src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx'),/Batch 9/)
})
test('attendance kiosk remains configurable',()=>{
 assert.match(get('src/App.jsx'),/HR_FEATURE_FLAGS.kiosk/)
 assert.match(get('src/utils/apiClient.js'),/HR_KIOSK_DISABLED/)
})
test('HR app only uses its own API env key',()=>{
 assert.match(get('src/utils/apiClient.js'),/VITE_HR_API_URL/)
 assert.doesNotMatch(get('src/utils/apiClient.js'),/VITE_API_URL[^A-Z]/)
 assert.match(get('.env.example'),/VITE_HR_READ_ONLY=false/)
})


test('Cloudflare production bundle defaults to live HR operations',()=>{
 const flags=get('src/config/featureFlags.js')
 assert.doesNotMatch(flags,/import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_HR_STAGING_WRITES/)
 const combined=fs.readFileSync(new URL('../../scripts/build-all.mjs',import.meta.url),'utf8')
 assert.match(combined,/process\.env\.VITE_HR_READ_ONLY === 'true'/)
 assert.match(combined,/process\.env\.VITE_HR_KIOSK_ENABLED === 'false'/)
})
