import {randomUUID} from 'node:crypto';
import {getPool,withTransaction} from './db.js';
import {problem,phpCents} from './domain.js';
import {audit} from './ledger.js';
import {decodeUpload,parseUpload} from './importFile.js';
import {categoryName,categoryKey,importDecision} from './importPolicy.js';
import {lockImports} from './importUndo.js';
import {sha256} from './importContract.js';
const invalid=(code,msg,status=400)=>{throw problem(code,msg,status);};
const parseJson=v=>typeof v==='string'?JSON.parse(v):v;
async function existingSource(conn,row){
  const [exact]=await conn.execute('SELECT id,source_system,status,void_reason,category_id,source_revision_sha256,amount,kind FROM finance_transactions WHERE source_system=? AND source_transaction_id=?',[row.source_system,row.source_transaction_id]);
  if(row.source_system!=='hr'||row.source_type!=='salary')return exact[0];
  // Older Company Finances exports labelled external HR salary as Realty.
  // A completed or undone receipt must prove that provenance. Legacy Realty
  // payroll with a coincidentally equal numeric ID remains a different source.
  const [legacy]=await conn.execute(`SELECT t.id,t.source_system,t.status,t.void_reason,t.category_id,t.source_revision_sha256,t.amount,t.kind FROM finance_transactions t
    WHERE t.source_system='realty' AND t.source_transaction_id=? AND EXISTS (
      SELECT 1 FROM finance_import_items i JOIN finance_import_batches b ON b.id=i.batch_id
      WHERE i.transaction_id=t.id AND b.status IN ('committed','undone')
      AND JSON_UNQUOTE(JSON_EXTRACT(b.manifest_json,'$.salary_source'))='external'
      AND JSON_UNQUOTE(JSON_EXTRACT(i.source_row_json,'$.source_type'))='salary')`,[row.source_transaction_id]);
  if(exact[0]&&legacy[0]&&exact[0].status==='posted'&&legacy[0].status==='posted')invalid('SALARY_IDENTITY_CONFLICT','This salary has two existing ledger identities. Review its import history before importing again.',409);
  return exact[0]?.status==='posted'?exact[0]:legacy[0]?.status==='posted'?legacy[0]:exact[0]||legacy[0];
}
async function categories(conn,{lock=false}={}){
  const [rows]=await conn.execute('SELECT id,kind,name,is_active FROM finance_categories ORDER BY id'+(lock?' FOR UPDATE':''));
  const map=new Map();map.byId=new Map(rows.map(c=>[String(c.id),c]));
  for(const category of rows){const key=categoryKey(category.kind,category.name),current=map.get(key);if(!current||(!Number(current.is_active)&&Number(category.is_active)))map.set(key,category);}
  return map;
}
const counts=items=>Object.fromEntries(['new','restore','duplicate','conflict'].map(d=>[d,items.filter(x=>x.decision===d).length]));
async function verifySalarySequence(conn,items){
  for(const item of items){
    const row=item.row||parseJson(item.source_row_json),identity=/^salary:([1-9]\d*):([1-9]\d*)$/.exec(row.source_transaction_id);
    if(row.source_system!=='hr'||!identity)continue;
    const version=Number(identity[2]),prior='salary:'+identity[1]+(version===2?'':':'+(version-1));
    const included=items.find(entry=>{const other=entry.row||parseJson(entry.source_row_json);return other.source_system==='hr'&&other.source_transaction_id===prior&&['new','restore','duplicate','imported'].includes(entry.decision)});
    const previous=included?(included.row||parseJson(included.source_row_json)):await existingSource(conn,{...row,source_transaction_id:prior});
    if(!previous||(!included&&previous.status!=='posted'))invalid('SALARY_PREDECESSOR_REQUIRED','Import the preceding salary release or reversal first, or include the complete sequence in this CSV. No balances have changed.',409);
    const previousKind=previous.transaction_type||previous.kind;
    if((version%2===0&&(previousKind!=='expense'||phpCents(previous.amount)!==phpCents(row.amount)))||(version%2===1&&previousKind!=='income'))invalid('SALARY_REVERSAL_MISMATCH','A salary reversal must offset the preceding release exactly. Review the source history.',409);
  }
}
export async function previewImport(body,actor,options={}){
  const file=decodeUpload(body||{}),data=await parseUpload(file,options);
  if(data.rows.length===0)invalid('EMPTY_TRANSFER','No financial rows to import.');
  const fileHash=sha256(file.buffer),id=randomUUID();
  return withTransaction(async conn=>{
    const map=await categories(conn);
    const items=[];
    for(let i=0;i<data.rows.length;i++){
      const original=data.rows[i];
      const row=original.source_type==='salary'&&data.manifest.salary_source==='external'?{...original,source_system:'hr'}:original;
      const matched=await existingSource(conn,row);
      const decision=importDecision(row,matched);
      const name=categoryName(row),category=matched?map.byId.get(String(matched.category_id)):map.get(categoryKey(row.transaction_type,name));
      items.push({row_number:i+2,source_system:matched?.source_system||row.source_system,source_transaction_id:row.source_transaction_id,source_revision_sha256:row.source_revision_sha256,source_category:row.category,kind:row.transaction_type,amount:row.amount,decision,category_name:category?.name||name,category_action:['duplicate','conflict'].includes(decision)?'unchanged':!category?'create':Number(category.is_active)!==1?'reactivate':'existing',category_id:category?String(category.id):null,existing_transaction_id:matched?.id?String(matched.id):null,row});
    }
    await verifySalarySequence(conn,items);
    await conn.execute(`INSERT INTO finance_import_batches(id,source_system,export_id,file_name,file_sha256,file_format,source_from,source_to,source_generated_at,manifest_json,total_rows,selected_money_in,selected_money_out,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,[id,data.manifest.source_system,String(data.manifest.export_id||''),file.filename,fileHash,file.format,data.manifest.period.from,data.manifest.period.to,data.manifest.generated_at,JSON.stringify(data.manifest),data.rows.length,data.totals.money_in,data.totals.money_out,actor.id]);
    for(const item of items)await conn.execute(`INSERT INTO finance_import_items(batch_id,\`row_number\`,source_system,source_transaction_id,source_revision_sha256,source_category,source_kind,category_id,decision,source_row_json)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,item.row_number,item.source_system,item.source_transaction_id,item.source_revision_sha256,item.source_category,item.kind,item.category_id,item.decision,JSON.stringify(item.row)]);
    await audit(conn,actor.id,'finance.import.preview','import_batch',id,{file_sha256:fileHash,counts:counts(items),selected_totals:data.totals});
    return {batch_id:id,expires_in_minutes:60,file_sha256:fileHash,manifest:{source_system:data.manifest.source_system,export_id:data.manifest.export_id,period:data.manifest.period,salary_source:data.manifest.salary_source},selected_totals:data.totals,counts:counts(items),ready:items.every(x=>['new','restore','duplicate'].includes(x.decision)),items:items.map(({row,...rest})=>({...rest, transaction_date:row.transaction_date, description:row.description}))};
  });
}
export async function listImportBatches(query={},pool=getPool()){
  const requestedPage=Number(query.page??1),pageSize=Number(query.page_size??20);
  if(!Number.isSafeInteger(requestedPage)||requestedPage<1||requestedPage>10000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)invalid('INVALID_PAGE','Choose a valid import history page and size.');
  const [[count]]=await pool.execute("SELECT COUNT(*) AS total FROM finance_import_batches WHERE status IN ('committed','undone')");
  const page=Math.min(requestedPage,Math.max(1,Math.ceil(Number(count.total)/pageSize)));
  const [rows]=await pool.execute(`SELECT b.id,b.source_system,b.file_name,b.file_sha256,b.status,b.source_from,b.source_to,b.total_rows,b.selected_money_in,b.selected_money_out,b.committed_at,b.result_json,b.undone_at,b.undo_reason,b.undo_result_json,u.display_name AS imported_by
    FROM finance_import_batches b LEFT JOIN finance_users u ON u.id=b.committed_by
    WHERE b.status IN ('committed','undone') ORDER BY b.committed_at DESC,b.id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`);
  return {items:rows,page,page_size:pageSize,total:Number(count.total)};
}
export async function getImportDetails(id,pool=getPool()) {
  if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(id))) invalid('INVALID_IMPORT','Choose a valid import.');
  const [[batch]]=await pool.execute(`SELECT id,file_name,source_system,status,committed_at,result_json
    FROM finance_import_batches WHERE id=? AND status IN ('committed','undone')`,[id]);
  if(!batch) invalid('NOT_FOUND','Import receipt not found.',404);
  const [items]=await pool.execute(`SELECT i.row_number,i.source_system,i.source_transaction_id,i.source_kind AS kind,
    i.source_category,i.decision,i.transaction_id AS existing_transaction_id,i.source_row_json,
    c.name AS category_name,t.status AS ledger_status
    FROM finance_import_items i LEFT JOIN finance_categories c ON c.id=i.category_id
    LEFT JOIN finance_transactions t ON t.id=i.transaction_id
    WHERE i.batch_id=? ORDER BY i.row_number`,[id]);
  const restored=new Set();
  if(parseJson(batch.result_json)?.restored>0) {
    const [events]=await pool.execute(`SELECT entity_id FROM finance_audit_logs
      WHERE action='finance.import.payment_restored' AND entity_type='transaction'
      AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.batch_id'))=?`,[id]);
    for(const event of events) restored.add(String(event.entity_id));
  }
  return {...batch,items:items.map(({source_row_json,...item})=>{
    const source=parseJson(source_row_json)??{};
    const decision=item.decision==='imported'&&restored.has(String(item.existing_transaction_id))?'restored':item.decision;
    return {...item,decision,amount:source.amount,transaction_date:source.transaction_date,description:source.description};
  })};
}
export async function commitImport(batchId,actor){
  if(!/^[0-9a-f-]{36}$/.test(String(batchId)))invalid('INVALID_BATCH','Choose a valid preview ID.');
  return withTransaction(async conn=>{
    await lockImports(conn);
    const [found]=await conn.execute('SELECT * FROM finance_import_batches WHERE id=? FOR UPDATE',[batchId]);
    const batch=found[0];if(!batch)invalid('NOT_FOUND','Import preview not found.',404);
    if(batch.status==='committed')return {batch_id:batchId,status:'committed',already_committed:true,result:parseJson(batch.result_json)};
    if(batch.status!=='preview')invalid('IMPORT_NOT_ACTIVE','Import preview is no longer available.',409);
    if(batch.file_format!=='csv')invalid('CSV_REQUIRED','Upload a new Export to Finance CSV and preview it again.',409);
    if(String(batch.created_by)!==String(actor.id))invalid('IMPORT_OWNER','Only the user who prepared this preview can confirm it.',403);
    const [fresh]=await conn.execute('SELECT created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 MINUTE) AS fresh FROM finance_import_batches WHERE id=?',[batchId]);
    if(Number(fresh[0]?.fresh)!==1)invalid('PREVIEW_EXPIRED','Import preview expired. Upload and preview again.',409);
    const [items]=await conn.execute('SELECT * FROM finance_import_items WHERE batch_id=? ORDER BY `row_number` FOR UPDATE',[batchId]);
    if(items.length!==Number(batch.total_rows))invalid('PREVIEW_CHANGED','Preview row count changed.',409);
    await verifySalarySequence(conn,items);
    const categoryMap=await categories(conn,{lock:true});
    const tally={imported:0,created:0,restored:0,duplicate:0};let addedIncome=0n,addedExpense=0n;
    for(const item of items){
      const row=parseJson(item.source_row_json);
      const found=await existingSource(conn,row);
      const [existing]=found?await conn.execute('SELECT id,status,void_reason,source_system,category_id,source_revision_sha256 FROM finance_transactions WHERE id=? FOR UPDATE',[found.id]):[[]];
      const state=importDecision(row,existing[0]);
      const unchanged=state===item.decision||(['new','restore'].includes(item.decision)&&state==='duplicate');
      if(!unchanged||state==='conflict')invalid('PREVIEW_STALE','A payment changed since this preview. Preview the file again.',409);
      if(state==='duplicate'){
        await conn.execute('UPDATE finance_import_items SET transaction_id=?,decision=?,source_system=? WHERE id=?',[existing[0].id,'duplicate',existing[0].source_system,item.id]);
        tally.duplicate++;continue;
      }
      const name=categoryName(row),key=categoryKey(row.transaction_type,name);
      let category=state==='restore'?categoryMap.byId.get(String(existing[0].category_id)):categoryMap.get(key);
      if(state==='restore'&&!category)invalid('IMPORT_CHANGED','The original payment category is missing. Review its history before restoring.',409);
      if(!category){
        const [created]=await conn.execute('INSERT INTO finance_categories(kind,name,created_by) VALUES(?,?,?)',[row.transaction_type,name,actor.id]);
        category={id:created.insertId,kind:row.transaction_type,name,is_active:1};categoryMap.set(key,category);
        await audit(conn,actor.id,'category.created_by_import','category',category.id,{kind:row.transaction_type,name,batch_id:batchId});
      }else if(Number(category.is_active)!==1){
        await conn.execute('UPDATE finance_categories SET is_active=1 WHERE id=?',[category.id]);category.is_active=1;
        await audit(conn,actor.id,'category.reactivated_by_import','category',category.id,{batch_id:batchId});
      }
      let transactionId;
      if(state==='restore'){
        transactionId=existing[0].id;
        await conn.execute("UPDATE finance_transactions SET status='posted',void_reason=NULL,voided_by=NULL,voided_at=NULL WHERE id=? AND status='void'",[transactionId]);
        tally.restored++;
        await audit(conn,actor.id,'finance.import.payment_restored','transaction',transactionId,{batch_id:batchId});
      }else{
        const [insert]=await conn.execute(`INSERT INTO finance_transactions(transaction_date,kind,amount,category_id,description,notes,status,source_system,source_transaction_id,source_revision_sha256,created_by)
          VALUES(?,?,?,?,?,?,'posted',?,?,?,?)`,[row.transaction_date,row.transaction_type,row.amount,category.id,row.description,row.reference_id?`Source reference: ${row.reference_id}`:null,row.source_system,row.source_transaction_id,row.source_revision_sha256,actor.id]);
        transactionId=insert.insertId;tally.created++;
      }
      await conn.execute('UPDATE finance_import_items SET transaction_id=?,decision=?,category_id=?,source_system=? WHERE id=?',[transactionId,'imported',category.id,existing[0]?.source_system||row.source_system,item.id]);
      tally.imported++;const cents=BigInt(row.amount.split('.')[0])*100n+BigInt(row.amount.split('.')[1]);if(row.transaction_type==='income')addedIncome+=cents;else addedExpense+=cents;
    }
    const php=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`;
    const result={...tally,imported_money_in:php(addedIncome),imported_money_out:php(addedExpense),record_count:items.length,source_export_id:batch.export_id};
    await conn.execute('UPDATE finance_import_batches SET status=?,committed_by=?,committed_at=UTC_TIMESTAMP(),result_json=? WHERE id=?',['committed',actor.id,JSON.stringify(result),batchId]);
    await audit(conn,actor.id,'finance.import.committed','import_batch',batchId,result);
    return {batch_id:batchId,status:'committed',result};
  });
}
