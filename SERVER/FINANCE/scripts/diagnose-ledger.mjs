// Read-only TiDB ledger diagnosis. Run from SERVER/FINANCE with configured database env.
import 'dotenv/config';
import { getPool, assertSafeDatabase } from '../src/db.js';
import { listTransactions, getDashboard, listCategories } from '../src/ledger.js';

const required = {
  finance_transactions: ['id','transaction_date','kind','amount','category_id','description','notes','status','source_system','source_transaction_id','corrected_from_transaction_id','void_reason','created_at'],
  finance_categories: ['id','kind','name','is_active'],
  finance_audit_logs: ['id','actor_user_id','action','entity_type','entity_id','metadata_json','created_at'],
};
let pool;
try {
  assertSafeDatabase();
  pool = getPool();
  const [dbRows] = await pool.query('SELECT DATABASE() AS db');
  console.log('Connected database:',dbRows[0]?.db);
  let missing=0;
  for(const [table,columns] of Object.entries(required)) {
    const [rows]=await pool.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',[dbRows[0].db,table]);
    const found=new Set(rows.map(r=>String(r.COLUMN_NAME).toLowerCase()));
    const absent=columns.filter(c=>!found.has(c.toLowerCase()));
    if(absent.length) {missing+=absent.length;console.error('Missing schema columns:',table,absent.join(', '));}
    else console.log('Schema OK:',table);
  }
  const query={from:'2026-10-01',to:'2026-10-30',page:'1',page_size:'50',status:'posted',kind:'all'};
  for(const [name,fn] of [['categories',()=>listCategories()],['dashboard',()=>getDashboard(query)],['transactions',()=>listTransactions(query)]]) {
    try {const data=await fn();console.log(name,'OK',name==='transactions'?'rows='+data.transactions.length:'query completed');}
    catch(err){missing++;console.error(name,'FAILED',{code:err.code,errno:err.errno,sqlState:err.sqlState,message:err.message});}
  }
  if(missing)process.exitCode=1;
} catch(err) {
  console.error('Finance diagnostic failed:',{code:err.code,errno:err.errno,sqlState:err.sqlState,message:err.message});
  process.exitCode=1;
} finally {
  if (pool) await pool.end().catch(()=>{});
}
