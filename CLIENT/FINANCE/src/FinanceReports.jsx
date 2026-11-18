import {useEffect,useRef,useState} from 'react';
import {FiDownload} from 'react-icons/fi';
import {api} from './api.js';
import {Notice,Spinner} from './FinanceFeedback.jsx';
import {financeMoney,financeSourceLabel} from './financeFormat.js';
import {FinanceCategoryChart,FinanceTrendChart} from './FinanceReportCharts.jsx';

const manila=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'});
const dayIso=date=>date.toISOString().slice(0,10);
const presets={month:'This Month',previous:'Last Month',year:'Year to Date',custom:'Custom Range'};

function period(preset){
  const to=manila.format(new Date());
  if(preset==='previous'){
    const start=new Date(to.slice(0,7)+'-01T00:00Z');
    const last=new Date(start);
    last.setUTCDate(0);
    start.setUTCMonth(start.getUTCMonth()-1);
    return {from:dayIso(start),to:dayIso(last)};
  }
  if(preset==='year') return {from:to.slice(0,4)+'-01-01',to};
  return {from:to.slice(0,7)+'-01',to};
}

const defaults=()=>({...period('month'),preset:'month',kind:'all',source:'all',category_id:''});
const summaries=[
  ['Opening balance','opening_balance'],['Money in','money_in'],['Money out','money_out'],
  ['Net cash change','net_change'],['Closing balance','closing_balance'],
];

