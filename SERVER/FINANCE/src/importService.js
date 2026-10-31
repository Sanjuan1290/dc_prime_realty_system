import {randomUUID} from 'node:crypto';
import {getPool,withTransaction} from './db.js';
import {problem} from './domain.js';
import {audit} from './ledger.js';
import {decodeUpload,parseUpload} from './importFile.js';
import {sha256,classifyImportRow} from './importContract.js';
const invalid=(code,msg,status=400)=>{throw problem(code,msg,status);};
const positive=value=>{const s=String(value??'');if(!/^[1-9]\d*$/.test(s)||s.length>18)invalid('INVALID_ID','Select a valid record ID.');return s;};
const parseJson=v=>typeof v==='string'?JSON.parse(v):v;
async function categories(conn){
  const [mappings]=await conn.execute(`SELECT m.source_system,m.source_kind,m.source_category,m.category_id,c.kind,c.is_active,c.name
   FROM finance_import_category_mappings m JOIN finance_categories c ON c.id=m.category_id WHERE m.source_system='realty'`);
  return new Map(mappings.map(m=>[`${m.source_kind}\u0000${m.source_category}`,m]));
}
export async function listCategoryMappings(){
  const [rows]=await getPool().execute(`SELECT m.id,m.source_system,m.source_kind,m.source_category,m.category_id,c.name AS target_name,c.is_active
  FROM finance_import_category_mappings m JOIN finance_categories c ON c.id=m.category_id WHERE m.source_system='realty' ORDER BY m.source_kind,m.source_category`);
  return rows;
}
export async function approveCategoryMapping(body,actor){
  const kind=body?.kind,sourceCategory=String(body?.source_category??'').trim(),categoryId=positive(body?.category_id);
  if(!['income','expense'].includes(kind)||!sourceCategory||sourceCategory.length>200)invalid('INVALID_MAPPING','Enter a valid source category and type.');
  return withTransaction(async conn=>{
    const [rows]=await conn.execute('SELECT id,kind,is_active,name FROM finance_categories WHERE id=? FOR UPDATE',[categoryId]);
    const c=rows[0];if(!c||c.kind!==kind||Number(c.is_active)!==1)invalid('INVALID_MAPPING','Choose an active Finance category of the same type.');
    await conn.execute(`INSERT INTO finance_import_category_mappings(source_system,source_kind,source_category,category_id,approved_by)
      VALUES('realty',?,?,?,?) ON DUPLICATE KEY UPDATE category_id=VALUES(category_id),approved_by=VALUES(approved_by),approved_at=CURRENT_TIMESTAMP`,[kind,sourceCategory,categoryId,actor.id]);
    await audit(conn,actor.id,'finance.import.mapping','category',categoryId,{source_system:'realty',kind,source_category:sourceCategory,target_name:c.name});
    return {source_system:'realty',kind,source_category:sourceCategory,category_id:String(categoryId),target_name:c.name};
  });
}
const counts=items=>Object.fromEntries(['new','duplicate','conflict','unmapped'].map(d=>[d,items.filter(x=>x.decision===d).length]));
export async function previewImport(body,actor,options={}){
  const file=decodeUpload(body||{}),data=await parseUpload(file,options);
  if(data.rows.length===0)invalid('EMPTY_TRANSFER','No financial rows to import.');
  const fileHash=sha256(file.buffer),id=randomUUID();
  return withTransaction(async conn=>{
    const map=await categories(conn);
    const items=[];
    for(let i=0;i<data.rows.length;i++){
      const row=data.rows[i];
      const [matched]=await conn.execute(`SELECT id,source_revision_sha256 FROM finance_transactions WHERE source_system=? AND source_transaction_id=?`,[row.source_system,row.source_transaction_id]);
      const mapping=map.get(`${row.transaction_type}\u0000${row.category}`);
      const decision=classifyImportRow(row,matched[0],mapping);
      items.push({row_number:i+2,source_system:row.source_system,source_transaction_id:row.source_transaction_id,source_revision_sha256:row.source_revision_sha256,source_category:row.category,kind:row.transaction_type,amount:row.amount,decision,category_id:decision==='new'?String(mapping.category_id):null,existing_transaction_id:matched[0]?.id?String(matched[0].id):null,row});
    }
    await conn.execute(`INSERT INTO finance_import_batches(id,source_system,export_id,file_name,file_sha256,file_format,source_from,source_to,source_generated_at,manifest_json,total_rows,selected_money_in,selected_money_out,created_by,created_at)
      VALUES(?,'realty',?,?,?,?,?,?,?,?,?,?,?, ?,UTC_TIMESTAMP())`,[id,String(data.manifest.export_id||''),file.filename,fileHash,file.format,data.manifest.period.from,data.manifest.period.to,data.manifest.generated_at,JSON.stringify(data.manifest),data.rows.length,data.totals.money_in,data.totals.money_out,actor.id]);
    for(const item of items)await conn.execute(`INSERT INTO finance_import_items(batch_id,\`row_number\`,source_system,source_transaction_id,source_revision_sha256,source_category,source_kind,category_id,decision,source_row_json)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,item.row_number,item.source_system,item.source_transaction_id,item.source_revision_sha256,item.source_category,item.kind,item.category_id,item.decision,JSON.stringify(item.row)]);
    await audit(conn,actor.id,'finance.import.preview','import_batch',id,{file_sha256:fileHash,counts:counts(items),selected_totals:data.totals});
    return {batch_id:id,expires_in_minutes:60,file_sha256:fileHash,manifest:{export_id:data.manifest.export_id,period:data.manifest.period,salary_source:data.manifest.salary_source},selected_totals:data.totals,counts:counts(items),ready:items.every(x=>['new','duplicate'].includes(x.decision)),items:items.map(({row,...rest})=>rest)};
  });
}
export async function listImportBatches(query={},pool=getPool()){
  const page=Number(query.page??1);
  if(!Number.isSafeInteger(page)||page<1||page>1000)invalid('INVALID_PAGE','Choose a valid import history page.');
  const [rows]=await pool.execute(`SELECT id,file_name,file_sha256,status,source_from,source_to,total_rows,selected_money_in,selected_money_out,created_at,committed_at,result_json
    FROM finance_import_batches ORDER BY created_at DESC LIMIT 50 OFFSET ${(page-1)*50}`);
  return {items:rows,page};
}
export async function commitImport(batchId,actor){
  if(!/^[0-9a-f-]{36}$/.test(String(batchId)))invalid('INVALID_BATCH','Choose a valid preview ID.');
  return withTransaction(async conn=>{
    const [found]=await conn.execute('SELECT * FROM finance_import_batches WHERE id=? FOR UPDATE',[batchId]);
    const batch=found[0];if(!batch)invalid('NOT_FOUND','Import preview not found.',404);
    if(batch.status==='committed')return {batch_id:batchId,status:'committed',already_committed:true,result:parseJson(batch.result_json)};
    if(batch.status!=='preview')invalid('IMPORT_NOT_ACTIVE','Import preview is no longer available.',409);
    if(String(batch.created_by)!==String(actor.id))invalid('IMPORT_OWNER','Only the user who prepared this preview can confirm it.',403);
    const [fresh]=await conn.execute('SELECT created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 MINUTE) AS fresh FROM finance_import_batches WHERE id=?',[batchId]);
    if(Number(fresh[0]?.fresh)!==1)invalid('PREVIEW_EXPIRED','Import preview expired. Upload and preview again.',409);
    const [items]=await conn.execute('SELECT * FROM finance_import_items WHERE batch_id=? ORDER BY `row_number` FOR UPDATE',[batchId]);
    if(items.length!==Number(batch.total_rows))invalid('PREVIEW_CHANGED','Preview row count changed.',409);
    const mapping=await categories(conn);
    const tally={imported:0,duplicate:0};let addedIncome=0n,addedExpense=0n;
    for(const item of items){
      const row=parseJson(item.source_row_json);
      const [existing]=await conn.execute('SELECT id,source_revision_sha256 FROM finance_transactions WHERE source_system=? AND source_transaction_id=? FOR UPDATE',[item.source_system,item.source_transaction_id]);
      const map=mapping.get(`${row.transaction_type}\u0000${row.category}`);
      const state=classifyImportRow(row,existing[0],map);
      // Require exact same result/mapping seen at preview. Fail closed on any change.
      if(state!==item.decision || state==='conflict'||state==='unmapped' || (state==='new'&&String(map.category_id)!==String(item.category_id)))invalid('PREVIEW_STALE','A source record, category mapping or import decision changed. Preview again.',409);
      if(state==='duplicate'){
        await conn.execute('UPDATE finance_import_items SET transaction_id=?,decision=? WHERE id=?',[existing[0].id,'duplicate',item.id]);
        tally.duplicate++;continue;
      }
      const [insert]=await conn.execute(`INSERT INTO finance_transactions(transaction_date,kind,amount,category_id,description,notes,status,source_system,source_transaction_id,source_revision_sha256,created_by)
        VALUES(?,?,?,?,?,?,'posted',?,?,?,?)`,[row.transaction_date,row.transaction_type,row.amount,item.category_id,row.description,row.reference_id?`Source reference: ${row.reference_id}`:null,row.source_system,row.source_transaction_id,row.source_revision_sha256,actor.id]);
      await conn.execute('UPDATE finance_import_items SET transaction_id=?,decision=? WHERE id=?',[insert.insertId,'imported',item.id]);
      tally.imported++;const cents=BigInt(row.amount.split('.')[0])*100n+BigInt(row.amount.split('.')[1]);if(row.transaction_type==='income')addedIncome+=cents;else addedExpense+=cents;
    }
    const php=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`;
    const result={...tally,imported_money_in:php(addedIncome),imported_money_out:php(addedExpense),record_count:items.length,source_export_id:batch.export_id};
    await conn.execute('UPDATE finance_import_batches SET status=?,committed_by=?,committed_at=UTC_TIMESTAMP(),result_json=? WHERE id=?',['committed',actor.id,JSON.stringify(result),batchId]);
    await audit(conn,actor.id,'finance.import.committed','import_batch',batchId,result);
    return {batch_id:batchId,status:'committed',result};
  });
}
