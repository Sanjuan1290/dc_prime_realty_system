/**
 * Batch 9: Run ONLY on restored, isolated STAGING DBs.
 * Source login MUST be SELECT-only. Does not create a database or drop anything.
 * `--check` preflight only; `--copy` requires BATCH9_ALLOW_STAGING_COPY=YES and empty target.
 * Each target table commits independently; on failure recreate ONLY fresh HR STAGING for restart.
 * HR audit scope is matched to employee/attendance/payroll modules and entities.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { canonical,rowHash,orderedHistory,validateUserReferences,hrScopedAudit,salaryBackfillAssessment,digest } from './migrationCore.mjs';
const require=createRequire(import.meta.url);
const mysql=require('mysql2/promise');
const here=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(here,'manifest.json')));
const actorCols=JSON.parse(fs.readFileSync(path.join(here,'actor_columns.json')));
const tables=manifest.table_copy_order;
const mode=process.argv.includes('--copy')?'copy':'check';
const fail=(message)=>{throw new Error(message);};
if(!['check','copy'].includes(mode))fail('Unknown mode');
if(mode==='copy'&&process.env.BATCH9_ALLOW_STAGING_COPY!=='YES')fail('Staging copy approval flag is required.');
const maxRows=Number(process.env.BATCH9_MAX_ROWS_PER_TABLE||50000);
if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>100000)fail('Invalid row cap');
const connect=(prefix, expected)=>{
  const host=process.env[`${prefix}_HOST`], user=process.env[`${prefix}_USER`], password=process.env[`${prefix}_PASSWORD`], database=process.env[`${prefix}_DATABASE`];
  if(!host||!user||password===undefined||database!==expected) fail(`Incorrect ${prefix} connection configuration`);
  return mysql.createConnection({host,port:Number(process.env[`${prefix}_PORT`]||4000),user,password,database,
    dateStrings:true,timezone:'+00:00',supportBigNumbers:true,bigNumberStrings:true,
    ssl:process.env[`${prefix}_SSL_CA_FILE`]?{ca:fs.readFileSync(process.env[`${prefix}_SSL_CA_FILE`])}:(process.env[`${prefix}_TLS`]==='true'?{rejectUnauthorized:true}:undefined),
    multipleStatements:false,connectTimeout:15000});
};
const qid=v=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v))fail('Invalid SQL identifier');return '`'+v+'`';};
async function rows(connection,sql,params=[]){const [value]=await connection.query(sql,params);return value;}
async function tableRows(connection,t){
  const pk=manifest.tables[t].primary_key.map(qid).join(',');
  const count=await rows(connection,`SELECT COUNT(*) AS n FROM ${qid(t)}`);
  if(Number(count[0].n)>maxRows)fail(`Table exceeds safe migration row cap: ${t}`);
  return rows(connection,`SELECT * FROM ${qid(t)} ORDER BY ${pk}`);
}
async function writeTable(target,table,data,columns){
  if(!data.length)return;
  const cols=columns.map(qid).join(',');
  const placeholders='('+columns.map(()=>'?').join(',')+')';
  // Bounded inserts; no disabling FK checks or duplicate-suppression logic.
  for(let start=0;start<data.length;start+=100){
    const batch=data.slice(start,start+100);
    const parameters=batch.flatMap(row=>columns.map(col=>{
      const v=row[col];return (v&&typeof v==='object'&&!Buffer.isBuffer(v))?JSON.stringify(v):v;
    }));
    await target.query(`INSERT INTO ${qid(table)} (${cols}) VALUES ${batch.map(()=>placeholders).join(',')}`,parameters);
  }
}
async function preflight(target){
  const [db]=await rows(target,'SELECT DATABASE() AS db');
  if(db.db!==manifest.target_database)fail('Refusing to operate on unexpected target');
  const required=[...tables,'hr_users','hr_legacy_user_map','hr_settings','hr_audit_logs','hr_outbox_events','hr_external_realty_user_links','hr_login_identities','hr_roles','hr_permissions','hr_role_permissions','hr_user_roles'];
  for(const t of required){const [n]=await rows(target,`SELECT COUNT(*) AS n FROM ${qid(t)}`);if(Number(n.n)!==0)fail(`Target not empty: ${t}. Prepare a new isolated staging target.`);}
}
async function run(){
  const source=await connect('BATCH9_SOURCE',manifest.source_database);
  let target;
  try{
    target=await connect('BATCH9_TARGET',manifest.target_database);
    if(process.env.BATCH9_STAGING_ID!=='ISOLATED_NONPRODUCTION')fail('Required isolated staging acknowledgment missing.');
    const [{db:sdb}]=await rows(source,'SELECT DATABASE() AS db');
    if(sdb!==manifest.source_database)fail('Unexpected source DB');
    await preflight(target);
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const snapshots={};
    for(const table of tables)snapshots[table]=await tableRows(source,table);
    const auditLive=(await rows(source,'SELECT * FROM audit_logs WHERE LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ?', ['%employee%','%payroll%','%salary%','%attendance%','%employee%','%payroll%','%salary%','%attendance%'])).filter(hrScopedAudit);
    const auditArchive=(await rows(source,'SELECT * FROM audit_logs_archive WHERE LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(module) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(entity_type) LIKE ?', ['%employee%','%payroll%','%salary%','%attendance%','%employee%','%payroll%','%salary%','%attendance%'])).filter(hrScopedAudit);
    if(auditLive.length>maxRows || auditArchive.length>maxRows)fail('HR audit history exceeds safe row cap');
    const auditIds=new Set(auditLive.map(x=>String(x.audit_log_id)));
    if(auditArchive.some(x=>auditIds.has(String(x.original_audit_log_id))))fail('Audit archive/live duplicate IDs need manual review.');
    const settingsRows=await rows(source,'SELECT * FROM system_settings');
    if(settingsRows.length!==1)fail('Expected exactly one historical system_settings row');
    const settings=settingsRows[0];
    const userSet=new Set();
    for(const [table, cols] of Object.entries(actorCols)) for(const row of snapshots[table])for(const col of cols) if(row[col]!==null&&row[col]!==undefined)userSet.add(String(row[col]));
    if(settings.updated_by_user_id!==null&&settings.updated_by_user_id!==undefined)userSet.add(String(settings.updated_by_user_id));
    for(const audit of [...auditLive,...auditArchive])if(audit.actor_user_id!==null&&audit.actor_user_id!==undefined)userSet.add(String(audit.actor_user_id));
    const users=userSet.size?await rows(source,`SELECT id,first_name,middle_name,last_name,email,role,status FROM users WHERE id IN (${[...userSet].map(()=>'?').join(',')})`,[...userSet]):[];
    const foundIds=new Set(users.map(x=>String(x.id)));
    const bad=validateUserReferences(snapshots,actorCols,foundIds);
    if(settings.updated_by_user_id!=null&&!foundIds.has(String(settings.updated_by_user_id)))bad.push({table:'system_settings',column:'updated_by_user_id'});
    if(bad.length)fail(`${bad.length} unresolved HR user references; migration stopped.`);
    // Audit rows may preserve deleted actors as historical ID+actor snapshot without FK mapping.
    const correctionCount=snapshots.employee_payroll_corrections.length;
    const activeCashAdvanceCount=snapshots.employee_cash_advances.filter(x=>['active','paid'].includes(x.cash_advance_status)).length;
    const assessment=salaryBackfillAssessment(snapshots.employee_payrolls,correctionCount,activeCashAdvanceCount,process.env.BATCH9_MANILA_TIMESTAMP_CONFIRMED==='YES');
    const summary={database:'staging',mode,source_backup_sha256:manifest.source_sql_sha256,
      tables:Object.fromEntries(tables.map(t=>[t,{count:snapshots[t].length,sha256:rowHash(snapshots[t],manifest.tables[t].primary_key)}])),
      historical_users:users.length,hr_audit_live:auditLive.length,hr_audit_archived:auditArchive.length,
      signed_receipt_metadata_count:snapshots.employee_payroll_signed_receipts.length,
      salary_backfill:{eligible_count:assessment.eligible.length,total_cents:assessment.total_cents,anomalies:assessment.anomalies,safe_to_emit:false},
      manual_checks:['Verify Cloudinary protected assets, scan status and access rules','Audit broader HR events stored under non-HR module labels','Approve correction, reversal and cash-advance policy','Confirm history cutoff and final cutover sync']};
    if(mode==='check'){
      console.log(JSON.stringify(summary,null,2));
      await source.query('ROLLBACK');return;
    }
    // Import only historical identity snapshots: do NOT move password hashes or login permissions.
    await target.beginTransaction();
    try{
      await writeTable(target,'hr_users',users.map(u=>({id:u.id,display_name_snapshot:[u.first_name,u.middle_name,u.last_name].filter(Boolean).join(' '),email_snapshot:u.email,account_status:'historical'})),['id','display_name_snapshot','email_snapshot','account_status']);
      await writeTable(target,'hr_legacy_user_map',users.map(u=>({legacy_realty_user_id:u.id,hr_user_id:u.id,source_name_snapshot:[u.first_name,u.middle_name,u.last_name].filter(Boolean).join(' '),source_role_snapshot:u.role,source_email_snapshot:u.email,mapping_method:'source_pk_preserved'})),['legacy_realty_user_id','hr_user_id','source_name_snapshot','source_role_snapshot','source_email_snapshot','mapping_method']);
      await target.commit();
    }catch(e){await target.rollback();throw e;}
    for(const t of tables){
      const r=t==='employee_employment_history'?orderedHistory(snapshots[t]):snapshots[t];
      await target.beginTransaction();try{await writeTable(target,t,r,manifest.tables[t].source_columns);await target.commit();}catch(e){await target.rollback();throw e;}
      const check=await tableRows(target,t);
      if(rowHash(check,manifest.tables[t].primary_key)!==summary.tables[t].sha256)fail(`Hash mismatch after import ${t}`);
    }
    const HR_SETTINGS_COLS=['attendance_default_time_out','attendance_scheduled_time_in','attendance_scheduled_time_out','attendance_break_start','attendance_break_minutes','attendance_regular_work_minutes','attendance_late_after','attendance_red_highlight_after','employee_departments_json','employee_department_codes_json'];
    await target.beginTransaction();
    try{
      const setRow={id:1,source_realty_settings_id:settings.system_setting_id,updated_by_user_id:settings.updated_by_user_id};
      HR_SETTINGS_COLS.forEach(k=>setRow[k]=settings[k]);
      await writeTable(target,'hr_settings',[setRow],['id',...HR_SETTINGS_COLS,'source_realty_settings_id','updated_by_user_id']);
      await target.commit();
    }catch(e){await target.rollback();throw e;}
    const seenAudit=new Set();
    const auditRows=[...auditLive.map(x=>({src:x,archived:false,legacyId:x.audit_log_id})),...auditArchive.map(x=>({src:x,archived:true,legacyId:x.original_audit_log_id}))].map(({src,archived,legacyId})=>{
      if(seenAudit.has(String(legacyId)))fail('Duplicate audit ID');seenAudit.add(String(legacyId));
      const actor=src.actor_user_id;
      return {hr_user_id:actor!=null&&foundIds.has(String(actor))?actor:null,legacy_realty_user_id:actor,
        legacy_realty_audit_id:legacyId,actor_name_snapshot:src.actor_name,action:src.action,module:src.module,
        entity_type:src.entity_type,entity_id:src.entity_id,
        details_json:{origin:archived?'realty_audit_archive':'realty_audit_live',title:src.title,description:src.description,actor_email:src.actor_email,actor_role:src.actor_role,entity_label:src.entity_label,metadata_json:src.metadata_json},
        recorded_at:src.audit_log_created_at};
    });
    await target.beginTransaction();
    try{await writeTable(target,'hr_audit_logs',auditRows,['hr_user_id','legacy_realty_user_id','legacy_realty_audit_id','actor_name_snapshot','action','module','entity_type','entity_id','details_json','recorded_at']);await target.commit();}catch(e){await target.rollback();throw e;}
    // Keep links as pending (not verified); seller network HR contract needs separate approval.
    const links=snapshots.employees.filter(x=>x.linked_user_id!=null).map(x=>({employee_id:x.employee_id,realty_user_id:x.linked_user_id,link_status:'pending'}));
    await target.beginTransaction();try{await writeTable(target,'hr_external_realty_user_links',links,['employee_id','realty_user_id','link_status']);await target.commit();}catch(e){await target.rollback();throw e;}
    // No financial outbox events emitted during Batch 9 by default. Reconciliation is separate.
    const verification=await rows(target,'SELECT COUNT(*) AS n FROM hr_audit_logs');
    if(Number(verification[0].n)!==auditRows.length)fail('Audit history count mismatch');
    const st=await rows(target,'SELECT * FROM hr_settings WHERE id=1');
    if(st.length!==1 || HR_SETTINGS_COLS.some(k=>canonical(st[0][k])!==canonical(settings[k])))fail('HR settings parity mismatch');
    summary.import_complete_for_staging=true;
    summary.actor_mapping_count=users.length;
    summary.receipt_assets_verified=false;
    summary.financial_event_outbox_created=0;
    console.log(JSON.stringify(summary,null,2));
    await source.query('ROLLBACK');
  }finally{try{await source.end();}catch{}if(target)try{await target.end();}catch{}}
}
run().catch(error=>{console.error('BATCH9 STOPPED: '+error.message);process.exitCode=1;});
