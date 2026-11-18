import {getPool,withTransaction} from './db.js';
import {problem,validateTransaction,validateRange,validDate,money} from './domain.js';
import {getFinanceReport} from './reports.js';
const positiveId = value => {
  const s=String(value??''); if (!/^[1-9]\d*$/.test(s) || s.length>18) throw problem('INVALID_ID','Record ID must be positive.');return s;
};
export async function audit(conn,actor,action,entityType,entityId,data={}) {
  await conn.execute('INSERT INTO finance_audit_logs(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)',[actor,action,entityType,String(entityId),JSON.stringify(data)]);
}
const categoryUnused=`NOT (EXISTS (SELECT 1 FROM finance_transactions t WHERE t.category_id=c.id)
  OR EXISTS (SELECT 1 FROM finance_import_items i WHERE i.category_id=c.id)
  OR EXISTS (SELECT 1 FROM finance_import_category_mappings m WHERE m.category_id=c.id))`;
export async function listCategories(kind) {
  const params=[];let sql=`SELECT c.id,c.kind,c.name,c.is_active,
    ${categoryUnused} AS can_delete FROM finance_categories c`;
  if (kind){if(!['income','expense'].includes(kind)) throw problem('INVALID_KIND','Invalid category type.');sql+=' WHERE c.kind=?';params.push(kind);}
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
  const [rows]=await conn.execute('SELECT kind,is_active FROM finance_categories WHERE id=? FOR UPDATE',[categoryId]);
  if(!rows[0]||rows[0].kind!==kind||Number(rows[0].is_active)!==1)throw problem('CATEGORY_MISMATCH','Select an active category of the same type.');
}
export async function deleteCategory(id,user) {
  const categoryId=positiveId(id);
  return withTransaction(async conn=>{
    const [[category]]=await conn.execute('SELECT id,kind,name FROM finance_categories WHERE id=? FOR UPDATE',[categoryId]);
    if(!category) throw problem('NOT_FOUND','Category not found.',404);
    const inUse=()=>problem('CATEGORY_IN_USE','This category is used in Finance records. Disable it to keep its history.',409);
    const [[usage]]=await conn.execute(`SELECT ${categoryUnused} AS can_delete FROM finance_categories c WHERE c.id=?`,[categoryId]);
    if(!Number(usage?.can_delete)) throw inUse();
    try {
      await conn.execute('DELETE FROM finance_categories WHERE id=?',[categoryId]);
    } catch(error) {
      if(['ER_ROW_IS_REFERENCED','ER_ROW_IS_REFERENCED_2'].includes(error.code)) {
        throw inUse();
      }
      throw error;
    }
    await audit(conn,user.id,'category.deleted','category',categoryId,{kind:category.kind,name:category.name});
    return {id:categoryId};
  });
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
  if(rows[0].source_system!=='manual')throw problem('IMPORTED_IMMUTABLE','Manage imported payments from Imports. Use Undo import to remove their file.',409);
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
export async function listTransactions(query={},pool=getPool()) {
  const {from,to}=validateRange(query), kind=query.kind||'all';
  if(!['all','income','expense'].includes(kind))throw problem('INVALID_KIND','Invalid type filter.');
  const status=query.status||'posted';if(!['posted','void','all'].includes(status))throw problem('INVALID_STATUS','Invalid status filter.');
  const source=query.source||'all';if(!['all','manual','realty','hr'].includes(source))throw problem('INVALID_SOURCE','Invalid source filter.');
  const page=Number(query.page??1),pageSize=Number(query.page_size??50);
  if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw problem('INVALID_PAGE','Choose a valid page and size.');
  let where=' WHERE t.transaction_date BETWEEN ? AND ?';const values=[from,to];
  if(kind!=='all'){where+=' AND t.kind=?';values.push(kind);}
  if(status!=='all'){where+=' AND t.status=?';values.push(status);}
  if(source!=='all'){where+=' AND t.source_system=?';values.push(source);}
  if(query.category_id){where+=' AND t.category_id=?';values.push(positiveId(query.category_id));}
  const [count]=await pool.execute('SELECT COUNT(*) AS total FROM finance_transactions t'+where,values);
  const [rows]=await pool.execute(`SELECT t.id,DATE_FORMAT(t.transaction_date,'%Y-%m-%d') AS transaction_date,t.kind,t.amount,t.description,t.notes,t.status,t.source_system,t.source_transaction_id,t.corrected_from_transaction_id,t.void_reason,t.created_at,c.name AS category_name,c.id AS category_id FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id ${where} ORDER BY t.transaction_date DESC,t.id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`,[...values]);
  return {transactions:rows,total:Number(count[0].total),page,page_size:pageSize};
}
export async function getTransaction(id, {includeImport=false}={}) {
  const transactionId=positiveId(id);
  const pool=getPool();
  const [[transaction]]=await pool.execute(`SELECT t.id,t.transaction_date,t.kind,t.amount,t.description,t.notes,t.status,
    t.source_system,t.source_transaction_id,t.void_reason,c.id AS category_id,c.name AS category_name
    FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id WHERE t.id=?`,[transactionId]);
  if(!transaction) throw problem('NOT_FOUND','Transaction not found.',404);
  if(includeImport && transaction.source_system!=='manual') {
    const [[receipt]]=await pool.execute(`SELECT b.id,b.file_name,b.committed_at,u.display_name AS imported_by
      FROM finance_import_items i JOIN finance_import_batches b ON b.id=i.batch_id
      LEFT JOIN finance_users u ON u.id=b.committed_by
      WHERE i.transaction_id=? AND i.decision='imported' AND b.status IN ('committed','undone')
      ORDER BY b.committed_at,b.id LIMIT 1`,[transactionId]);
    transaction.original_import=receipt??null;
  }
  return transaction;
}
export async function getDashboard(query={},pool=getPool()) {
  const {from,to}=validateRange(query); // all-time starting cash = 0.00
  return getFinanceReport({from,to},pool);
}
export async function listAudit(query={},pool=getPool()) {
  const page=Number(query.page??1);
  if(!Number.isSafeInteger(page)||page<1||page>100000) throw problem('INVALID_PAGE','Invalid page.');
  const filters=[],params=[];
  if(query.actor) {
    filters.push('a.actor_user_id=?');
    params.push(positiveId(query.actor));
  }
  if(query.action) {
    if(!/^[a-z0-9._]{1,120}$/.test(query.action)) throw problem('INVALID_ACTION','Choose a valid audit action.');
    filters.push('a.action=?');
    params.push(query.action);
  }
  const from=query.from?validDate(query.from):null,to=query.to?validDate(query.to):null;
  if(from&&to&&from>to) throw problem('INVALID_RANGE','From date cannot follow To date.');
  const manilaMidnight=day=>Date.parse(day+'T00:00:00+08:00')/1000;
  if(from){filters.push('UNIX_TIMESTAMP(a.created_at)>=?');params.push(manilaMidnight(from));}
  if(to){filters.push('UNIX_TIMESTAMP(a.created_at)<?');params.push(manilaMidnight(to)+86400);}
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  const pageSize=50;
  const [rows]=await pool.execute(`SELECT a.id,a.actor_user_id,u.display_name AS actor_name,a.action,a.entity_type,a.entity_id,a.metadata_json,
    UNIX_TIMESTAMP(a.created_at) AS recorded_epoch
    FROM finance_audit_logs a LEFT JOIN finance_users u ON u.id=a.actor_user_id${where}
    ORDER BY a.id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`,params.length?params:undefined);
  const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM finance_audit_logs a'+where,params.length?params:undefined);
  const redact=(value,key='')=>/password|token|secret|cookie|signature|bank|pin|account.?number|otp|verification.?code/i.test(key)?'[REDACTED]':Array.isArray(value)?value.map(v=>redact(v)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,k)])):value;
  const clock=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  return {items:rows.map(({recorded_epoch,...row})=>{
    let details=row.metadata_json;
    try{if(typeof details==='string')details=JSON.parse(details)}catch{details={description:'Details unavailable.'}}
    const recorded=new Date(Number(recorded_epoch)*1000);
    return {...row,recorded_at_utc:recorded.toISOString(),created_at:clock.format(recorded),metadata_json:redact(details)};
  }),page,page_size:pageSize,total:Number(count.total)};
}

