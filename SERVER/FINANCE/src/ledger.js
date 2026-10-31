import {getPool,withTransaction} from './db.js';
import {problem,validateTransaction,validateRange,money,dateInManila} from './domain.js';
const positiveId = value => {
  const s=String(value??''); if (!/^[1-9]\d*$/.test(s) || s.length>18) throw problem('INVALID_ID','Record ID must be positive.');return s;
};
export async function audit(conn,actor,action,entityType,entityId,data={}) {
  await conn.execute('INSERT INTO finance_audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)',[actor,action,entityType,String(entityId),JSON.stringify(data)]);
}
export async function listCategories(kind) {
  const params=[];let sql='SELECT id,kind,name,is_active FROM finance_categories';
  if (kind){if(!['income','expense'].includes(kind)) throw problem('INVALID_KIND','Invalid category type.');sql+=' WHERE kind=?';params.push(kind);}
  sql+=' ORDER BY kind,name';const [rows]=await getPool().execute(sql,params);return rows;
}
export async function createCategory(body,user) {
  const kind=body?.kind,name=String(body?.name??'').trim();
  if(!['income','expense'].includes(kind)||!name||name.length>90) throw problem('INVALID_CATEGORY','Enter a category name and type.');
  return withTransaction(async conn=>{
    const [result]=await conn.execute('INSERT INTO finance_categories(kind,name,created_by) VALUES(?,?,?)',[kind,name,user.id]);
    await audit(conn,user.id,'category.created','category',result.insertId,{kind,name});
    return {id:String(result.insertId),kind,name,is_active:1};
  });
}
export async function setCategoryActive(id,active,user) {
  if(typeof active!=='boolean')throw problem('INVALID_STATUS','is_active must be boolean.');
  return withTransaction(async conn=>{
    const [result]=await conn.execute('UPDATE finance_categories SET is_active=? WHERE id=?',[active?1:0,positiveId(id)]);
    if(!result.affectedRows)throw problem('NOT_FOUND','Category not found.',404);
    await audit(conn,user.id,'category.status_changed','category',id,{is_active:active});return {id:String(id),is_active:active};
  });
}
async function checkCategory(conn,categoryId,kind) {
  const [rows]=await conn.execute('SELECT kind,is_active FROM finance_categories WHERE id=?',[categoryId]);
  if(!rows[0]||rows[0].kind!==kind||Number(rows[0].is_active)!==1)throw problem('CATEGORY_MISMATCH','Select an active category of the same type.');
}
async function insertPosted(conn,t,user,correctedFrom=null) {
  await checkCategory(conn,t.category_id,t.kind);
  const [result]=await conn.execute(`INSERT INTO finance_transactions(transaction_date,kind,amount,category_id,description,notes,source_system,source_transaction_id,corrected_from_transaction_id,created_by) VALUES(?,?,?,?,?,?,'manual',NULL,?,?)`,[t.transaction_date,t.kind,t.amount,t.category_id,t.description,t.notes,correctedFrom,user.id]);
  await audit(conn,user.id,correctedFrom?'transaction.corrected':'transaction.posted','transaction',result.insertId,{kind:t.kind,amount:t.amount,transaction_date:t.transaction_date,corrected_from:correctedFrom});
  return {id:String(result.insertId),...t,status:'posted'};
}
export async function postTransaction(body,user) {
  const t=validateTransaction(body);
  return withTransaction(conn=>insertPosted(conn,t,user));
}
async function selectAndLock(conn,id) {
  const [rows]=await conn.execute('SELECT id,status,kind,amount,transaction_date,category_id,source_system FROM finance_transactions WHERE id=? FOR UPDATE',[positiveId(id)]);
  if(!rows[0])throw problem('NOT_FOUND','Transaction not found.',404);
  if(rows[0].status!=='posted')throw problem('ALREADY_VOID','This transaction is already void.',409);
  if(rows[0].source_system!=='manual')throw problem('IMPORTED_IMMUTABLE','Source imports require an approved adjustment workflow.',409);
  return rows[0];
}
async function markVoid(conn,row,reason,user) {
  const [res]=await conn.execute("UPDATE finance_transactions SET status='void',void_reason=?,voided_by=?,voided_at=UTC_TIMESTAMP() WHERE id=? AND status='posted'",[reason,user.id,row.id]);
  if(res.affectedRows!==1)throw problem('ALREADY_VOID','Transaction changed during request.',409);
  await audit(conn,user.id,'transaction.voided','transaction',row.id,{reason,kind:row.kind,amount:String(row.amount)});
}
export async function voidTransaction(id,reason,user) {
  const value=String(reason??'').trim();if(value.length<5||value.length>500)throw problem('INVALID_REASON','Enter a reason of 5–500 characters.');
  return withTransaction(async conn=>{const row=await selectAndLock(conn,id);await markVoid(conn,row,value,user);return {id:String(id),status:'void'};});
}
export async function correctTransaction(id,body,user) {
  const reason=String(body?.reason??'').trim();if(reason.length<5||reason.length>500)throw problem('INVALID_REASON','Enter a reason of 5–500 characters.');
  const t=validateTransaction(body);
  return withTransaction(async conn=>{
    const row=await selectAndLock(conn,id);
    await markVoid(conn,row,`Correction: ${reason}`,user);
    return insertPosted(conn,t,user,String(row.id));
  });
}
export async function listTransactions(query={}) {
  const {from,to}=validateRange(query), kind=query.kind||'all';
  if(!['all','income','expense'].includes(kind))throw problem('INVALID_KIND','Invalid type filter.');
  const status=query.status||'posted';if(!['posted','void','all'].includes(status))throw problem('INVALID_STATUS','Invalid status filter.');
  const page=Number(query.page??1),pageSize=Number(query.page_size??50);
  if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw problem('INVALID_PAGE','Choose a valid page and size.');
  let where=' WHERE t.transaction_date BETWEEN ? AND ?';const values=[from,to];
  if(kind!=='all'){where+=' AND t.kind=?';values.push(kind);}
  if(status!=='all'){where+=' AND t.status=?';values.push(status);}
  if(query.category_id){where+=' AND t.category_id=?';values.push(positiveId(query.category_id));}
  const [count]=await getPool().execute('SELECT COUNT(*) AS total FROM finance_transactions t'+where,values);
  const [rows]=await getPool().execute(`SELECT t.id,DATE_FORMAT(t.transaction_date,'%Y-%m-%d') AS transaction_date,t.kind,t.amount,t.description,t.notes,t.status,t.source_system,t.source_transaction_id,t.corrected_from_transaction_id,t.void_reason,t.created_at,c.name AS category_name,c.id AS category_id FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id ${where} ORDER BY t.transaction_date DESC,t.id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`,[...values]);
  return {transactions:rows,total:Number(count[0].total),page,page_size:pageSize};
}
export async function getDashboard(query={}) {
  const {from,to}=validateRange(query); // all-time starting cash = 0.00
  const [rows]=await getPool().execute(`SELECT
     COALESCE(SUM(CASE WHEN transaction_date<? AND kind='income' THEN amount WHEN transaction_date<? AND kind='expense' THEN -amount ELSE 0 END),0) AS opening_balance,
     COALESCE(SUM(CASE WHEN transaction_date>=? AND kind='income' THEN amount ELSE 0 END),0) AS money_in,
     COALESCE(SUM(CASE WHEN transaction_date>=? AND kind='expense' THEN amount ELSE 0 END),0) AS money_out,
     COUNT(*) AS total_posted
   FROM finance_transactions WHERE status='posted' AND transaction_date<=?`,[from,from,from,from,to]);
  const r=rows[0];
  // use BigInt instead of IEEE-754 for amounts returned by MySQL DECIMAL
  const toCents=value=>{const [w,f=''] = String(value).split('.');return BigInt(w)*100n+(String(value).trim().startsWith('-')?-1n:1n)*BigInt((f+'00').slice(0,2));};
  const {pesos}=await import('./domain.js');
  const opening=toCents(r.opening_balance),incoming=toCents(r.money_in),outgoing=toCents(r.money_out);
  return {from,to,currency:'PHP',opening_balance:pesos(opening),money_in:pesos(incoming),money_out:pesos(outgoing),net_change:pesos(incoming-outgoing),closing_balance:pesos(opening+incoming-outgoing),total_posted:Number(r.total_posted)};
}
export async function listAudit(query={},pool=getPool()) {
  const page=Number(query.page??1);if(!Number.isSafeInteger(page)||page<1||page>100000)throw problem('INVALID_PAGE','Invalid page.');
  const [rows]=await pool.execute(`SELECT id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at FROM finance_audit_logs ORDER BY id DESC LIMIT 50 OFFSET ${(page-1)*50}`);
  return {items:rows,page};
}

