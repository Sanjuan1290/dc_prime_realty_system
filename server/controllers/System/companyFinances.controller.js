import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { getFinanceSettings, loadFinanceSummary, validateFinanceEntry, moneyAmount, dateOnly, buildFinanceCsv } from '../../services/companyFinances.service.js';
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
    if(!data.configured)throw bad('Set your opening balance before exporting transactions.','FINANCE_NOT_CONFIGURED',409);
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="DCP-Company-Finances-${from}-to-${to}.csv"`);
    res.setHeader('Cache-Control','no-store');
    return res.send(buildFinanceCsv(data.transactions));
  } catch(e){return respondError(res,e)}
};
export const categories=async(_req,res)=>{
  try {const [rows]=await db.query('SELECT id,kind,name,protected,is_active FROM company_finance_categories ORDER BY kind,name');return res.json({success:true,data:rows})}catch(e){return respondError(res,e)}
};
export const saveOpeningBalance=(req,res)=>withTransaction(req,res,async connection=>{
  const [rows]=await connection.query('SELECT start_date,opening_balance FROM company_finance_settings WHERE id=1 FOR UPDATE');
  if(!rows[0]) throw bad('Run the Company Finances database migration first.','FINANCE_SETUP_REQUIRED',409);
  if(rows[0].start_date || rows[0].opening_balance!==null) throw bad('Opening balance is already saved. Request a controlled correction instead.','OPENING_BALANCE_LOCKED',409);
  const start=dateOnly(req.body?.start_date);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(start>today) throw bad('Starting date cannot be in the future.');
  const opening=String(req.body?.opening_balance ?? '').trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(opening)||!Number.isFinite(Number(opening))||Number(opening)>99999999999999.99)throw bad('Enter a valid opening balance.');
  await connection.query(`UPDATE company_finance_settings SET start_date=?,opening_balance=?,includes_property_collections=?,set_by_user_id=?,set_at=CURRENT_TIMESTAMP WHERE id=1`,
    [start,Number(opening).toFixed(2),req.body?.includes_property_collections===false?0:1,req.authUser.id]);
  await audit(connection,req,'Opening Balance Set',1,{start,opening,includesPropertyCollections:req.body?.includes_property_collections!==false});
  return {start_date:start,opening_balance:Number(opening)};
});
/** Authorized corrections keep original transactions untouched, require a reason, and
 * record before/after settings in the existing Audit Logs. */
export const correctOpeningBalance=(req,res)=>withTransaction(req,res,async connection=>{
  const [rows]=await connection.query('SELECT start_date,opening_balance,includes_property_collections FROM company_finance_settings WHERE id=1 FOR UPDATE');
  if(!rows[0]||rows[0].opening_balance===null||!rows[0].start_date)throw bad('Set the starting balance first.','FINANCE_SETUP_REQUIRED',409);
  const before={
    start_date:dateOnly(rows[0].start_date instanceof Date?rows[0].start_date.toISOString().slice(0,10):String(rows[0].start_date).slice(0,10)),
    opening_balance:Number(rows[0].opening_balance),
    includes_property_collections:Number(rows[0].includes_property_collections)===1,
  };
  const start=dateOnly(req.body?.start_date);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(start>today)throw bad('Starting date cannot be in the future.');
  const raw=String(req.body?.opening_balance??'').trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)>99999999999999.99)throw bad('Enter a valid opening balance.');
  if(typeof req.body?.includes_property_collections!=='boolean')throw bad('Choose whether property collections are included.');
  const reason=String(req.body?.reason||'').trim();
  if(reason.length<10||reason.length>500)throw bad('Explain the correction in at least 10 characters.');
  if(req.body?.confirmed!==true)throw bad('Confirm that the new opening balance does not include payments that will now be counted again.');
  const [earlierManual]=await connection.query(`SELECT COUNT(*) AS count FROM company_finance_transactions
    WHERE status='posted' AND transaction_date < ?`,[start]);
  if(Number(earlierManual[0]?.count)>0)throw bad('Starting date cannot exclude saved manual transactions. Choose an earlier date.','FINANCE_DATE_CONFLICT',409);
  const after={start_date:start,opening_balance:Number(raw),includes_property_collections:req.body.includes_property_collections};
  if(before.start_date===after.start_date&&before.opening_balance===after.opening_balance&&before.includes_property_collections===after.includes_property_collections)throw bad('No changes to save.');
  await connection.query(`UPDATE company_finance_settings
    SET start_date=?,opening_balance=?,includes_property_collections=?,set_by_user_id=?,set_at=CURRENT_TIMESTAMP WHERE id=1`,
    [after.start_date,after.opening_balance.toFixed(2),after.includes_property_collections?1:0,req.authUser.id]);
  await audit(connection,req,'Finance Starting Balance Corrected',1,{before,after,reason});
  return after;
});
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
const getReadySettings=async connection=>{
  const s=await getFinanceSettings(connection);
  return {...s,start_date:s?.start_date instanceof Date?s.start_date.toISOString().slice(0,10):String(s?.start_date||'').slice(0,10)};
};
export const createTransaction=(req,res)=>withTransaction(req,res,async connection=>{
  const entry=validateFinanceEntry(req.body||{},await getReadySettings(connection));await validateCategory(connection,entry);
  const [result]=await connection.query(`INSERT INTO company_finance_transactions (category_id,kind,amount,transaction_date,description,notes,created_by_user_id)
    VALUES (?,?,?,?,?,?,?)`,[entry.categoryId,entry.kind,entry.amount,entry.transactionDate,entry.description,entry.notes,req.authUser.id]);
  await audit(connection,req,'Manual Transaction Added',result.insertId,entry);
  return {id:result.insertId,...entry};
});
export const updateTransaction=(req,res)=>withTransaction(req,res,async connection=>{
  const txid=id(req.params.id);const [rows]=await connection.query('SELECT * FROM company_finance_transactions WHERE id=? FOR UPDATE',[txid]);
  if(!rows.length||rows[0].status!=='posted')throw bad('Only active manual transactions can be edited.','NOT_EDITABLE',409);
  const prev=rows[0]; const entry=validateFinanceEntry(req.body||{},await getReadySettings(connection));
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
