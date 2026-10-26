import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { loadFinanceSummary, validateFinanceEntry, dateOnly, buildFinanceCsv } from '../../services/companyFinances.service.js';
const respondError=(res,e)=>res.status(e.statusCode||500).json({success:false,code:e.code||'FINANCE_ERROR',message:e.statusCode?e.message:'Unable to save company finances.'});
const bad=(msg,code='FINANCE_INVALID',statusCode=400)=>Object.assign(new Error(msg),{code,statusCode});
const id=(value)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw bad('Invalid record.');return n};
const withTransaction=async(req,res,run)=>{
  const connection=await db.getConnection();
  try {await connection.beginTransaction();const data=await run(connection);await connection.commit();return res.json({success:true,data});}
  catch(e){try{await connection.rollback()}catch{}return respondError(res,e)}finally{connection.release()}
};
const audit=async(connection,req,title,entityId,metadata)=>writeAuditLog(connection,req,{
  actor:req.authUser,action:'update',module:'Company Finances',entityType:'company_finance',
  entityId:String(entityId),entityLabel:title,title,description:title,metadata,
});

export const overview=async(req,res)=>{
  try{
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const to=dateOnly(req.query.to||today);
    const from=dateOnly(req.query.from||`${to.slice(0,7)}-01`);
    const data=await loadFinanceSummary(db,{from,to,page:req.query.page ?? 1});
    return res.json({success:true,data});
  }catch(e){return respondError(res,e)}
};
/** All matching rows, not the paginated table subset. Financial reports remain unchanged. */
export const exportTransactions = async(req,res)=>{
  try {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const to=dateOnly(req.query.to||today);
    const from=dateOnly(req.query.from||`${to.slice(0,7)}-01`);
    const data=await loadFinanceSummary(db,{from,to,allTransactions:true});
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="DCP-Company-Finances-${from}-to-${to}.csv"`);
    res.setHeader('Cache-Control','no-store');
    return res.send(buildFinanceCsv(data.transactions));
  } catch(e){return respondError(res,e)}
};
export const categories=async(_req,res)=>{
  try {const [rows]=await db.query('SELECT id,kind,name,protected,is_active FROM company_finance_categories ORDER BY kind,name');return res.json({success:true,data:rows})}catch(e){return respondError(res,e)}
};
export const createCategory=(req,res)=>withTransaction(req,res,async connection=>{
  const kind=req.body?.kind;const name=String(req.body?.name||'').trim();
  if(!['income','expense'].includes(kind)||name.length<2||name.length>90)throw bad('Choose a type and enter a category name (2–90 characters).');
  const [existing]=await connection.query('SELECT id FROM company_finance_categories WHERE kind=? AND LOWER(name)=LOWER(?) LIMIT 1',[kind,name]);
  if(existing.length)throw bad('That category already exists.');
  const [result]=await connection.query('INSERT INTO company_finance_categories (kind,name,created_by_user_id) VALUES (?,?,?)',[kind,name,req.authUser.id]);
  await audit(connection,req,'Category Added',result.insertId,{kind,name});return {id:result.insertId,kind,name};
});
export const updateCategory=(req,res)=>withTransaction(req,res,async connection=>{
  const categoryId=id(req.params.id);const [rows]=await connection.query('SELECT * FROM company_finance_categories WHERE id=? FOR UPDATE',[categoryId]);
  if(!rows.length)throw bad('Category not found.','NOT_FOUND',404);
  const name=String(req.body?.name??rows[0].name).trim();const active=req.body?.is_active===undefined?Number(rows[0].is_active):req.body.is_active?1:0;
  if(name.length<2||name.length>90)throw bad('Category name must be 2–90 characters.');
  if(Number(rows[0].protected) && (name!==rows[0].name||active===0))throw bad('Automatic categories cannot be renamed or archived.');
  const [sameName]=await connection.query('SELECT id FROM company_finance_categories WHERE kind=? AND LOWER(name)=LOWER(?) AND id<>? LIMIT 1',[rows[0].kind,name,categoryId]);
  if(sameName.length)throw bad('That category already exists.');
  await connection.query('UPDATE company_finance_categories SET name=?,is_active=? WHERE id=?',[name,active,categoryId]);
  await audit(connection,req,'Category Updated',categoryId,{before:{name:rows[0].name,is_active:rows[0].is_active},after:{name,is_active:active}});
  return {id:categoryId,name,is_active:active};
});
const validateCategory=async(connection,entry)=>{
  const [rows]=await connection.query('SELECT kind,is_active FROM company_finance_categories WHERE id=?',[entry.categoryId]);
  if(!rows.length||rows[0].kind!==entry.kind||!Number(rows[0].is_active))throw bad('Choose an active category matching Income or Expense.');
};
export const createTransaction=(req,res)=>withTransaction(req,res,async connection=>{
  const entry=validateFinanceEntry(req.body||{});await validateCategory(connection,entry);
  const [result]=await connection.query(`INSERT INTO company_finance_transactions (category_id,kind,amount,transaction_date,description,notes,created_by_user_id)
    VALUES (?,?,?,?,?,?,?)`,[entry.categoryId,entry.kind,entry.amount,entry.transactionDate,entry.description,entry.notes,req.authUser.id]);
  await audit(connection,req,'Manual Transaction Added',result.insertId,entry);
  return {id:result.insertId,...entry};
});
export const updateTransaction=(req,res)=>withTransaction(req,res,async connection=>{
  const txid=id(req.params.id);const [rows]=await connection.query('SELECT * FROM company_finance_transactions WHERE id=? FOR UPDATE',[txid]);
  if(!rows.length||rows[0].status!=='posted')throw bad('Only active manual transactions can be edited.','NOT_EDITABLE',409);
  const prev=rows[0]; const entry=validateFinanceEntry(req.body||{});
  if(entry.kind!==prev.kind)throw bad('Income and Expense types cannot be changed while editing.','FINANCE_TYPE_LOCKED',409);
  await validateCategory(connection,entry);
  await connection.query(`UPDATE company_finance_transactions SET category_id=?,kind=?,amount=?,transaction_date=?,description=?,notes=?,updated_by_user_id=? WHERE id=?`,
    [entry.categoryId,entry.kind,entry.amount,entry.transactionDate,entry.description,entry.notes,req.authUser.id,txid]);
  await audit(connection,req,'Manual Transaction Corrected',txid,{before:{kind:prev.kind,amount:prev.amount,transaction_date:prev.transaction_date,category_id:prev.category_id},after:entry});
  return {id:txid,...entry};
});
export const voidTransaction=(req,res)=>withTransaction(req,res,async connection=>{
  const txid=id(req.params.id);const reason=String(req.body?.reason||'').trim();
  if(reason.length<5||reason.length>500)throw bad('Enter a reason for removing this transaction (5–500 characters).');
  const [result]=await connection.query(`UPDATE company_finance_transactions SET status='void',void_reason=?,voided_at=CURRENT_TIMESTAMP,voided_by_user_id=? WHERE id=? AND status='posted'`,[reason,req.authUser.id,txid]);
  if(result.affectedRows!==1)throw bad('This manual transaction is no longer active.','NOT_EDITABLE',409);
  await audit(connection,req,'Manual Transaction Voided',txid,{reason});return {id:txid,status:'void'};
});
