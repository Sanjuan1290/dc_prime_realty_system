/**
 * Read-only source-vs-target final sync DIFF. Does not apply changes or print HR rows.
 * Requires independent SELECT-only credentials and verified ingestion freeze.
 * Mismatches must be resolved through an approved, separately tested final-sync procedure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {compareTable} from './diffCore.mjs';
const require=createRequire(import.meta.url);
const mysql=require('mysql2/promise');
const here=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.resolve(here,'../batch9/manifest.json')));
const fail=m=>{throw new Error(m)};
const qid=s=>/^\w+$/.test(s)?'`'+s+'`':fail('Invalid table or column identifier');
async function connect(prefix,expected){
  const host=process.env[`${prefix}_HOST`];
  const user=process.env[`${prefix}_USER`];
  const password=process.env[`${prefix}_PASSWORD`];
  const database=process.env[`${prefix}_DATABASE`];
  const ca=process.env[`${prefix}_SSL_CA_FILE`];
  if(!host||!user||password===undefined||database!==expected)fail(`Invalid ${prefix} connection configuration`);
  if(process.env[`${prefix}_READ_ONLY_CONFIRMED`]!=='YES')fail(`SELECT-only grant must be verified for ${prefix}`);
  const ssl=ca?{ca:fs.readFileSync(ca)}:process.env[`${prefix}_TLS`]==='true'?{rejectUnauthorized:true}:undefined;
  if(!ssl && !['localhost','127.0.0.1'].includes(host))fail(`${prefix} must have verified TLS outside localhost`);
  return mysql.createConnection({host,port:Number(process.env[`${prefix}_PORT`]||4000),user,password,database,ssl,
    multipleStatements:false,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
}
async function rows(db,table,pk,max){
  const [[{n}]] = await db.query(`SELECT COUNT(*) AS n FROM ${qid(table)}`);
  if(Number(n)>max)fail(`Row cap exceeded for ${table}; use chunked comparator`);
  const [r] = await db.query(`SELECT * FROM ${qid(table)} ORDER BY ${pk.map(qid).join(',')}`);
  return r;
}
async function run(){
  if(process.argv.includes('--sync')||process.argv.includes('--copy')||process.argv.includes('--apply'))fail('Read-only tool refuses write modes');
  if(process.env.BATCH10_STAGING_ID!=='ISOLATED_NONPRODUCTION')fail('Only isolated staging comparison is permitted');
  if(process.env.BATCH10_FREEZE_VERIFIED!=='YES')fail('Verify all legacy writes, schedulers and Seller Network cross-writes are frozen first');
  const max=Number(process.env.BATCH10_MAX_ROWS_PER_TABLE||50000);
  if(!Number.isSafeInteger(max)||max<1||max>100000)fail('Invalid max rows');
  const src=await connect('BATCH10_SOURCE',manifest.source_database);
  let dst;
  try{
    dst=await connect('BATCH10_TARGET',manifest.target_database);
    // One stable snapshot per DB; the operator must also verify the source is frozen.
    await src.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    await dst.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const report={batch:10,mode:'readonly_staging',source_schema:manifest.source_database,target_schema:manifest.target_database,
      generated_at:new Date().toISOString(),tables:{},all_17_tables_match:true};
    for(const table of manifest.table_copy_order){
      const pk=manifest.tables[table].primary_key;
      const result=compareTable(await rows(src,table,pk,max),await rows(dst,table,pk,max),pk);
      report.tables[table]=result;
      if(!result.match)report.all_17_tables_match=false;
    }
    console.log(JSON.stringify(report,null,2));
    if(!report.all_17_tables_match)process.exitCode=2;
  }finally{await src.query('ROLLBACK').catch(()=>{});if(dst)await dst.query('ROLLBACK').catch(()=>{});await src.end().catch(()=>{});if(dst)await dst.end().catch(()=>{});}
}
run().catch(e=>{console.error('BATCH10 COMPARISON STOPPED: '+e.message);process.exitCode=1});
