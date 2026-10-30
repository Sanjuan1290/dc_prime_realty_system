import {getPool} from './db.js';
import {dateInManila} from './domain.js';
import {evaluateReconciliation,validateReconciliationRange,MAX_RECON_ROWS} from './reconciliationPolicy.js';
/** Select-only, consistent Finance DB snapshot. Never queries Realty or HR. */
export async function getFinanceReconciliation(query={},pool=getPool()){
  const {from,to}=validateReconciliationRange(query,dateInManila());
  const conn=await pool.getConnection();
  try{
    // TiDB uses snapshot isolation for the plain SELECTs in this transaction.
    await conn.beginTransaction();
    const [ledgerRows]=await conn.execute(`SELECT id,source_system,source_transaction_id,source_revision_sha256,
      DATE_FORMAT(transaction_date,'%Y-%m-%d') AS transaction_date,kind,amount,status,category_id
      FROM finance_transactions WHERE source_system<>'manual' AND transaction_date BETWEEN ? AND ?
      ORDER BY id LIMIT ?`,[from,to,MAX_RECON_ROWS+1]);
    const [receiptRows]=await conn.execute(`SELECT i.batch_id,i.decision,i.transaction_id,i.source_system,i.source_transaction_id,
      i.source_revision_sha256,i.category_id,i.source_row_json,b.total_rows,b.selected_money_in,b.selected_money_out
      FROM finance_import_items i JOIN finance_import_batches b ON b.id=i.batch_id
      WHERE b.status='committed' AND b.source_from<=? AND b.source_to>=?
      ORDER BY b.id,i.row_number LIMIT ?`,[to,from,MAX_RECON_ROWS+1]);
    const [aggregateRows]=await conn.execute(`SELECT source_system,kind,
      COALESCE(SUM(CASE WHEN transaction_date < ? THEN amount ELSE 0 END),0) AS opening_amount,
      COALESCE(SUM(CASE WHEN transaction_date >= ? THEN amount ELSE 0 END),0) AS period_amount
      FROM finance_transactions WHERE status='posted' AND transaction_date <= ? GROUP BY source_system,kind`,[from,from,to]);
    const [conflicts]=await conn.execute(`SELECT COUNT(DISTINCT b.id) AS count FROM finance_import_batches b
      JOIN finance_import_items i ON i.batch_id=b.id WHERE b.status='preview'
      AND b.source_from<=? AND b.source_to>=?
      AND b.created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 MINUTE)
      AND i.decision IN ('conflict','unmapped')`,[to,from]);
    const truncated=ledgerRows.length>MAX_RECON_ROWS||receiptRows.length>MAX_RECON_ROWS;
    return evaluateReconciliation({from,to,ledgerRows:ledgerRows.slice(0,MAX_RECON_ROWS),receiptRows:receiptRows.slice(0,MAX_RECON_ROWS),aggregateRows,activeConflicts:Number(conflicts[0]?.count||0),truncated});
  }finally{try{await conn.rollback();}finally{conn.release();}}
}
