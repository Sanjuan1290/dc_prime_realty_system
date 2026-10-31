// This file can only connect to the QA-owned server on loopback:13307.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const mysql=require('mysql2/promise');
const conn=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'root',multipleStatements:true});
try {
  const [[server]]=await conn.query('SELECT @@port AS port, @@datadir AS datadir');
  const expected=resolve(root,'QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/');
  if(server.port!==13307 || server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,'')!==expected) throw new Error('Not the QA-owned disposable database; refusing schema writes.');
  if(process.argv.includes('--reset')) {
    // Recovery recreates only these three schemas on the verified QA instance.
    for(const name of ['dc_prime_realty_system_db','dc_prime_hr_db','dc_prime_finance_db']) await conn.query(`DROP DATABASE IF EXISTS ${name}`);
    for(const name of ['qa_system','qa_hr','qa_finance']) await conn.query(`DROP USER IF EXISTS '${name}'@'127.0.0.1'`);
  }
  const [[existing]]=await conn.query("SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE 'dc_prime_%'");
  if(Number(existing.n)) throw new Error('QA schemas already exist; refusing to overwrite.');
  await conn.query(readFileSync(resolve(root,'DATABASES/FRESH_START/00_ALL_THREE_EMPTY_SCHEMAS_144_TABLES.sql'),'utf8'));
  const [counts]=await conn.query("SELECT TABLE_SCHEMA AS name,COUNT(*) AS tables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA LIKE 'dc_prime_%' GROUP BY TABLE_SCHEMA");
  console.log('Empty snapshot schemas created:',JSON.stringify(counts));
  // Separate database grants prove app-level SQL cannot read another app's data.
  for(const [name,db] of [['qa_system','dc_prime_realty_system_db'],['qa_hr','dc_prime_hr_db'],['qa_finance','dc_prime_finance_db']]) {
    await conn.query(`CREATE USER '${name}'@'127.0.0.1' IDENTIFIED BY 'qa-isolated-only-password'`);
    await conn.query(`GRANT ALL ON ${db}.* TO '${name}'@'127.0.0.1'`);
  }
  const {hashPassword}=await import('../../SERVER/FINANCE/src/passwords.js');
  const bcrypt=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url))('bcrypt');
  const password='Synthetic-QA-only-2026!';
  for(const [i,role] of ['admin','accountant','viewer'].entries()) {
    await conn.execute('INSERT INTO dc_prime_finance_db.finance_users(id,email,display_name,password_hash,role) VALUES(?,?,?,?,?)',[i+1,`${role}@qa.invalid`,`QA ${role}`,hashPassword(password),role]);
  }
  await conn.execute("INSERT INTO dc_prime_hr_db.hr_users(id,display_name_snapshot,email_snapshot,account_status) VALUES(1,'QA HR Admin','hr@qa.invalid','active'),(2,'QA HR Viewer','hrviewer@qa.invalid','active')");
  for(const id of [1,2]) await conn.execute("INSERT INTO dc_prime_hr_db.hr_login_identities(hr_user_id,login_email,password_hash,login_state,must_change_password) VALUES(?,?,?,'active',0)",[id,id===1?'hr@qa.invalid':'hrviewer@qa.invalid',await bcrypt.hash(password,10)]);
  await conn.query(readFileSync(resolve(root,'SERVER/HR/migrations/20261027_batch6/01_staging_hr_access_seed.sql'),'utf8'));
  await conn.query("INSERT INTO dc_prime_hr_db.hr_user_roles(hr_user_id,role_code) VALUES(1,'hr_admin'),(2,'hr_viewer')");
  await conn.execute("INSERT INTO dc_prime_realty_system_db.users(id,account_category,first_name,last_name,email,password_hash,role,status,must_change_password,admin_all_projects,all_projects_access) VALUES(1,'system','QA','Owner','system@qa.invalid',?,'super_admin','active',0,1,1)",[await bcrypt.hash(password,10)]);
  mkdirSync(resolve(root,'QA_REPORTS/evidence'),{recursive:true});
  writeFileSync(resolve(root,'QA_REPORTS/evidence/local-db-setup.json'),JSON.stringify({engine:'MySQL 8.0.41; not TiDB',isolated:true,counts,users:'synthetic @qa.invalid only'},null,2));
} finally {await conn.end();}
