import {financeMoney as peso,financeSourceLabel} from './financeFormat.js';

const states={
  new:['New','new'],restore:['To Restore','restore'],duplicate:['Already Imported','duplicate'],
  conflict:['Needs Review','conflict'],imported:['Imported','new'],restored:['Restored','restore'],unmapped:['Needs Review','conflict'],
};
const amountCents=amount=>{
  const [whole,fraction='']=String(amount??0).split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
};

export function ImportBreakdown({items,history=false}){
  const keys=history?['imported','restored','duplicate','conflict']:['new','restore','duplicate','conflict'];
  const groups=keys.map(key=>{
    const rows=items.filter(item=>item.decision===key||(key==='conflict'&&item.decision==='unmapped'));
    const totals={income:0n,expense:0n};
    for(const row of rows) totals[row.kind]+=amountCents(row.amount);
    const decimal=cents=>String(cents/100n)+'.'+String(cents%100n).padStart(2,'0');
    return {key,count:rows.length,income:peso(decimal(totals.income)),expense:peso(decimal(totals.expense))};
  });
  return <dl className="import-breakdown" aria-label="Payment breakdown">
    {groups.map(group=><div key={group.key}>
      <dt>{states[group.key][0]}</dt><dd><strong>{group.count}</strong>
        {group.count>0&&<small>{group.income} in · {group.expense} out</small>}
      </dd>
    </div>)}
  </dl>;
}

export function ImportRecordRows({items,onViewTransaction}){
  if(!items.length) return <p className="muted">No payment records are available for this import.</p>;
  return <div className="table-wrap import-record-table"><table>
    <thead><tr><th scope="col">Payment</th><th scope="col">Date</th><th scope="col">Category</th>
      <th scope="col" className="align-right">Amount</th><th scope="col">Status</th></tr></thead>
    <tbody>{items.map(item=><tr key={item.row_number}>
      <td><strong>{item.description||financeSourceLabel(item.source_system)}</strong>
        <span className="cell-secondary">{financeSourceLabel(item.source_system)} · {item.source_transaction_id}</span></td>
      <td>{String(item.transaction_date||'—').slice(0,10)}</td>
      <td>{item.category_name||item.source_category||'—'}</td>
      <td className="align-right">{item.kind==='expense'?'−':'+'}{peso(item.amount)}</td>
      <td><span className={'pill decision-'+(states[item.decision]?.[1]||'conflict')}>{states[item.decision]?.[0]||'Needs Review'}</span>
        {item.ledger_status==='void'&&<small className="cell-secondary">Ledger entry voided</small>}
        {item.existing_transaction_id&&<button type="button" className="text-btn cell-secondary"
          onClick={()=>onViewTransaction(item.existing_transaction_id)}>View Finance record #{item.existing_transaction_id}</button>}
      </td>
    </tr>)}</tbody>
  </table></div>;
}
