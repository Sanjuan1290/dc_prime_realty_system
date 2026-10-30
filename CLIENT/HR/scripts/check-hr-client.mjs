import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const src=path.join(root,'src')
const allowed=new Set(['pages','components','auth','layout','config','utils'])
const files=[]
function scan(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,ent.name)
 if(ent.isDirectory())scan(file);else if(/\.(jsx?|mjs|css)$/.test(file))files.push(file)
}}
scan(src)
const errors=[]
const imports=/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g
for(const file of files){const rel=path.relative(src,file);const body=fs.readFileSync(file,'utf8')
 if(/(?:dc_prime_realty_system_db|company_finance_transactions|lot_project_payments|\/user\/me|\/user\/login)/.test(body))errors.push('Realty reference: '+rel)
 for(const match of body.matchAll(imports)){
  const spec=match[1]||match[2];let p=path.resolve(path.dirname(file),spec)
  const tries=[p,p+'.js',p+'.jsx',p+'.mjs',p+'.css',path.join(p,'index.jsx'),path.join(p,'index.js')]
  const resolved=tries.find(fs.existsSync)
  if(!resolved||!resolved.startsWith(src+path.sep))errors.push('Missing or outside HR import: '+rel+' -> '+spec)
 }
}
for(const [rel,text] of [['src/config/featureFlags.js','payrollRelease: false'],['src/config/featureFlags.js','signedReceipts: false'],['src/utils/useCurrentUser.js',"'/auth/me'"],['src/utils/apiClient.js','HR_READ_ONLY']]){
 if(!fs.readFileSync(path.join(root,rel),'utf8').includes(text))errors.push('Guard missing: '+rel+' -> '+text)
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('HR frontend source isolation PASS; '+files.length+' source files validated.')
