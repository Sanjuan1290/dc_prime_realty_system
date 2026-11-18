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
  let opening=0n,income=0n,expense=0n,periodCount=0,matchedCount=0;
  const filtered={income:0n,expense:0n};

  for(const row of rows){
    const amount=asCents(row.amount);
    const isIncome=row.kind==='income';
    if(!row.bucket){
      opening+=isIncome?amount:-amount;
      continue;
    }

    const period=periods.get(row.bucket)??{net:0n,income:0n,expense:0n};
    period.net+=isIncome?amount:-amount;
    periods.set(row.bucket,period);
    periodCount+=Number(row.record_count);
    if(isIncome) income+=amount;
    else expense+=amount;

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
  const [rows]=await pool.execute(`SELECT '' AS bucket,t.kind,NULL AS source_system,NULL AS category_id,
      NULL AS category_name,SUM(t.amount) AS amount,COUNT(*) AS record_count
    FROM finance_transactions t WHERE t.status='posted' AND t.transaction_date<? GROUP BY t.kind
    UNION ALL
    SELECT DATE_FORMAT(t.transaction_date,?) AS bucket,t.kind,t.source_system,c.id,c.name,
      SUM(t.amount) AS amount,COUNT(*) AS record_count
    FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id
    WHERE t.status='posted' AND t.transaction_date BETWEEN ? AND ?
    GROUP BY bucket,t.kind,t.source_system,c.id,c.name`,[from,format,from,to]);
  return buildFinanceReport(rows,{from,to,kind,source,category_id});
}
