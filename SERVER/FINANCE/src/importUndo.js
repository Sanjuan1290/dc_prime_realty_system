import {getPool,withTransaction} from './db.js';
import {problem} from './domain.js';
import {audit} from './ledger.js';
import {summarizeUndo} from './importPolicy.js';

export function validateBatchId(id){
  if(!/^[0-9a-f-]{36}$/.test(String(id)))throw problem('INVALID_BATCH','Choose a valid import.',400);
}
export async function lockImports(conn){
  // One short transaction at a time prevents overlapping commit/undo operations
  // from observing each other's uncommitted receipts or undoing shared payments.
  const [[lock]]=await conn.execute('SELECT id FROM finance_import_mutex WHERE id=1 FOR UPDATE');
  if(!lock)throw problem('IMPORT_NOT_READY','Imports are initializing. Please try again shortly.',503);
}
async function selectImpact(conn,batch,{lock=false}={}){
  const [rows]=await conn.execute(`SELECT t.id,t.status,t.kind,t.amount,t.source_system,t.source_transaction_id,t.source_revision_sha256,
    (t.source_system='hr' OR EXISTS(SELECT 1 FROM finance_import_items provenance JOIN finance_import_batches pb ON pb.id=provenance.batch_id WHERE provenance.transaction_id=t.id AND pb.status IN ('committed','undone') AND JSON_UNQUOTE(JSON_EXTRACT(pb.manifest_json,'$.salary_source'))='external')) AS external_salary,
    (SELECT COUNT(DISTINCT b.id) FROM finance_import_items other_item JOIN finance_import_batches b ON b.id=other_item.batch_id
      WHERE other_item.transaction_id=t.id AND b.status='committed' AND b.id<>?) AS other_imports
    FROM finance_transactions t WHERE t.id IN (
      SELECT transaction_id FROM finance_import_items WHERE batch_id=? AND transaction_id IS NOT NULL)
    ORDER BY t.id${lock?' FOR UPDATE':''}`,[batch.id,batch.id]);
  const removing=new Set(rows.filter(row=>row.status==='posted'&&!Number(row.other_imports)).map(row=>String(row.id)));
  for(const row of rows){
    if(!removing.has(String(row.id))||!row.external_salary)continue;
    const identity=/^salary:([1-9]\d*)(?::([1-9]\d*))?$/.exec(row.source_transaction_id);
    if(!identity)continue;
    const next='salary:'+identity[1]+':'+(Number(identity[2]||1)+1);
    const [[later]]=await conn.execute("SELECT id FROM finance_transactions WHERE source_system='hr' AND source_transaction_id=? AND status='posted'",[next]);
    if(later&&!removing.has(String(later.id)))throw problem('SALARY_DEPENDENT_IMPORT','Undo the later salary reversal or release import first. Its preceding payment must remain until then.',409);
  }
  return {rows,preview:summarizeUndo(batch,rows)};
}
export async function previewUndoImport(id,pool=getPool()){
  validateBatchId(id);const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[batch]]=await conn.execute('SELECT id,file_name,status FROM finance_import_batches WHERE id=?',[id]);
    if(!batch)throw problem('NOT_FOUND','Import not found.',404);
    if(batch.status!=='committed')throw problem('IMPORT_NOT_ACTIVE','This import has already been undone or is not complete.',409);
    return (await selectImpact(conn,batch)).preview;
  }finally{try{await conn.rollback();}finally{conn.release();}}
}
export async function undoImport(id,body,actor){
  validateBatchId(id);
  const reason=String(body?.reason??'').trim(),token=String(body?.review_token??'');
  if(reason.length<5||reason.length>500)throw problem('INVALID_REASON','Enter a reason between 5 and 500 characters.');
  if(!/^[a-f0-9]{64}$/.test(token))throw problem('UNDO_REVIEW_REQUIRED','Review the balance changes before undoing this import.',409);
  return withTransaction(async conn=>{
    await lockImports(conn);
    const [[batch]]=await conn.execute('SELECT id,file_name,status,undo_result_json FROM finance_import_batches WHERE id=? FOR UPDATE',[id]);
    if(!batch)throw problem('NOT_FOUND','Import not found.',404);
    if(batch.status==='undone')return {batch_id:id,status:'undone',already_undone:true,result:typeof batch.undo_result_json==='string'?JSON.parse(batch.undo_result_json):batch.undo_result_json};
    if(batch.status!=='committed')throw problem('IMPORT_NOT_ACTIVE','Only completed imports can be undone.',409);
    const {rows,preview}=await selectImpact(conn,batch,{lock:true});
    if(preview.review_token!==token)throw problem('UNDO_REVIEW_CHANGED','The payments changed since your review. Close this dialog and review the undo again.',409);
    for(const row of rows){
      if(!['hr','realty'].includes(row.source_system))throw problem('IMPORT_CHANGED','This import contains an unexpected payment source. Review its history before continuing.',409);
      if(Number(row.other_imports)>0||row.status!=='posted')continue;
      if(!['income','expense'].includes(row.kind))throw problem('IMPORT_CHANGED','A payment has changed. Review its history before continuing.',409);
      await conn.execute("UPDATE finance_transactions SET status='void',void_reason=?,voided_by=?,voided_at=UTC_TIMESTAMP() WHERE id=? AND status='posted'",[`Import undone: ${id}`,actor.id,row.id]);
    }
    const result={...preview.impact,reason};
    await conn.execute("UPDATE finance_import_batches SET status='undone',undone_by=?,undone_at=UTC_TIMESTAMP(),undo_reason=?,undo_result_json=? WHERE id=?",[actor.id,reason,JSON.stringify(result),id]);
    await audit(conn,actor.id,'finance.import.undone','import_batch',id,result);
    return {batch_id:id,status:'undone',result};
  });
}
