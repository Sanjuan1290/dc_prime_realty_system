import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dirs=['config','controllers','db','jobs','middleware','routers','services'];
const files=[];
function visit(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const fp=path.join(dir,e.name);
 if(e.isDirectory()){if(e.name!=='node_modules')visit(fp)}
 else if(/\.(js|mjs)$/.test(e.name))files.push(fp);
}}
for(const dir of dirs)visit(path.join(root,dir));
const entry=path.join(root,'server.js');if(fs.existsSync(entry))files.push(entry);
const forbidden=/\b(?:lot_projects|lot_project_[a-z_]*|company_finance_[a-z_]*|accredited_sellers|seller_groups|system_settings|FROM\s+users\b|JOIN\s+users\b|CREATE\s+TABLE|ALTER\s+TABLE)\b/i;
const illegal=files.filter(file=>forbidden.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(root,file));
if(illegal.length){console.error('HR runtime isolation FAILED:',illegal);process.exitCode=1;}
else console.log(`HR runtime isolation PASS (${files.length} runtime JS files). Historical migration scripts are reviewed separately.`);
