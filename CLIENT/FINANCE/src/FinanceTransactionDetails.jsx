import {useEffect,useState} from 'react';
import {api} from './api.js';
import {Dialog,Notice,Spinner} from './FinanceFeedback.jsx';
import {financeDateTime,financeMoney,financeSourceLabel} from './financeFormat.js';

export default function FinanceTransactionDetails({id,onClose}){
  const [record,setRecord]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    let current=true;
    api('/finance/transactions/'+encodeURIComponent(id)).then(result=>{if(current)setRecord(result)})
      .catch(failure=>{if(current)setError(failure.message)});
    return ()=>{current=false};
  },[id]);

  return <Dialog title={`Finance record #${id}`} onClose={onClose}>
    {!record&&!error&&<div className="dialog-loading"><Spinner label="Loading ledger entry…"/></div>}
    {error&&<Notice type="error" title="Couldn’t load the ledger entry">{error}</Notice>}
    {record&&<><h3>{record.description}</h3><dl className="finance-record-fields">
      <div><dt>Amount</dt><dd>{record.kind==='expense'?'−':'+'}{financeMoney(record.amount)}</dd></div>
      <div><dt>Transaction date</dt><dd>{record.transaction_date}</dd></div>
      <div><dt>Category</dt><dd>{record.category_name}</dd></div>
      <div><dt>Status</dt><dd>{record.status==='posted'?'Posted':'Voided'}</dd></div>
      <div><dt>Source</dt><dd>{financeSourceLabel(record.source_system)}</dd></div>
      {record.source_transaction_id&&<div><dt>Source reference</dt><dd>{record.source_transaction_id}</dd></div>}
      {record.original_import&&<>
        <div><dt>Original import</dt><dd>{financeDateTime(record.original_import.committed_at)} · Philippine Time</dd></div>
        <div><dt>Import file</dt><dd>{record.original_import.file_name}</dd></div>
        {record.original_import.imported_by&&<div><dt>Imported by</dt><dd>{record.original_import.imported_by}</dd></div>}
      </>}
      {record.void_reason&&<div><dt>Void reason</dt><dd>{record.void_reason}</dd></div>}
      {record.notes&&<div><dt>Notes</dt><dd>{record.notes}</dd></div>}
    </dl></>}
    <div className="action-row"><button className="btn" type="button" onClick={onClose}>Close</button></div>
  </Dialog>;
}
