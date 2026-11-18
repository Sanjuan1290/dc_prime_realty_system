import {getPool} from './db.js';
import {pesos, problem, validateRange} from './domain.js';

const DAY_MS=86_400_000;
const sourceFilter=['all','manual','realty','hr'];
const bucketFormats={day:'%Y-%m-%d',month:'%Y-%m',year:'%Y'};
const utcDate=day=>new Date(day+'T00:00:00Z');

function getBucketSize(from,to){
  const days=(utcDate(to)-utcDate(from))/DAY_MS;
  if(days<=45) return 'day';
  return days<=730?'month':'year';
}

const nextBucket={
  day:date=>date.setUTCDate(date.getUTCDate()+1),
  month:date=>date.setUTCMonth(date.getUTCMonth()+1),
  year:date=>date.setUTCFullYear(date.getUTCFullYear()+1),
};

function asCents(decimal){
  const [whole,fraction='']=String(decimal).split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}

export function buildFinanceReport(rows,{from,to,kind='all',source='all',category_id=''}){
  const bucketSize=getBucketSize(from,to);
  const keyLength={day:10,month:7,year:4}[bucketSize];
  const periods=new Map(),categories=new Map();
  let opening=0n,income=0n,expense=0n,periodCount=0,matchedCount=0,openingCount=0,correctionCount=0;
  const corrections={income:0n,expense:0n};
  const filtered={income:0n,expense:0n};

  for(const row of rows){
    const amount=asCents(row.amount);
    const isIncome=row.kind==='income';
    if(!row.bucket){
      opening+=isIncome?amount:-amount;
      openingCount+=Number(row.record_count);
      continue;
    }

    const period=periods.get(row.bucket)??{net:0n,income:0n,expense:0n};
    period.net+=isIncome?amount:-amount;
    periods.set(row.bucket,period);
    periodCount+=Number(row.record_count);
    if(isIncome) income+=amount;
    else expense+=amount;
    corrections[row.kind]+=asCents(row.payroll_correction_amount??'0.00');
    correctionCount+=Number(row.payroll_correction_count??0);

    if((kind!=='all'&&row.kind!==kind)||(source!=='all'&&row.source_system!==source)||
      (category_id&&String(row.category_id)!==category_id)) continue;

    period[row.kind]+=amount;
    filtered[row.kind]+=amount;
    matchedCount+=Number(row.record_count);
    const key=row.kind+'/'+row.category_id;
    const category=categories.get(key)??{id:String(row.category_id),name:row.category_name,kind:row.kind,amount:0n,count:0};
    category.amount+=amount;
    category.count+=Number(row.record_count);
    categories.set(key,category);
  }

  const bucketStart=bucketSize==='year'?from.slice(0,4)+'-01-01':bucketSize==='month'?from.slice(0,7)+'-01':from;
  const date=utcDate(bucketStart),end=utcDate(to);
  let balance=opening;
  const series=[];
  while(date<=end){
    const label=date.toISOString().slice(0,keyLength);
    const period=periods.get(label)??{net:0n,income:0n,expense:0n};
    balance+=period.net;
    series.push({label,income:pesos(period.income),expense:pesos(period.expense),balance:pesos(balance)});
    nextBucket[bucketSize](date);
  }

  return {
    from,to,bucket_size:bucketSize,currency:'PHP',
    filters:{kind,source,category_id},
    opening_balance:pesos(opening),money_in:pesos(income),money_out:pesos(expense),
    net_change:pesos(income-expense),closing_balance:pesos(opening+income-expense),
    actual_money_in:pesos(income-corrections.income),actual_money_out:pesos(expense-corrections.expense),
    payroll_correction_money_in:pesos(corrections.income),payroll_correction_money_out:pesos(corrections.expense),
    payroll_correction_count:correctionCount,total_posted:openingCount+periodCount,
    period_count:periodCount,matched_count:matchedCount,
    filtered_money_in:pesos(filtered.income),filtered_money_out:pesos(filtered.expense),
    series,
    categories:[...categories.values()]
      .sort((a,b)=>a.amount===b.amount?a.name.localeCompare(b.name):a.amount>b.amount?-1:1)
      .map(category=>({...category,amount:pesos(category.amount)})),
  };
}

