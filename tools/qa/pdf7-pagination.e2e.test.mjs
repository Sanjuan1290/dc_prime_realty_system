// Real APIs with synthetic fixtures on the guarded disposable loopback databases.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const mysql=require('mysql2/promise'),pools={},cookies={},base='http://127.0.0.1:4179';
const key=randomBytes(4).toString('hex'),prefix=`PDF7 ${key}`,month='2031-01',payrollIds=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
async function api(app,path,{method='GET',data,auth=true}={}){
 const root={finance:'/finance-api/api/v1',hr:'/hr-api/api/v1',system:'/api/v1'}[app];
 const response=await fetch(base+root+path,{method,headers:{origin:base,'x-requested-with':'dcprime-finance',...(auth&&cookies[app]?{cookie:cookies[app]}:{}),...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
 return {status:response.status,data:await response.json(),response};
}
const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
test.before(async()=>{
 for(const [app,database] of [['finance','dc_prime_finance_db'],['hr','dc_prime_hr_db'],['system','dc_prime_realty_system_db']]){
  const db=pools[app]=mysql.createPool({host:'127.0.0.1',port:13307,user:`qa_${app}`,password:'qa-isolated-only-password',database,dateStrings:true});
  const [[state]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(state.port,13307);
  assert.equal(state.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
  const login=await api(app,app==='system'?'/user/login':'/auth/login',{method:'POST',auth:false,data:{email:app==='finance'?'admin@qa.invalid':`${app}@qa.invalid`,password:'Synthetic-QA-only-2026!'}});
  ok(login);cookies[app]=login.response.headers.get('set-cookie').split(';')[0];
 }
 const finance=pools.finance,hr=pools.hr,system=pools.system;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const secondDay=today.slice(0,7)+'-02';
 const attendanceDate=new Date(secondDay+'T00:00:00Z').getUTCDay()===0?today.slice(0,7)+'-03':secondDay;
 for(let i=1;i<=23;i++){
  const id=randomUUID();
  await finance.execute(`INSERT INTO finance_import_batches(id,source_system,export_id,file_name,file_sha256,file_format,source_from,source_to,source_generated_at,manifest_json,total_rows,selected_money_in,selected_money_out,created_by,status,committed_by,committed_at,result_json)
   VALUES(?,'hr',?,?,?,'csv','2031-01-01','2031-01-15','2031-01-16T00:00:00Z','{}',0,0,0,1,'committed',1,'2090-01-01 00:00:00','{}')`,[id,`${prefix}-${i}`,`${prefix}-${i}.csv`,hash(id)]);
  await finance.execute("INSERT INTO finance_audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(1,?,'qa',?,'{}')",[`qa.pdf7.${key}`,String(i)]);
  await hr.execute("INSERT INTO hr_audit_logs(hr_user_id,actor_name_snapshot,action,module,entity_type,entity_id,details_json) VALUES(1,'Synthetic QA Administrator',?,?,'qa',?,'{}')",[i===1?'pdf7.special':'pdf7.test',prefix,String(i)]);
  await finance.execute("INSERT INTO finance_users(email,display_name,password_hash,role,is_active,must_change_password,temporary_password_expires_at) VALUES(?,?,'!not-a-login-password','viewer',0,?,'2000-01-01')",[`pdf7-${key}-${i}@qa.invalid`,`${prefix} Account ${String(i).padStart(2,'0')}`,i>=21?1:0]);
 }
 await hr.execute("INSERT IGNORE INTO employee_payroll_periods(period_label,period_start,period_end,period_type,scheduled_release_date) VALUES('January 1–15, 2031','2031-01-01','2031-01-15','first_half','2031-01-22')");
 const [[period]]=await hr.query("SELECT employee_payroll_period_id AS id FROM employee_payroll_periods WHERE period_start='2031-01-01' AND period_end='2031-01-15'");
 for(let i=1;i<=23;i++){
  const name=`${prefix} Employee ${String(i).padStart(2,'0')}`;
  const [employee]=await hr.execute("INSERT INTO employees(employee_code,first_name,last_name,department,position,hire_date,monthly_salary) VALUES(?,'PDF7',?,?,'Synthetic QA','2026-01-01','200.02')",[`PDF7-${key}-${i}`,`${key} Employee ${String(i).padStart(2,'0')}`,prefix]);
  await hr.execute("INSERT INTO employee_rest_day_assignments(employee_id,day_of_week,effective_from,created_by_user_id) VALUES(?,'sunday','2026-01-01',1)",[employee.insertId]);
  if(i===1)await hr.execute("INSERT INTO employee_attendance_records(employee_id,attendance_date,actual_time_in,actual_time_out,attendance_status,source) VALUES(?,?,'09:30:00','18:30:00','present','manual')",[employee.insertId,attendanceDate]);
  const [payroll]=await hr.execute(`INSERT INTO employee_payrolls(employee_payroll_period_id,employee_id,employee_name_snapshot,position_snapshot,department_snapshot,half_month_basic,net_fund_release,payroll_status) VALUES(?,?,?,'Synthetic QA',?,'100.01','100.01','draft')`,[period.id,employee.insertId,name,prefix]);
  payrollIds.push(payroll.insertId);
 }
 const [event]=await hr.execute("INSERT INTO attendance_events(event_name,start_date,end_date,notes) VALUES(?,?,?,'Synthetic narrow-panel layout check')",[`${prefix} Event`,today,today]);
 const slug=`qa-pdf7-${key}`;
 const [project]=await system.execute("INSERT INTO lot_projects(lot_project_name,lot_project_slug,lot_project_location,lot_project_location_code) VALUES(?,?,'Synthetic QA location',?)",[`${prefix} Project`,slug,`QA7-${key}`]);
 const [listing]=await system.execute("INSERT INTO lot_project_listings(lot_project_id,lot_project_listing_unit_type,lot_project_listing_unit_id,buyer_form_generation) VALUES(?,'Inner','QA-7',1)",[project.insertId]);
 const tokens={buyer:randomBytes(32).toString('base64url'),expired:randomBytes(32).toString('base64url')};
 for(const [kind,token] of Object.entries(tokens))await system.execute(`INSERT INTO lot_project_buyer_form_links(lot_project_id,lot_project_listing_id,token_hash,generation_number,expires_at,generated_by_user_id) VALUES(?,?,?,1,${kind==='buyer'?'DATE_ADD(NOW(),INTERVAL 7 DAY)':'DATE_SUB(NOW(),INTERVAL 1 DAY)'},1)`,[project.insertId,listing.insertId,hash(token)]);
 mkdirSync('QA_REPORTS/.runtime/pdf7',{recursive:true});
 writeFileSync('QA_REPORTS/.runtime/pdf7/fixtures.json',JSON.stringify({key,prefix,month,payrollIds,eventId:event.insertId,today,slug,...tokens},null,2));
});
test.after(async()=>{await Promise.all(Object.values(pools).map(pool=>pool.end()));});

test('Import history pages have correct totals, stable ordering, sizes and last-page bounds',async()=>{
 const [[count]]=await pools.finance.query("SELECT COUNT(*) AS total FROM finance_import_batches WHERE status IN ('committed','undone')");
 const one=ok(await api('finance','/finance/imports?page=1&page_size=10')),two=ok(await api('finance','/finance/imports?page=2&page_size=10'));
 assert.equal(one.total,Number(count.total));assert.equal(one.items.length,10);assert.equal(two.items.length,10);
 assert.equal(new Set([...one.items,...two.items].map(row=>row.id)).size,20);
 const [expected]=await pools.finance.query("SELECT id FROM finance_import_batches WHERE status IN ('committed','undone') ORDER BY committed_at DESC,id DESC LIMIT 20");
 assert.deepEqual([...one.items,...two.items].map(row=>row.id),expected.map(row=>row.id));
 const last=ok(await api('finance','/finance/imports?page=9999&page_size=10'));assert.equal(last.page,Math.ceil(one.total/10));assert.ok(last.items.length>=1&&last.items.length<=10);
 const larger=ok(await api('finance','/finance/imports?page_size=20'));assert.equal(larger.items.length,20);
});
test('Finance audit pagination filters counts and rows together and does not repeat events',async()=>{
 const ids=[];
 for(let page=1;page<=3;page++){
  const result=ok(await api('finance',`/finance/audit?action=qa.pdf7.${key}&page=${page}&page_size=10`));assert.equal(result.total,23);assert.equal(result.items.length,page===3?3:10);ids.push(...result.items.map(row=>row.id));
 }
 assert.equal(new Set(ids).size,23);
 assert.equal(ok(await api('finance',`/finance/audit?action=qa.pdf7.${key}&page=999&page_size=10`)).page,3);
});
test('HR audit dropdown metadata includes values outside the current page and filters use their stored codes',async()=>{
 const result=ok(await api('hr','/audit-logs?'+new URLSearchParams({module:prefix,page:3,page_size:10})));
 assert.equal(result.total,23);assert.equal(result.items.length,3);assert.ok(result.items.every(row=>row.module===prefix));
 assert.ok(result.filter_options.modules.includes(prefix));assert.ok(result.filter_options.actions.includes('pdf7.special'));
 const filtered=ok(await api('hr','/audit-logs?'+new URLSearchParams({module:prefix,action:'pdf7.special',page_size:10})));
 assert.equal(filtered.total,1);assert.equal(filtered.items[0].action,'pdf7.special');
 const empty=ok(await api('hr','/audit-logs?'+new URLSearchParams({module:'No matching synthetic module',page:999,page_size:10})));
 assert.equal(empty.total,0);assert.equal(empty.page,1);assert.deepEqual(empty.items,[]);
});
test('All paginated APIs reject unsafe page sizes and preserve authentication boundaries',async()=>{
 for(const [app,path] of [['finance','/finance/imports'],['finance','/finance/audit'],['hr','/audit-logs']]){
  for(const size of ['0','-1','101','1.5','NaN','10;DROP TABLE users'])assert.equal((await api(app,path+'?page_size='+encodeURIComponent(size))).status,400);
  assert.equal((await api(app,path,{auth:false})).status,401);
 }
});
test('Payroll register still returns all filtered records and complete pay totals for client pagination',async()=>{
 const result=ok(await api('hr','/employee-payroll/drafts?'+new URLSearchParams({month,period_type:'first_half',department:prefix})));
 assert.equal(result.data.length,23);assert.equal(new Set(result.data.map(row=>row.employee_payroll_id)).size,23);
 assert.equal(result.data.reduce((sum,row)=>sum+Math.round(Number(row.net_fund_release)*100),0),230023);
});
test('Legacy buyer links load the Realty application, valid forms work, and expired tokens stay rejected',async()=>{
 const {buyer,expired}=JSON.parse(await (await import('node:fs/promises')).readFile('QA_REPORTS/.runtime/pdf7/fixtures.json','utf8'));
 const response=await fetch(base+'/buyer-form/'+buyer,{redirect:'manual'});assert.equal(response.status,302);assert.equal(new URL(response.headers.get('location')).pathname,'/system/buyer-form/'+buyer);
 const html=await fetch(response.headers.get('location'));assert.equal(html.status,200);assert.match(await html.text(),/\/system\/assets\//);
 const info=ok(await api('system','/public/buyer-forms/'+buyer,{auth:false}));assert.equal(info.data.unitId,'QA-7');assert.equal(info.data.projectName,`${prefix} Project`);
 assert.equal((await api('system','/public/buyer-forms/'+expired,{auth:false})).status,410);
 assert.equal((await api('system','/public/buyer-forms/not-a-valid-qa-token',{auth:false})).status,404);
});
