import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {FiArrowRight,FiCheck,FiCheckCircle,FiClock,FiFile,FiInbox,FiRotateCcw,FiShield,FiTrash2,FiUploadCloud} from 'react-icons/fi';
import {financeMoney as peso,sumPayments,financeDateTime} from './financeFormat.js';
import {ImportBreakdown,ImportRecordRows} from './ImportRecords.jsx';
import {api} from './api.js';
import {Dialog,Notice,Spinner} from './FinanceFeedback.jsx';
import Pagination from '../../shared/Pagination.jsx';

const MAX_BYTES=2*1024*1024;
const json=value=>{try{return typeof value==='string'?JSON.parse(value):value||{}}catch{return {}}};
const date=value=>String(value||'').slice(0,10);
const source=value=>value==='hr'?'HR & Payroll':'Company Finances';
const toBase64=async file=>{const bytes=new Uint8Array(await file.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s)};

function Summary({income,expense,label='Payments in this file'}){return <div className="import-summary" aria-label={label}><div><span>Money in</span><strong className="amount-income">{peso(income)}</strong></div><div><span>Money out</span><strong>{peso(expense)}</strong></div></div>}

export default function FinanceImport({onLedgerChanged,onViewTransaction,refreshKey=0,canUndo=false}){
  const inputId=useId(),input=useRef(null),working=useRef(false),undoVersion=useRef(0);
  const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[history,setHistory]=useState({items:[],total:0,page_size:20}),[page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(10);
  const [busy,setBusy]=useState(''),[loadingHistory,setLoadingHistory]=useState(true),[historyError,setHistoryError]=useState(''),[message,setMessage]=useState(null),[dragging,setDragging]=useState(false);
  const [confirmImport,setConfirmImport]=useState(false),[undo,setUndo]=useState(null),[reason,setReason]=useState('');
  const historyVersion=useRef(0),receiptVersion=useRef(0);
  const [receipt,setReceipt]=useState(null);
  const reload=useCallback(async()=>{
    const version=++historyVersion.current;setLoadingHistory(true);setHistoryError('');
    try{const result=await api(`/finance/imports?page=${page}&page_size=${pageSize}`);if(version===historyVersion.current)setHistory(result)}
    catch(error){if(version===historyVersion.current)setHistoryError(error.message);throw error}
    finally{if(version===historyVersion.current)setLoadingHistory(false)}
  },[page,pageSize]);
  useEffect(()=>{reload().catch(()=>{});return ()=>{historyVersion.current++}},[reload,refreshKey]);
  const run=async(name,action)=>{
    if(working.current)return;working.current=true;setBusy(name);setMessage(null);
    try{await action()}catch(error){setMessage({type:'error',title:'Action could not be completed',text:error.message})}
    finally{working.current=false;setBusy('')}
  };
  const selectFile=selected=>{
    if(working.current||undo)return;setDragging(false);setPreview(null);setMessage(null);
    if(!selected){setFile(null);return}
    if(!/\.csv$/i.test(selected.name)||selected.size>MAX_BYTES||selected.size===0){
      setFile(null);if(input.current)input.current.value='';setMessage({type:'error',title:'Choose a supported file',text:'Use an unedited Export to Finance CSV, up to 2 MB, downloaded from HR & Payroll or Company Finances.'});return;
    }
    setFile(selected);
  };
  const clearFile=()=>{selectFile(null);if(input.current)input.current.value=''};
  const prepare=()=>run('preview',async()=>{
    if(!file)return;
    const result=await api('/finance/imports/preview',{method:'POST',data:{filename:file.name,base64:await toBase64(file)},timeoutMs:120000});
    setPreview(result);
    if(!result.ready)setMessage({type:'warning',title:'Some payments need review',text:'A payment in this file differs from a previously imported payment. Review the source file before importing.'});
  });
  const refreshAfterChange=async()=>{
    const results=await Promise.allSettled([reload(),onLedgerChanged?.()]);
    if(results.some(result=>result.status==='rejected'))setMessage(current=>({...current,type:'warning',text:`${current?.text||'Changes saved.'} The latest history could not be loaded. Refresh to try again.`}));
  };
  const commit=()=>run('import',async()=>{
    const result=await api(`/finance/imports/${preview.batch_id}/commit`,{method:'POST',data:{},timeoutMs:120000});
    const added=result.result?.imported||0,restored=result.result?.restored||0,skipped=result.result?.duplicate||0;
    setConfirmImport(false);setPreview(null);setFile(null);if(input.current)input.current.value='';
    setMessage({type:'success',title:added?'Import complete':'Import receipt recorded',batchId:preview.batch_id,text:`${added} payment${added===1?'':'s'} added${restored?` (${restored} restored)`:''}. ${skipped} already imported and skipped. ${canUndo?'You can undo this import from the history below.':'A Finance Admin can undo this import if needed.'}`});
    await refreshAfterChange();
  });
  const reviewUndo=async batch=>{
    if(!canUndo||working.current)return;const version=++undoVersion.current;setMessage(null);setReason('');setUndo({batch,loading:true});
    try{const review=await api(`/finance/imports/${batch.id}/undo-preview`);if(version===undoVersion.current)setUndo({batch,review})}
    catch(error){if(version===undoVersion.current)setUndo({batch,error:error.message})}
  };
  const closeUndo=()=>{if(working.current)return;undoVersion.current++;setUndo(null)};
  const confirmUndo=()=>run('undo',async()=>{
    if(!canUndo)throw new Error('Only a Finance Admin can undo an import.');
    if(reason.trim()&&reason.trim().length<5)throw new Error('Please use at least 5 characters for the reason, or leave it blank.');
    const result=await api(`/finance/imports/${undo.batch.id}/undo`,{method:'POST',data:{reason:reason.trim()||`Undo import: ${undo.batch.file_name}`,review_token:undo.review.review_token},timeoutMs:120000});
    setUndo(null);undoVersion.current++;
    const removed=result.result?.removed||0,kept=result.result?.kept||0;
    setMessage({type:'success',title:'Import undone',text:`${removed} payment${removed===1?'':'s'} removed from your balance.${kept?` ${kept} kept because another active import includes them.`:''} Your audit history is preserved. Upload the file again whenever you need to restore it.`});
    setPreview(null);await refreshAfterChange();
  });
  const openReceipt=async batch=>{
    const version=++receiptVersion.current;
    setReceipt({name:batch.file_name,loading:true});
    try {
      const data=await api('/finance/imports/'+batch.id);
      if(version===receiptVersion.current) setReceipt({name:data.file_name,data});
    } catch(error) {
      if(version===receiptVersion.current) setReceipt({name:batch.file_name,error:error.message});
    }
  };
  const closeReceipt=()=>{receiptVersion.current++;setReceipt(null)};
  const viewFinanceRecord=id=>{
    closeReceipt();
    setConfirmImport(false);
    onViewTransaction(id);
  };
  const pending=(preview?.counts?.new||0)+(preview?.counts?.restore||0),allDuplicates=preview?.ready&&!pending;
  const newCategories=new Set((preview?.items||[]).filter(item=>item.category_action==='create').map(item=>`${item.kind}:${item.category_name.toLowerCase()}`)).size;
  const reactivatedCategories=new Set((preview?.items||[]).filter(item=>item.category_action==='reactivate').map(item=>`${item.kind}:${item.category_name}`)).size;

  return <div className="finance-import page-stack">
    {message&&!(message.type==='error'&&(confirmImport||undo))&&<Notice type={message.type} title={message.title} onDismiss={()=>setMessage(null)}>{message.text}{message.batchId&&<button type="button" className="text-btn" onClick={()=>openReceipt({id:message.batchId,file_name:'Import receipt'})}>View import receipt</button>}</Notice>}
    <section className="panel import-panel">
      <header className="section-heading"><div className="section-icon"><FiUploadCloud aria-hidden="true"/></div><div><h2>Import payments</h2><p>Bring salary and Company Finances payments into your ledger.</p></div><span className="subtle-badge"><FiShield aria-hidden="true"/>Duplicate protection</span></header>
      <ol className="import-steps" aria-label="Import progress">{['Choose file','Review payments','Import'].map((label,index)=><li key={label} className={index===0&&file||index===1&&preview?'complete':''}><b>{index===0&&file||index===1&&preview?<FiCheck aria-hidden="true"/>:index+1}</b>{label}{index<2&&<FiArrowRight className="step-arrow" aria-hidden="true"/>}</li>)}</ol>
      <input ref={input} id={inputId} className="visually-hidden" aria-label="Finance export file" type="file" accept=".csv" disabled={Boolean(busy)||Boolean(undo)} onChange={event=>selectFile(event.target.files?.[0])}/>
      <div className={`upload-zone ${dragging?'dragging':''} ${file?'has-file':''}`} onDragOver={event=>{event.preventDefault();if(!busy&&!undo)setDragging(true)}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false)}} onDrop={event=>{event.preventDefault();if(!busy&&!undo)selectFile(event.dataTransfer.files?.[0]);setDragging(false)}}>
        {file?<><div className="file-symbol"><FiFile aria-hidden="true"/></div><div className="upload-copy"><strong>{file.name}</strong><span>{(file.size/1024).toFixed(1)} KB · Ready to review</span></div><button className="icon-button" type="button" disabled={Boolean(busy)||Boolean(undo)} onClick={clearFile} aria-label="Remove selected file"><FiTrash2 aria-hidden="true"/></button></>:<><FiUploadCloud className="upload-illustration" aria-hidden="true"/><strong>Drop your export file here</strong><span>Verified Finance CSV · Up to 2 MB</span><label htmlFor={inputId} className={`btn ${busy||undo?'disabled':''}`}>Choose file</label></>}
      </div>
      <div className="import-upload-footer"><p>Upload the original CSV without editing it. Finance verifies the file before preview; your balance changes only after confirmation.</p><button className="btn primary" type="button" disabled={!file||Boolean(busy)||Boolean(undo)} onClick={prepare}>{busy==='preview'?<Spinner label="Checking file…"/>:<><FiFile aria-hidden="true"/>Review file</>}</button></div>
      {preview&&<section className="preview-section" aria-label="Import preview"><div className="panel-heading"><h3>Review payments</h3><span className="subtle-badge">{source(preview.manifest?.source_system)} · {date(preview.manifest?.period?.from)} – {date(preview.manifest?.period?.to)}</span></div>
        <ImportBreakdown items={preview.items||[]}/>
        <Summary income={sumPayments(preview.items||[],'income')} expense={sumPayments(preview.items||[],'expense')} label="Balance impact"/>
        {Boolean(newCategories||reactivatedCategories)&&<Notice type="info">{newCategories?`${newCategories} categor${newCategories===1?'y':'ies'} will be created from this file. `:''}{reactivatedCategories?`${reactivatedCategories} inactive categor${reactivatedCategories===1?'y will':'ies will'} be reactivated when you import.`:''}</Notice>}
        {allDuplicates&&<Notice type="info" title="This file is already in your ledger">Its payments will be skipped. Confirming will save another import receipt without changing your balance.</Notice>}
        <ImportRecordRows items={preview.items||[]} onViewTransaction={viewFinanceRecord}/>
        <div className="action-row">
          <button className="btn" type="button" onClick={()=>setPreview(null)} disabled={Boolean(busy)}>Back</button>
          {allDuplicates&&<button className="btn" type="button" disabled={Boolean(busy)} onClick={()=>setConfirmImport(true)}>Record Import Receipt</button>}
          <button className="btn primary" type="button" disabled={Boolean(busy)||!preview.ready}
            onClick={()=>allDuplicates?setReceipt({name:file?.name,data:{items:preview.items,preview:true}}):setConfirmImport(true)}>
            {allDuplicates?'View Imported Records':`Import ${pending} payment${pending===1?'':'s'}`}<FiArrowRight aria-hidden="true"/>
          </button>
        </div>
      </section>}
    </section>

    <section className="panel import-history"><div className="section-heading"><div className="section-icon"><FiClock aria-hidden="true"/></div><div><h2>Import history</h2><p>{canUndo?'Review completed imports or undo one when needed.':'Review completed imports. Ask a Finance Admin if an import needs to be undone.'}</p></div></div>
      {historyError&&<Notice type="error" title="History could not be loaded">{historyError}</Notice>}
      {loadingHistory&&!history.items?.length?<div className="history-skeleton" role="status" aria-label="Loading import history">{[1,2,3].map(key=><div key={key}/>)}</div>:!history.items?.length?<div className="empty-state"><FiInbox aria-hidden="true"/><h3>No imports yet</h3><p>{canUndo?'Your completed imports will appear here, with an option to undo.':'Your completed imports will appear here. A Finance Admin can undo an import if needed.'}</p></div>:<div className="table-wrap"><table className="history-table"><thead><tr><th scope="col">File</th><th scope="col">Period</th><th scope="col">Payments</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{history.items.map(batch=>{const result=json(batch.result_json);return <tr key={batch.id}><td><div className="history-file"><FiFile aria-hidden="true"/><div><strong>{batch.file_name}</strong><span className="cell-secondary">{source(batch.source_system)} · {batch.imported_by||'Administrator'}</span></div></div></td><td data-label="Period">{date(batch.source_from)}<span className="cell-secondary">to {date(batch.source_to)}</span></td><td data-label="Payments"><strong>{result.imported||0} added</strong><span className="cell-secondary">{result.duplicate||0} skipped</span></td><td data-label="Status"><span className={`pill import-state ${batch.status==='undone'?'undone':'committed'}`}>{batch.status==='undone'?<FiRotateCcw aria-hidden="true"/>:<FiCheckCircle aria-hidden="true"/>}{batch.status==='undone'?'Undone':'Imported'}</span><span className="cell-secondary">{financeDateTime(batch.undone_at||batch.committed_at)}</span></td><td><button className="text-btn" type="button" disabled={Boolean(busy)||Boolean(undo)} onClick={()=>openReceipt(batch)}>View details</button>{batch.status==='committed'?(canUndo?<button className="btn undo-button" type="button" disabled={Boolean(busy)||Boolean(undo)} onClick={()=>reviewUndo(batch)} aria-label={`Undo import ${batch.file_name}`}><FiRotateCcw aria-hidden="true"/>Undo import</button>:<span className="muted">Admin only</span>):<span className="muted undo-complete">History preserved</span>}</td></tr>})}</tbody></table></div>}
      <Pagination label="Import history pagination" page={history.page||page} pageSize={pageSize} total={history.total} disabled={loadingHistory||Boolean(busy)} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>
    </section>

    {confirmImport&&<Dialog title={allDuplicates?'Record import receipt':'Confirm import'} description={file?.name} wide busy={busy==='import'} onClose={()=>setConfirmImport(false)}><Notice type="info">{allDuplicates
      ?`${preview.counts.duplicate} payments already imported. No balance change.`
      :`${pending} payment${pending===1?'':'s'} will affect your balance. ${preview.counts?.duplicate||0} already imported and skipped.`}</Notice>
      <ImportBreakdown items={preview.items||[]}/>
      <details className="import-records-expand"><summary>View payment breakdown</summary><ImportRecordRows items={preview.items||[]} onViewTransaction={viewFinanceRecord}/></details><Summary income={sumPayments(preview.items||[],'income')} expense={sumPayments(preview.items||[],'expense')} label="Payments to add"/><p className="dialog-help">{canUndo?'You can undo this import later.':'A Finance Admin can undo this import if needed.'} Categories are handled automatically.</p>{message?.type==='error'&&<Notice type="error">{message.text}</Notice>}<div className="action-row"><button className="btn" type="button" disabled={Boolean(busy)} onClick={()=>setConfirmImport(false)}>Cancel</button><button className="btn primary" type="button" disabled={Boolean(busy)} onClick={commit}>{busy==='import'?<Spinner label="Importing…"/>:<><FiCheck aria-hidden="true"/>{allDuplicates?'Record receipt':'Confirm import'}</>}</button></div></Dialog>}
    {receipt&&<Dialog title={receipt.data?.preview?'Already Imported':'Import receipt'} description={receipt.name} wide onClose={closeReceipt}>
      {receipt.loading?<div className="dialog-loading"><Spinner label="Loading records…"/></div>:null}
      {receipt.error&&<Notice type="error">{receipt.error}</Notice>}
      {receipt.data&&<>
        {receipt.data.committed_at&&<p className="muted">Recorded {financeDateTime(receipt.data.committed_at)} · Philippine Time</p>}
        {receipt.data.preview&&<Notice type="info">These payments are already in Finance. No balance change.</Notice>}
        <ImportBreakdown items={receipt.data.items} history={!receipt.data.preview}/>
        <ImportRecordRows items={receipt.data.items} onViewTransaction={viewFinanceRecord}/>
      </>}
    </Dialog>}
    {undo&&canUndo&&<Dialog title="Undo this import?" description={undo.batch.file_name} busy={busy==='undo'} onClose={closeUndo} danger>{undo.loading?<div className="dialog-loading"><Spinner label="Checking balance changes…"/></div>:undo.error?<Notice type="error">{undo.error}</Notice>:<><Notice type="warning" title="Review the balance changes">{undo.review.impact.removed} payment{undo.review.impact.removed===1?'':'s'} will be removed from your balance. {undo.review.impact.kept?`${undo.review.impact.kept} will stay because another active import includes them.`:'Your source files and audit history will be preserved.'}</Notice><Summary income={undo.review.impact.money_in_removed} expense={undo.review.impact.money_out_removed} label="Payments to remove"/><div className="balance-impact"><span>Balance change</span><strong>{Number(undo.review.impact.balance_change)>0?'+':''}{peso(undo.review.impact.balance_change)}</strong></div><label className="undo-reason">Reason <span className="optional-label">(optional)</span><textarea rows={2} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="For example, the wrong payment period was imported." disabled={Boolean(busy)}/></label><p className="dialog-help">You can upload the same file again to restore these payments.</p></>}{message?.type==='error'&&<Notice type="error">{message.text}</Notice>}<div className="action-row"><button className="btn" type="button" disabled={Boolean(busy)} onClick={closeUndo}>Keep import</button><button className="btn danger" type="button" disabled={Boolean(busy)||!undo.review} onClick={confirmUndo}>{busy==='undo'?<Spinner label="Undoing…"/>:<><FiRotateCcw aria-hidden="true"/>Undo import</>}</button></div></Dialog>}
  </div>;
}