export async function getFinanceReport(query={},pool=getPool()){
  const {from,to}=validateRange(query);
  const kind=query.kind??'all',source=query.source??'all';
  const category_id=String(query.category_id??'');
  if(!['all','income','expense'].includes(kind)||!sourceFilter.includes(source)||
    (category_id&&!/^[1-9]\d{0,17}$/.test(category_id))){
    throw problem('INVALID_REPORT_FILTER','Choose a valid report type, source, and category.');
  }
  const format=bucketFormats[getBucketSize(from,to)];
  // Match verified HR reversal identities to their exact preceding release.
  // EXISTS proves legacy HR provenance without multiplying rows for repeated imports.
  // The report is a single statement so gross and adjusted totals share a snapshot.
  const [rows]=await pool.execute(`WITH matched_payroll_corrections AS (
    SELECT r.id AS reversal_id,p.id AS release_id
    FROM finance_transactions r JOIN finance_transactions p
      ON p.source_transaction_id=CONCAT(SUBSTRING_INDEX(r.source_transaction_id,':',2),
        CASE WHEN CAST(SUBSTRING_INDEX(r.source_transaction_id,':',-1) AS UNSIGNED)=2 THEN ''
          ELSE CONCAT(':',CAST(SUBSTRING_INDEX(r.source_transaction_id,':',-1) AS UNSIGNED)-1) END)
      AND p.source_system IN ('hr','realty') AND p.kind='expense' AND p.status='posted'
      AND p.amount=r.amount AND p.transaction_date<=r.transaction_date
    WHERE r.source_system='hr' AND r.kind='income' AND r.status='posted' AND r.transaction_date<=?
      AND r.source_transaction_id REGEXP '^salary:[1-9][0-9]*:[1-9][0-9]*$'
      AND CAST(SUBSTRING_INDEX(r.source_transaction_id,':',-1) AS UNSIGNED) BETWEEN 2 AND 100000
      AND MOD(CAST(SUBSTRING_INDEX(r.source_transaction_id,':',-1) AS UNSIGNED),2)=0
      AND (p.source_system='hr' OR EXISTS (
        SELECT 1 FROM finance_import_items i JOIN finance_import_batches b ON b.id=i.batch_id
        WHERE i.transaction_id=p.id AND b.status IN ('committed','undone')
          AND JSON_UNQUOTE(JSON_EXTRACT(b.manifest_json,'$.salary_source'))='external'
          AND JSON_UNQUOTE(JSON_EXTRACT(i.source_row_json,'$.source_type'))='salary'))
    ), payroll_correction_ids AS (
      SELECT release_id AS id FROM matched_payroll_corrections
      UNION SELECT reversal_id AS id FROM matched_payroll_corrections
    )
    SELECT '' AS bucket,t.kind,NULL AS source_system,NULL AS category_id,
      NULL AS category_name,SUM(t.amount) AS amount,COUNT(*) AS record_count,
      0 AS payroll_correction_amount,0 AS payroll_correction_count
    FROM finance_transactions t WHERE t.status='posted' AND t.transaction_date<? GROUP BY t.kind
    UNION ALL
    SELECT DATE_FORMAT(t.transaction_date,?) AS bucket,t.kind,t.source_system,c.id,c.name,
      SUM(t.amount) AS amount,COUNT(*) AS record_count,
      SUM(CASE WHEN x.id IS NOT NULL THEN t.amount ELSE 0 END) AS payroll_correction_amount,
      COUNT(x.id) AS payroll_correction_count
    FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id
    LEFT JOIN payroll_correction_ids x ON x.id=t.id
    WHERE t.status='posted' AND t.transaction_date BETWEEN ? AND ?
    GROUP BY bucket,t.kind,t.source_system,c.id,c.name`,[to,from,format,from,to]);
  return buildFinanceReport(rows,{from,to,kind,source,category_id});
}
