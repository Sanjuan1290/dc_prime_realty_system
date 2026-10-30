import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir=dirname(fileURLToPath(import.meta.url))
const root=resolve(dir, '../../..')
test('independent frontend locations and HR JSX export are valid',()=>{
 for(const relative of [
  'CLIENT/WEBSITE/src/App.jsx',
  'CLIENT/SYSTEM/src/App.jsx',
  'CLIENT/HR/src/App.jsx',
  'CLIENT/FINANCE/src/App.jsx',
  'CLIENT/HR/src/components/System/employeeSalaryComponents/PayrollRateExplanation.jsx',
 ]) assert.ok(existsSync(resolve(root, relative)), relative)
 const modal=readFileSync(resolve(root,'CLIENT/HR/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx'),'utf8')
 assert.match(modal,/from ['"]\.\/PayrollRateExplanation\.jsx['"]/)
 const systemModal=readFileSync(resolve(root,'CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx'),'utf8')
 assert.match(systemModal,/from ['"]\.\/PayrollRateExplanation\.jsx['"]/)
})
test('regression guard: legacy monorepo test references cannot reappear',()=>{
 const bad=[]
 for(const name of readdirSync(dir).filter(x=>/\.test\.(?:js|mjs)$/.test(x) && x!=='workspacePathRegression.test.mjs')){
  const source=readFileSync(resolve(dir,name),'utf8')
  if(source.includes('CLIENT/SYSTEM/src/website/')) bad.push(name+': website referenced under SYSTEM')
  if(source.includes("path.join(root, 'client', 'src')")) bad.push(name+': old monolithic client/src root')
  if(source.includes('`../../${path}`')) bad.push(name+': out-of-date new URL root prefix')
  if(source.includes("'client/public/website/")) bad.push(name+': old website public path')
 }
 assert.deepEqual(bad,[])
})
