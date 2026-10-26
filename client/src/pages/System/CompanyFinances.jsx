import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiPlus, FiTag, FiAlertTriangle, FiRefreshCw, FiTrash2, FiDownload } from 'react-icons/fi'
import { useFetch, useFetchBlob, useFetchPost, useFetchPut } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'
import { hasPermission, PERMISSIONS } from '../../config/permissions'
import StatusAlert from '../../components/Shared/StatusAlert'

const php = (value) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value || 0))
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const btn = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50'
const Card = ({children,className=''}) => <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>
const Label = ({children}) => <span className="mb-1 block text-sm font-semibold text-slate-700">{children}</span>

export default function CompanyFinances(){
  const queryClient = useQueryClient()
  const {data:userData} = useCurrentUser()
  const user = userData?.user
  const canRecord=hasPermission(user,PERMISSIONS.COMPANY_FINANCES_RECORD)
  const canEdit=hasPermission(user,PERMISSIONS.COMPANY_FINANCES_EDIT)
  const canCategories=hasPermission(user,PERMISSIONS.COMPANY_FINANCES_CATEGORIES)
  const canOpening=hasPermission(user,PERMISSIONS.COMPANY_FINANCES_OPENING_BALANCE)
  const [from,setFrom]=useState(()=>`${today().slice(0,7)}-01`)
  const [to,setTo]=useState(today)
  const [tab,setTab]=useState('transactions')
  const [page,setPage]=useState(1)
  const [exporting,setExporting]=useState(false)
  const [error,setError]=useState('')
  const [formMode,setFormMode]=useState(null)
  const [entry,setEntry]=useState({kind:'expense',amount:'',transaction_date:today(),category_id:'',description:'',notes:''})
  const [opening,setOpening]=useState({start_date:today(),opening_balance:'',includes_property_collections:true})
  const [fixOpening,setFixOpening]=useState(null)
  const [openingReason,setOpeningReason]=useState('')
  const [openingConfirmed,setOpeningConfirmed]=useState(false)
  const [categoryName,setCategoryName]=useState('')
  const [categoryKind,setCategoryKind]=useState('expense')
  const [renamingCategory,setRenamingCategory]=useState(null)
  const [newCategoryName,setNewCategoryName]=useState('')
  const [voidId,setVoidId]=useState(null)
  const [voidReason,setVoidReason]=useState('')
  const finance=useQuery({queryKey:['company-finances',from,to,page],queryFn:()=>useFetch(`/company-finances/overview?${new URLSearchParams({from,to,page:String(page)})}`),enabled:!!user&&from<=to})
  const categories=useQuery({queryKey:['company-finance-categories'],queryFn:()=>useFetch('/company-finances/categories'),enabled:!!user})
  const data=finance.data?.data
  const list=categories.data?.data||[]
  const activeCategories=useMemo(()=>list.filter(c=>c.kind===entry.kind&&Number(c.is_active)===1&&!Number(c.protected)),[list,entry.kind])
  const refresh=()=>{queryClient.invalidateQueries({queryKey:['company-finances']});queryClient.invalidateQueries({queryKey:['company-finance-categories']})}
  const mutation=useMutation({mutationFn:({path,body,method})=>method==='PUT'?useFetchPut(path,body,{confirmationHandled:'compact'}):useFetchPost(path,body,{confirmationHandled:'compact'}),onSuccess:()=>{setError('');setFormMode(null);setVoidId(null);setFixOpening(null);setOpeningConfirmed(false);setOpeningReason('');refresh()},onError:e=>setError(e.message||'Unable to save. Please check your entries.')})
  const changeEntry=(prop,value)=>setEntry(old=>({...old,[prop]:value}))
  const newEntry=(kind)=>{setEntry({kind,amount:'',transaction_date:today(),category_id:'',description:'',notes:''});setError('');setFormMode('new')}
  const saveEntry=(e)=>{e.preventDefault();mutation.mutate({path:formMode==='edit'?`/company-finances/transactions/${entry.id}`:'/company-finances/transactions',body:entry,method:formMode==='edit'?'PUT':'POST'})}
  const editing=(record)=>{const matched=list.find(c=>c.name===record.category&&c.kind===record.kind);setEntry({id:Number(record.reference.split(':')[1]),kind:record.kind,amount:String(record.amount),transaction_date:record.txn_date,category_id:matched?.id||'',description:record.title,notes:record.notes||''});setFormMode('edit');setError('')}
  const handleCategory=(e)=>{e.preventDefault();mutation.mutate({path:'/company-finances/categories',body:{name:categoryName,kind:categoryKind}});setCategoryName('')}
  const exportCsv=async()=>{
    if(!data?.configured || !data?.total_records || exporting) return
    setExporting(true)
    setError('')
    try {
      // Server export uses the same date/source filters but includes ALL pages.
      const result=await useFetchBlob(`/company-finances/transactions/export?${new URLSearchParams({from,to})}`,{redirectOnUnavailable:false})
      const url=URL.createObjectURL(result.blob)
      const anchor=document.createElement('a')
      anchor.href=url
      anchor.download=`DCP-Company-Finances-${from}-to-${to}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    }catch(e){setError(e.message||'Unable to export transactions. Please try again.')}
    finally{setExporting(false)}
  }
  const pageInfo=data?.page_size?data:{page:1,page_size:100,total_pages:1,range_start:0,range_end:0,total_records:0}
  const changeDate=(setter,value)=>{setPage(1);setter(value)}
  return <main className="mx-auto max-w-7xl space-y-5 pb-10">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">D&C Prime Realty</p><h1 className="text-2xl font-black text-slate-950">Company Finances</h1><p className="mt-1 text-sm text-slate-600">Money received, money spent, and the remaining balance. No bank connection needed.</p></div>
      <button className={`${btn} border border-slate-300 bg-white text-slate-700`} onClick={()=>{finance.refetch();categories.refetch()}}><FiRefreshCw/> Refresh</button>
    </header>
    {error?<StatusAlert type="error" message={error}/>:null}
    {finance.isError?<StatusAlert type="error" message={finance.error?.message||'Unable to load finances.'}/>:null}
    <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label><Label>From</Label><input aria-label="From date" type="date" value={from} onChange={e=>changeDate(setFrom,e.target.value)} className={field}/></label><label><Label>To</Label><input aria-label="To date" type="date" value={to} onChange={e=>changeDate(setTo,e.target.value)} className={field}/></label><div className="flex items-end"><button onClick={()=>{setPage(1);setFrom(`${today().slice(0,7)}-01`);setTo(today())}} className={`${btn} w-full bg-slate-100 text-slate-700`}>This Month</button></div></div>{from>to?<p className="mt-2 text-sm font-semibold text-red-700">From date cannot be after To date.</p>:null}</Card>
    {finance.isLoading?<StatusAlert type="loading" message="Loading transactions…"/>:null}
    {data&&!data.configured?<Card><h2 className="text-lg font-black text-slate-900">Set up the starting balance</h2><p className="mt-2 text-sm text-slate-600">Enter the company’s verified starting amount. Previous payments are already part of that amount, so the report will only count transactions from the selected date.</p>{canOpening?<form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();mutation.mutate({path:'/company-finances/opening-balance',body:opening})}}><label><Label>Starting Date</Label><input required type="date" className={field} value={opening.start_date} max={today()} onChange={e=>setOpening(v=>({...v,start_date:e.target.value}))}/></label><label><Label>Opening Balance (₱)</Label><input required type="number" min="0" step="0.01" value={opening.opening_balance} onChange={e=>setOpening(v=>({...v,opening_balance:e.target.value}))} className={field}/></label><button disabled={mutation.isPending} className={`${btn} self-end bg-blue-600 text-white`}>Save Starting Balance</button><label className="sm:col-span-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={opening.includes_property_collections} onChange={e=>setOpening(v=>({...v,includes_property_collections:e.target.checked}))}/>Include property collections in company money</label><p className="sm:col-span-3 text-xs text-amber-800">Confirm the company owns these funds before enabling this option. This starting balance can only be set once.</p></form>:<p className="mt-3 text-sm font-semibold text-amber-700">Ask Accounting Head or an administrator to set the opening balance.</p>}</Card>:null}
    {data?.configured?<>
      <div className="grid gap-3 sm:grid-cols-3"><Card className="sm:col-span-3 lg:col-span-1"><p className="text-sm font-semibold text-slate-500">Available Balance</p><p className="mt-1 text-3xl font-black text-slate-900">{data.balance_verified?php(data.available_balance):'Needs Review'}</p><p className="mt-2 text-xs text-slate-500">At {to}. Starting balance {php(data.opening_balance)} on {data.start_date}.</p>{!data.balance_verified?<p className="mt-1 text-xs font-bold text-amber-700">Some source records need reconciliation.</p>:null}</Card><Card><p className="text-sm font-semibold text-slate-500">Money In</p><p className="mt-1 text-2xl font-black text-emerald-700">{php(data.money_in)}</p><p className="mt-2 text-xs text-slate-500">For selected dates</p></Card><Card><p className="text-sm font-semibold text-slate-500">Money Out</p><p className="mt-1 text-2xl font-black text-rose-700">{php(data.money_out)}</p><p className="mt-2 text-xs text-slate-500">For selected dates</p></Card></div>

      <Card className="border-blue-200 bg-blue-50/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-base font-black text-slate-900">Where does this balance start?</h2><p className="mt-1 text-sm text-slate-700">Tracking started on <strong>{data.start_date}</strong> with {php(data.opening_balance)}. Property collections: <strong>{data.includes_property_collections?'Included':'Not included'}</strong>.</p></div>
          {canOpening?<button type="button" className={`${btn} border border-blue-300 bg-white text-blue-800`} onClick={()=>{setFixOpening({start_date:data.start_date,opening_balance:String(data.opening_balance),includes_property_collections:data.includes_property_collections});setOpeningReason('');setOpeningConfirmed(false);setError('')}}>Correct Starting Balance</button>:null}
        </div>
        {(data.exclusions?.before_start?.count||0)>0?<div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Older transactions are outside Finance tracking</p><p className="mt-1">For your selected dates, {data.exclusions.before_start.count} existing transaction(s) happened before {data.start_date}: <strong>{php(data.exclusions.before_start.property_collections)}</strong> property collections, <strong>{php(data.exclusions.before_start.salary_paid)}</strong> salary, <strong>{php(data.exclusions.before_start.commissions_paid)}</strong> commission/network payouts. These records already exist but are not included again in the balance. The starting balance might already include them.</p></div>:null}
        {data.exclusions?.property_excluded_count>0?<p className="mt-2 text-sm font-medium text-amber-900">{php(data.exclusions.property_excluded_by_setting)} of property payments are excluded because Property Collections is turned off.</p>:null}
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-slate-500">Property Collections</span><p className="font-bold">{php(data.sources?.property_collections)}</p></div>
          <div><span className="text-slate-500">Salary Paid</span><p className="font-bold">{php(data.sources?.salary_paid)}</p></div>
          <div><span className="text-slate-500">Commissions & Network</span><p className="font-bold">{php(Number(data.sources?.commissions_paid||0)+Number(data.sources?.network_payouts||0))}</p></div>
          <div><span className="text-slate-500">Other Income</span><p className="font-bold">{php(data.sources?.other_income)}</p></div>
        </div>
        {fixOpening?<form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={e=>{e.preventDefault();mutation.mutate({path:'/company-finances/opening-balance',method:'PUT',body:{...fixOpening,reason:openingReason,confirmed:openingConfirmed}})}}>
          <h3 className="text-base font-bold">Correct Finance Setup</h3>
          <p className="text-sm text-amber-800">This changes reports going forward. It does not change actual salary, commission or property payments. Before moving the date earlier, subtract any newly included older payments from the opening balance if they were already counted there.</p>
          <div className="grid gap-3 sm:grid-cols-2"><label><Label>Starting Date</Label><input required type="date" max={today()} value={fixOpening.start_date} onChange={e=>setFixOpening(p=>({...p,start_date:e.target.value}))} className={field}/></label><label><Label>Opening Balance (₱)</Label><input required type="number" min="0" step="0.01" value={fixOpening.opening_balance} onChange={e=>setFixOpening(p=>({...p,opening_balance:e.target.value}))} className={field}/></label></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fixOpening.includes_property_collections} onChange={e=>setFixOpening(p=>({...p,includes_property_collections:e.target.checked}))}/> Include verified property collections</label>
          <label className="block"><Label>Reason for correction *</Label><textarea required minLength={10} maxLength={500} className={field} rows={2} value={openingReason} onChange={e=>setOpeningReason(e.target.value)} placeholder="Explain why the starting balance or date needs correction"/></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" required checked={openingConfirmed} onChange={e=>setOpeningConfirmed(e.target.checked)}/> I checked the opening balance so older payments will not be counted twice.</label>
          <div className="flex justify-end gap-2"><button type="button" className={`${btn} bg-slate-100`} onClick={()=>{setFixOpening(null);setError('')}}>Cancel</button><button type="submit" disabled={mutation.isPending||!openingConfirmed||openingReason.trim().length<10} className={`${btn} bg-blue-600 text-white`}>Save Correction</button></div>
        </form>:null}
      </Card>
      {(data.warnings||[]).length?<Card className="border-amber-300 bg-amber-50"><h3 className="flex items-center gap-2 text-sm font-black text-amber-950"><FiAlertTriangle/> Balance needs checking</h3>{data.warnings.map(w=><p className="mt-2 text-sm text-amber-900" key={w}>• {w}</p>)}<p className="mt-2 text-xs text-amber-700">Resolve the sources or adjust the opening cutover before relying on this balance.</p></Card>:null}
      <div className="flex flex-wrap items-center gap-2">{canRecord?<><button onClick={()=>newEntry('income')} className={`${btn} bg-emerald-600 text-white`}><FiPlus/> Add Income</button><button onClick={()=>newEntry('expense')} className={`${btn} bg-blue-600 text-white`}><FiPlus/> Add Expense</button></>:null}<div className="flex-1"/>{tab==='transactions' && data.total_records>0?<button onClick={exportCsv} disabled={exporting} className={`${btn} border border-slate-300 bg-white text-slate-700`}><FiDownload/> {exporting?'Exporting…':'Export CSV (all pages)'}</button>:null}{['transactions','categories'].map(t=><button key={t} onClick={()=>{setTab(t);setError('')}} className={`${btn} ${tab===t?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{t==='transactions'?'Transactions':'Categories'}</button>)}</div>
      {tab==='transactions'?<Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black text-slate-950">Transactions <span className="text-sm font-semibold text-slate-500">({pageInfo.total_records.toLocaleString('en-PH')} total)</span></h2>
          <span className="text-xs font-semibold text-slate-500">100 per page</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Automatic payments are read-only. Correct them in their original module.</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-3">Name</th>
                <th scope="col" className="px-3 py-3">Type</th>
                <th scope="col" className="px-3 py-3">Category</th>
                <th scope="col" className="px-3 py-3">Entry</th>
                <th scope="col" className="whitespace-nowrap px-3 py-3">Date</th>
                <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">Amount</th>
                {canEdit?<th scope="col" className="px-3 py-3 text-center">Actions</th>:null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!(data.transactions||[]).length?<tr><td colSpan={canEdit?7:6} className="px-3 py-10 text-center text-sm text-slate-500">No transactions for these dates.</td></tr>:
              data.transactions.map(tx=><tr key={tx.reference} className="hover:bg-slate-50/80">
                <td className="max-w-[240px] px-3 py-3 font-semibold text-slate-900"><span className="block break-words">{tx.title}</span></td>
                <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tx.kind==='income'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{tx.kind==='income'?'Income':'Expense'}</span></td>
                <td className="px-3 py-3 text-slate-700">{tx.category}</td>
                <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tx.source==='manual'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-700'}`}>{tx.source==='manual'?'Manual':'Automatic'}</span></td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">{tx.txn_date}</td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-black tabular-nums ${tx.kind==='income'?'text-emerald-700':'text-rose-700'}`}>{tx.kind==='income'?'+':'−'}{php(tx.amount)}</td>
                {canEdit?<td className="px-3 py-3 text-center">{tx.source==='manual'?<div className="flex justify-center gap-1"><button title="Edit transaction" aria-label={`Edit ${tx.title}`} onClick={()=>editing(tx)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><FiEdit2/></button><button title="Void transaction" aria-label={`Void ${tx.title}`} onClick={()=>{setVoidId(Number(tx.reference.split(':')[1]));setError('')}} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><FiTrash2/></button></div>:<span className="text-xs text-slate-400">—</span>}</td>:null}
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold text-slate-600">Showing {pageInfo.range_start.toLocaleString('en-PH')}–{pageInfo.range_end.toLocaleString('en-PH')} of {pageInfo.total_records.toLocaleString('en-PH')} records</p>
          <nav aria-label="Transaction pages" className="flex items-center gap-2">
            <button type="button" disabled={pageInfo.page<=1 || finance.isFetching} onClick={()=>setPage(Math.max(1,pageInfo.page-1))} className={`${btn} border border-slate-300 bg-white text-slate-700`}>Previous</button>
            <span className="whitespace-nowrap px-2 text-xs font-bold text-slate-700">Page {pageInfo.page} of {pageInfo.total_pages}</span>
            <button type="button" disabled={pageInfo.page>=pageInfo.total_pages || finance.isFetching} onClick={()=>setPage(pageInfo.page+1)} className={`${btn} border border-slate-300 bg-white text-slate-700`}>Next</button>
          </nav>
        </div>
      </Card>:<Card><h2 className="text-lg font-black text-slate-900">Income & Expense Categories</h2><p className="mt-1 text-sm text-slate-500">Archive unused categories instead of deleting transaction history.</p>{canCategories?<form onSubmit={handleCategory} className="mt-4 flex flex-wrap gap-2"><select value={categoryKind} onChange={e=>setCategoryKind(e.target.value)} className={`${field} sm:w-40`}><option value="expense">Expense</option><option value="income">Income</option></select><input required minLength={2} maxLength={90} placeholder="Category name" value={categoryName} onChange={e=>setCategoryName(e.target.value)} className={`${field} flex-1`}/><button disabled={mutation.isPending} className={`${btn} bg-blue-600 text-white`}><FiTag/> Add Category</button></form>:null}<div className="mt-4 grid gap-2 sm:grid-cols-2">{list.map(cat=><div key={cat.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{cat.name}</p><p className="text-xs text-slate-500">{cat.kind==='income'?'Income':'Expense'}{!Number(cat.is_active)?' · Archived':''}{Number(cat.protected)?' · Automatic':''}</p></div>{canCategories&&!Number(cat.protected)?(renamingCategory===cat.id?<div className="flex flex-wrap gap-1"><input autoFocus aria-label="New category name" className={`${field} !w-36`} value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)}/><button className={`${btn} !px-2 bg-blue-600 text-white`} disabled={newCategoryName.trim().length<2} onClick={()=>{mutation.mutate({path:`/company-finances/categories/${cat.id}`,method:'PUT',body:{name:newCategoryName}});setRenamingCategory(null)}}>Save</button><button className={`${btn} !px-2 bg-slate-100`} onClick={()=>setRenamingCategory(null)}>Cancel</button></div>:<><button className={`${btn} !px-2 text-blue-700`} onClick={()=>{setRenamingCategory(cat.id);setNewCategoryName(cat.name)}} aria-label={`Rename ${cat.name}`}><FiEdit2/></button><button className={`${btn} !px-2 text-slate-600`} onClick={()=>mutation.mutate({path:`/company-finances/categories/${cat.id}`,method:'PUT',body:{is_active:!Number(cat.is_active)}})}>{Number(cat.is_active)?'Archive':'Restore'}</button></>):null}</div>)}</div></Card>}
    </>:null}
    {formMode?<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true"><form onSubmit={saveEntry} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-xl font-black">{formMode==='edit'?(entry.kind==='income'?'Edit Income':'Edit Expense'):entry.kind==='income'?'Add Income':'Add Expense'}</h2>{error?<p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>:null}<label className="block"><Label>Amount (₱) *</Label><input className={field} required type="number" min="0.01" step="0.01" value={entry.amount} onChange={e=>changeEntry('amount',e.target.value)}/></label><label className="block"><Label>Category *</Label><select required className={field} value={entry.category_id} onChange={e=>changeEntry('category_id',e.target.value)}><option value="">Choose category</option>{activeCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block"><Label>Date *</Label><input required type="date" max={today()} className={field} value={entry.transaction_date} onChange={e=>changeEntry('transaction_date',e.target.value)}/></label><label className="block"><Label>What is it for? *</Label><input className={field} required maxLength={240} value={entry.description} onChange={e=>changeEntry('description',e.target.value)} placeholder="e.g. Office electricity bill"/></label><label className="block"><Label>Notes (optional)</Label><textarea rows={2} maxLength={1000} className={field} value={entry.notes} onChange={e=>changeEntry('notes',e.target.value)}/></label><div className="flex justify-end gap-2"><button type="button" className={`${btn} bg-slate-100 text-slate-700`} onClick={()=>{setFormMode(null);setError('')}}>Cancel</button><button disabled={mutation.isPending} className={`${btn} bg-blue-600 text-white`}>{mutation.isPending?'Saving…':'Save'}</button></div></form></div>:null}
    {voidId?<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5"><h2 className="text-lg font-black">Void this transaction?</h2><p className="text-sm text-slate-600">The record will remain in audit history, but will no longer count toward totals.</p><label className="block"><Label>Reason *</Label><textarea className={field} required minLength={5} maxLength={500} value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Why is this transaction incorrect?"/></label><div className="flex justify-end gap-2"><button onClick={()=>setVoidId(null)} className={`${btn} bg-slate-100`}>Cancel</button><button disabled={voidReason.trim().length<5||mutation.isPending} onClick={()=>mutation.mutate({path:`/company-finances/transactions/${voidId}/void`,body:{reason:voidReason}})} className={`${btn} bg-red-600 text-white`}>Void Transaction</button></div></div></div>:null}
  </main>
}
