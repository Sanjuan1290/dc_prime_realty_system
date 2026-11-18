import {useEffect, useId, useState} from 'react';
import {FiFilter} from 'react-icons/fi';
import {financeSourceLabel} from './financeFormat.js';
import {financeDayCount, todayInManila} from './financePeriods.js';

export default function FinanceTransactionFilters({filters, categories, onApply, loading}) {
  const id = useId();
  const [draft, setDraft] = useState(filters);
  useEffect(() => setDraft(filters), [filters.from, filters.to, filters.kind, filters.status, filters.source, filters.category_id]);
  const change = (name, value) => setDraft(current => ({...current, [name]: value, ...(name === 'kind' ? {category_id: ''} : {})}));
  const pending = Object.keys(filters).some(key => filters[key] !== draft[key]);
  const reset = () => {
    const to = todayInManila();
    const next = {from: `${to.slice(0, 7)}-01`, to, kind: 'all', status: 'posted', source: 'all', category_id: ''};
    setDraft(next);
    onApply(next);
  };
  return <form className="panel finance-transaction-filters" aria-label="Transaction filters" onSubmit={event => {
    event.preventDefault();
    if (financeDayCount(draft.from, draft.to) > 0) onApply({...draft});
  }}>
    <div className="finance-filter-heading"><div><h2><FiFilter aria-hidden="true"/>Transaction filters</h2><p>Find transactions by date, type, source, category, or status.</p></div></div>
    <div className="finance-transaction-fields">
      <label htmlFor={id + '-from'}>From<input id={id + '-from'} type="date" required value={draft.from} max={draft.to} onChange={event => change('from', event.target.value)}/></label>
      <label htmlFor={id + '-to'}>To<input id={id + '-to'} type="date" required value={draft.to} min={draft.from} onChange={event => change('to', event.target.value)}/></label>
      <div className="finance-filter-field"><label htmlFor={id + '-type'}>Type</label><select id={id + '-type'} value={draft.kind} onChange={event => change('kind', event.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div>
      <div className="finance-filter-field"><label htmlFor={id + '-source'}>Source</label><select id={id + '-source'} value={draft.source} onChange={event => change('source', event.target.value)}><option value="all">All sources</option>{['manual', 'realty', 'hr'].map(source => <option key={source} value={source}>{financeSourceLabel(source)}</option>)}</select></div>
      <div className="finance-filter-field"><label htmlFor={id + '-category'}>Category</label><select id={id + '-category'} value={draft.category_id} onChange={event => change('category_id', event.target.value)}><option value="">All categories</option>{categories.filter(category => draft.kind === 'all' || category.kind === draft.kind).map(category => <option key={category.id} value={category.id}>{category.name} · {category.kind}</option>)}</select></div>
      <div className="finance-filter-field"><label htmlFor={id + '-status'}>Status</label><select id={id + '-status'} value={draft.status} onChange={event => change('status', event.target.value)}><option value="posted">Posted</option><option value="void">Voided</option><option value="all">All statuses</option></select></div>
    </div>
    <div className="finance-filter-actions">
      {pending && <span className="finance-filter-pending" role="status">Changes pending</span>}
      <button className="btn" type="button" disabled={loading} onClick={reset}>Reset filters</button>
      <button className="btn primary" disabled={loading || financeDayCount(draft.from, draft.to) <= 0}>Apply filters</button>
    </div>
  </form>;
}