export default function FinanceReports({categories,refreshKey}){
  const [form,setForm]=useState(defaults),[filters,setFilters]=useState(defaults);
  const [report,setReport]=useState(null),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const [error,setError]=useState(''),[pdfState,setPdfState]=useState(''),[pdfError,setPdfError]=useState('');
  const [categoryKind,setCategoryKind]=useState('expense');
  const movementChart=useRef(null),balanceChart=useRef(null),categoryChart=useRef(null);

  useEffect(()=>{
    let current=true;
    const {preset,...query}=filters;
    setLoading(true);
    setError('');
    setPdfState('');
    setPdfError('');
    api('/finance/reports?'+new URLSearchParams(query)).then(result=>{if(current)setReport(result)})
      .catch(failure=>{if(current){setReport(null);setError(failure.message)}})
      .finally(()=>{if(current)setLoading(false)});
    return ()=>{current=false};
  },[filters,retry,refreshKey]);

  const change=event=>{
    const {name,value}=event.target;
    setForm(current=>{
      if(name==='preset')return {...current,...(value==='custom'?{}:period(value)),preset:value};
      if(name==='from'||name==='to')return {...current,[name]:value,preset:'custom'};
      if(name==='kind')return {...current,kind:value,category_id:''};
      return {...current,[name]:value};
    });
  };
  const apply=event=>{
    event.preventDefault();
    setLoading(true);
    setFilters({...form});
    if(form.kind!=='all')setCategoryKind(form.kind);
  };
  const exportPdf=async()=>{
    setPdfState('busy');
    setPdfError('');
    try{
      const {downloadFinanceReport}=await import('./financeReportPdf.js');
      await downloadFinanceReport({
        report,summaries,categoryKind,
        categoryName:categories.find(category=>String(category.id)===report.filters.category_id)?.name,
        charts:[movementChart,balanceChart,categoryChart].map(ref=>ref.current?.querySelector('svg')),
      });
      setPdfState('ready');
    }catch{
      setPdfError('Couldn’t export the PDF. Please try again.');
      setPdfState('');
    }
  };
  const hasBreakdownFilter=report&&Object.entries(report.filters).some(([key,value])=>key==='category_id'?Boolean(value):value!=='all');
  const editingDisabled=pdfState==='busy';

  return <section className="page-stack finance-reports" aria-busy={loading}>
    <form onSubmit={apply} className="panel finance-report-filters">
      <div className="panel-heading"><h2>Report period</h2>
        <button className="btn" type="button" onClick={exportPdf} disabled={!report||loading||editingDisabled}>
          {editingDisabled?<Spinner label="Preparing PDF…"/>:<><FiDownload aria-hidden="true"/>Export PDF</>}
        </button>
      </div>
      <div className="filters">
        <label>Period<select name="preset" value={form.preset} onChange={change}>
          {Object.entries(presets).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>From<input name="from" type="date" required max={form.to} value={form.from} onChange={change}/></label>
        <label>To<input name="to" type="date" required min={form.from} value={form.to} onChange={change}/></label>
        <label>Type<select name="kind" value={form.kind} onChange={change}>
          <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option>
        </select></label>
        <label>Source<select name="source" value={form.source} onChange={change}>
          <option value="all">All sources</option>
          {['manual','realty','hr'].map(source=><option key={source} value={source}>{financeSourceLabel(source)}</option>)}
        </select></label>
        <label>Category<select name="category_id" value={form.category_id} onChange={change}>
          <option value="">All categories</option>
          {categories.filter(category=>form.kind==='all'||category.kind===form.kind)
            .map(category=><option key={category.id} value={category.id}>{category.name} · {category.kind}</option>)}
        </select></label>
        <button className="btn primary" disabled={editingDisabled}>Apply filters</button>
      </div>
    </form>
    {loading&&<div className="finance-report-status" role="status"><Spinner label="Loading report…"/></div>}
    {error&&<Notice type="error" title="Couldn’t load report">{error} <button type="button" className="text-btn" onClick={()=>setRetry(value=>value+1)}>Retry</button></Notice>}
    {pdfError&&<Notice type="error">{pdfError}</Notice>}
    {pdfState==='ready'&&<Notice type="success" onDismiss={()=>setPdfState('')}>PDF downloaded.</Notice>}
    {report&&<div className={'page-stack finance-report-results'+(loading?' is-loading':'')} role="region" aria-label="Finance report results">
      <div className="finance-report-summary" aria-label="All posted transactions for the report period">
        {summaries.map(([label,key])=><div className="tile" key={key}><span>{label}</span><strong>{financeMoney(report[key])}</strong></div>)}
      </div>
      <div className="finance-report-caption"><span>{report.from} to {report.to}</span>
        <span>Account balances use all posted transactions in this period.</span></div>
      {report.period_count===0&&<Notice type="info" title="No posted transactions in this period">Any opening balance carries forward to the end date.</Notice>}
      {report.period_count>0&&report.matched_count===0&&<Notice type="info">No posted transactions match the breakdown filters.</Notice>}
      {report.period_count>0&&<div className="finance-report-chart-grid">
        <section className="panel" ref={movementChart}><h2>Money In and Out</h2>
          <p className="muted">{hasBreakdownFilter?'Matching transactions · ':''}{report.bucket_size==='day'?'Daily':report.bucket_size==='month'?'Monthly':'Yearly'} totals</p>
          <div className="chart-legend"><span className="chart-income">Money in {financeMoney(report.filtered_money_in)}</span>
            <span className="chart-expense">Money out {financeMoney(report.filtered_money_out)}</span></div>
          <FinanceTrendChart series={report.series}/>
        </section>
        <section className="panel" ref={balanceChart}><h2>Running Cash Balance</h2>
          <p className="muted">Whole ledger through the end of each period.</p>
          <FinanceTrendChart series={report.series} balance openingBalance={report.opening_balance}/>
        </section>
      </div>}
      {report.matched_count>0&&<section className="panel" ref={categoryChart}>
        <div className="panel-heading"><div><h2>Category Breakdown</h2><p className="muted">Highest amounts by transaction type.</p></div>
          <label className="chart-type">Chart type<select value={categoryKind} disabled={editingDisabled} onChange={event=>setCategoryKind(event.target.value)}>
            <option value="income">Income</option><option value="expense">Expense</option>
          </select></label>
        </div>
        <div className="finance-category-plot"><FinanceCategoryChart categories={report.categories} kind={categoryKind}/></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Category</th><th>Type</th><th className="align-right">Transactions</th><th className="align-right">Amount</th></tr></thead>
          <tbody>{report.categories.map(category=><tr key={category.kind+'/'+category.id}>
            <td>{category.name}</td><td>{category.kind==='income'?'Income':'Expense'}</td>
            <td className="align-right">{category.count}</td><td className="align-right">{financeMoney(category.amount)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}
      {report.period_count>0&&<details className="panel finance-report-table">
        <summary>View cash flow data table</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>Period</th><th className="align-right">Money in</th><th className="align-right">Money out</th><th className="align-right">Account balance</th></tr></thead>
          <tbody>{report.series.map(row=><tr key={row.label}><td>{row.label}</td><td className="align-right">{financeMoney(row.income)}</td>
            <td className="align-right">{financeMoney(row.expense)}</td><td className="align-right">{financeMoney(row.balance)}</td></tr>)}</tbody>
        </table></div>
      </details>}
    </div>}
  </section>;
}
