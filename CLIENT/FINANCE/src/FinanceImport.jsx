import React,{useEffect,useState} from 'react';
import {api} from './api.js';
const MAX_BYTES=2*1024*1024;
const toBase64=async file=>{
  const bytes=new Uint8Array(await file.arrayBuffer());
  let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(s);
};
export default function FinanceImport({categories,onLedgerChanged}){
  const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[history,setHistory]=useState([]),[mappings,setMappings]=useState([]),[mapping,setMapping]=useState({kind:'expense',source_category:'',category_id:''}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const reload=async()=>{const [m,h]=await Promise.all([api('/finance/imports/mappings'),api('/finance/imports')]);setMappings(m.mappings||[]);setHistory(h.items||[]);};
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  const run=async work=>{setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const previewFile=()=>run(async()=>{
    if(!file||file.size>MAX_BYTES||!/\.(xlsx|zip)$/i.test(file.name))throw new Error('Choose a Batch 11 transfer .zip or .xlsx file up to 2 MB.');
    const p=await api('/finance/imports/preview',{method:'POST',data:{filename:file.name,base64:await toBase64(file)}});
    setPreview(p);setNotice('Review every row and selected category before confirming the import.');await reload();
  });
  const approve=()=>run(async()=>{
    if(!mapping.source_category.trim()||!mapping.category_id)throw new Error('Choose the Realty category name and matching Finance category.');
    await api('/finance/imports/mappings',{method:'POST',data:{kind:mapping.kind,source_category:mapping.source_category.trim(),category_id:mapping.category_id}});
    setMapping({kind:'expense',source_category:'',category_id:''});setPreview(null);await reload();setNotice('Category approved. Re-upload your file to create a fresh preview.');
  });
  const commit=()=>run(async()=>{
    if(!preview?.ready)throw new Error('Resolve conflicts and category mappings before importing.');
    const result=await api(`/finance/imports/${preview.batch_id}/commit`,{method:'POST',data:{}});
    setNotice(`Import confirmed: ${result.result?.imported??0} added, ${result.result?.duplicate??0} already present.`);
    setPreview(null);await reload();await onLedgerChanged?.();
  });
  return <div className="panel finance-import">
    <h2>Import approved Realty transactions</h2>
    <p className="muted">Upload a Finance transfer ZIP or Excel workbook from Batch 11. Only posted cash movements are supported. Uploads do not affect balances until confirmed.</p>
    {error&&<div className="notice" role="alert">{error}</div>}
    {notice&&<p role="status">{notice}</p>}
    <div className="inline-form"><input type="file" accept=".zip,.xlsx" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);}}/><button className="btn primary" disabled={busy||!file} onClick={previewFile}>Validate & preview</button></div>
    {preview&&<>
      <h3>Preview — {preview.manifest?.export_id}</h3>
      <p>Period: {preview.manifest?.period?.from} to {preview.manifest?.period?.to} · File SHA-256: <code>{preview.file_sha256}</code></p>
      <p><strong>{preview.counts?.new||0} new</strong> · {preview.counts?.duplicate||0} duplicates · {preview.counts?.conflict||0} conflicting revisions · {preview.counts?.unmapped||0} without approved categories</p>
      <p>Selected income: ₱{preview.selected_totals.money_in}; selected expenses: ₱{preview.selected_totals.money_out}.</p>
      <div className="table-wrap"><table><thead><tr><th>Row</th><th>Source ID</th><th>Source category</th><th>Type</th><th>Amount</th><th>Decision</th></tr></thead><tbody>{(preview.items||[]).map(item=><tr key={item.row_number}><td>{item.row_number}</td><td>{item.source_transaction_id}</td><td>{item.source_category}</td><td>{item.kind}</td><td>₱{item.amount}</td><td>{item.decision}</td></tr>)}</tbody></table></div>
      {!preview.ready&&<p className="notice">Import is blocked. Approve missing categories or review changed source transactions outside this v1 importer, then preview again.</p>}
      <button className="btn primary" onClick={commit} disabled={busy||!preview.ready} type="button">Confirm import ({preview.counts?.new||0} new records)</button>
    </>}
    <h3>Category mapping (Admin approval)</h3>
    <p className="muted">Use the exact source category from the preview. The Finance category must have the same income/expense type.</p>
    <form className="inline-form" onSubmit={e=>{e.preventDefault();approve();}}><select value={mapping.kind} onChange={e=>setMapping(x=>({...x,kind:e.target.value,category_id:''}))}><option value="expense">Expense</option><option value="income">Income</option></select><input placeholder="Exact Realty category" maxLength="200" value={mapping.source_category} onChange={e=>setMapping(x=>({...x,source_category:e.target.value}))} required/><select required value={mapping.category_id} onChange={e=>setMapping(x=>({...x,category_id:e.target.value}))}><option value="">Choose target category</option>{categories.filter(c=>c.kind===mapping.kind&&Number(c.is_active)===1).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button className="btn" disabled={busy}>Approve mapping</button></form>
    <p className="muted">Current mappings: {mappings.length}. Historical posted imports cannot be edited or voided through the manual transaction controls.</p>
    <h3>Import history</h3><div className="table-wrap"><table><thead><tr><th>File</th><th>Period</th><th>Status</th><th>Created</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{h.file_name}</td><td>{String(h.source_from)}–{String(h.source_to)}</td><td>{h.status}</td><td>{String(h.created_at)}</td></tr>)}</tbody></table></div>
  </div>;
}
