import {useEffect, useId, useRef, useState} from 'react';
import {FiArrowDownLeft, FiArrowUpRight, FiBarChart2, FiDownload, FiChevronDown, FiList, FiMinusCircle, FiPlusCircle} from 'react-icons/fi';
import {api} from './api.js';
import FinanceDateFilter from './FinanceDateFilter.jsx';
import {Notice, Spinner} from './FinanceFeedback.jsx';
import {financeMoney} from './financeFormat.js';
import {FinanceCategoryChart, FinanceTrendChart} from './FinanceReportCharts.jsx';
import {financeBucketLabel, financeDayCount, financePeriodLabel, financePresetRange} from './financePeriods.js';

const defaults = range => ({ ...range });
const summaries = [
  ['Opening balance', 'opening_balance', FiMinusCircle],
  ['Money in', 'money_in', FiArrowDownLeft, 'income'],
  ['Money out', 'money_out', FiArrowUpRight, 'expense'],
  ['Net cash change', 'net_change', FiBarChart2],
  ['Closing balance', 'closing_balance', FiPlusCircle, 'balance'],
];

export default function FinanceReports({categories, refreshKey, initialRange}) {
  const [form, setForm] = useState(() => defaults(initialRange));
  const [filters, setFilters] = useState(() => defaults(initialRange));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [pdfState, setPdfState] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [categoryKind, setCategoryKind] = useState('');
  const filterId = useId();
  const movementChart = useRef(null);
  const balanceChart = useRef(null);
  const categoryChart = useRef(null);

  useEffect(() => {
    let current = true;
    const {preset, ...query} = filters;
    setLoading(true);
    setError('');
    setPdfState('');
    setPdfError('');
    api('/finance/reports?' + new URLSearchParams(query))
      .then(result => { if (current) setReport(result); })
      .catch(failure => {
        if (current) {
          setReport(null);
          setError(failure.message);
        }
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, retry, refreshKey]);

  const apply = next => {
    setLoading(true);
    setFilters(next);
    setCategoryKind('');
  };
  const exportPdf = async () => {
    setPdfState('busy');
    setPdfError('');
    const charts = [movementChart, balanceChart, categoryChart].map(ref => ref.current?.querySelector('svg')?.cloneNode(true));
    try {
      const {downloadFinanceReport} = await import('./financeReportPdf.js');
      await downloadFinanceReport({
        report, summaries, categoryKind: shownCategoryKind,
        categoryName: categories.find(category => String(category.id) === report.filters.category_id)?.name,
        charts,
      });
      setPdfState('ready');
    } catch {
      setPdfError('Couldn’t export the PDF. Please try again.');
      setPdfState('');
    }
  };
  const shownCategoryKind = categoryKind || (report?.filters.kind !== 'all' && report?.filters.kind) ||
    (report?.categories.some(row => row.kind === 'expense') ? 'expense' : 'income');
  const editingDisabled = pdfState === 'busy';
  const validDates = financeDayCount(form.from, form.to) > 0;
  const chartPageHasData = report?.period_count > 0;
  const hasDraft = Object.keys(filters).some(key => filters[key] !== form[key]);

  return (
    <section className="page-stack finance-reports">
      <form className="finance-filter-form" onSubmit={event => {
        event.preventDefault();
        if (validDates) apply({...form});
      }}>
        <FinanceDateFilter title="Report Date Filter" range={form} onChange={setForm} disabled={editingDisabled} />
          <div className="finance-filter-actions">
            {hasDraft && <span className="finance-filter-pending">Changes pending</span>}
            <button className="btn" type="button" disabled={editingDisabled || loading} onClick={() => {
              const next = defaults(financePresetRange('month'));
              setForm(next);
              apply(next);
            }}>Reset dates</button>
            <button className="btn primary" disabled={editingDisabled || loading || !validDates}>Apply dates</button>
          </div>
      </form>

      {loading && <div className="finance-report-status" role="status"><Spinner label="Loading report…" /></div>}
      {error && <Notice type="error" title="Couldn’t load report">
        {error} <button type="button" className="text-btn" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </Notice>}
      {pdfError && <Notice type="error">{pdfError}</Notice>}
      {pdfState === 'ready' && <Notice type="success" onDismiss={() => setPdfState('')}>PDF downloaded.</Notice>}
      {report && <div className={'page-stack finance-report-results' + (loading ? ' is-loading' : '')}
        role="region" aria-label="Finance report results" aria-busy={loading}>
        <div className="finance-content-heading">
          <div><h2>Cash flow report</h2><p>{financePeriodLabel(report.from, report.to)} · {report.period_count.toLocaleString('en-PH')} posted {report.period_count === 1 ? 'transaction' : 'transactions'}</p></div>
          <button className="btn primary" type="button" onClick={exportPdf} disabled={loading || editingDisabled}>
            {editingDisabled ? <Spinner label="Preparing PDF…" /> : <><FiDownload aria-hidden="true" />Export PDF</>}
          </button>
        </div>
        <div className="finance-report-summary" aria-label="All posted transactions for the report period">
          {summaries.map(([label, key, Icon, tone]) => (
            <div className={`tile finance-metric finance-metric-${tone || 'neutral'}`} key={key}>
              <div className="finance-metric-heading"><span>{label}</span><Icon aria-hidden="true" /></div>
              <strong>{financeMoney(report[key])}</strong>
            </div>
          ))}
        </div>

        {!chartPageHasData && <Notice type="info" title="No posted transactions in this period">
          Any opening balance carries forward to the end date.
        </Notice>}
        {chartPageHasData && <div className="finance-report-chart-grid">
          <section className="panel finance-chart-panel" ref={movementChart}>
            <div className="finance-card-heading"><h2>Money In and Out</h2><p>
              {financeBucketLabel(report.bucket_size)} totals
            </p></div>
            <div className="chart-legend">
              <span className="chart-income">Money in <strong>{financeMoney(report.filtered_money_in)}</strong></span>
              <span className="chart-expense">Money out <strong>{financeMoney(report.filtered_money_out)}</strong></span>
            </div>
            <div className="finance-chart-scroll"><FinanceTrendChart series={report.series} /></div>
          </section>
          <section className="panel finance-chart-panel" ref={balanceChart}>
            <div className="finance-card-heading"><h2>Running Cash Balance</h2><p>Full ledger through the end of each period</p></div>
            <div className="chart-legend"><span className="chart-balance">Closing balance <strong>{financeMoney(report.closing_balance)}</strong></span></div>
            <div className="finance-chart-scroll"><FinanceTrendChart series={report.series} balance openingBalance={report.opening_balance} /></div>
          </section>
        </div>}
        {report.matched_count > 0 && <section className="panel finance-chart-panel" ref={categoryChart}>
          <div className="finance-content-heading">
            <div className="finance-card-heading"><h2>Category Breakdown</h2><p>Largest categories by transaction type</p></div>
            <div className="chart-type">
              <label className="finance-filter-label" htmlFor={filterId + '-chart'}>Chart type</label>
              <select id={filterId + '-chart'} value={shownCategoryKind} disabled={editingDisabled} onChange={event => setCategoryKind(event.target.value)}>
                <option value="income">Income</option><option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div className="finance-category-plot finance-chart-scroll">
            <FinanceCategoryChart categories={report.categories} kind={shownCategoryKind} />
          </div>
          <div className="table-wrap finance-analysis-table"><table className="finance-category-table" aria-label="Matching categories">
            <thead><tr><th>Category</th><th>Type</th><th className="align-right">Transactions</th><th className="align-right">Amount</th></tr></thead>
            <tbody>{report.categories.map(category => (
              <tr key={category.kind + '/' + category.id}>
                <th scope="row">{category.name}</th><td data-label="Type"><span className={'pill ' + category.kind}>{category.kind}</span></td>
                <td className="align-right" data-label="Transactions">{category.count}</td><td className="align-right" data-label="Amount">{financeMoney(category.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>}
        {chartPageHasData && <details className="panel finance-report-table">
          <summary>
            <span className="finance-table-icon"><FiList aria-hidden="true" /></span>
            <span className="finance-table-copy"><strong>View cash flow data table</strong><small>{financeBucketLabel(report.bucket_size)} totals and closing balances</small></span>
            <span className="finance-table-count">{report.series.length} periods</span>
            <FiChevronDown className="finance-table-chevron" aria-hidden="true" />
          </summary>
          <div className="finance-cash-table-body">
          <p className="finance-table-note">All amounts in Philippine pesos. Balances include the opening balance.</p>
          <div className="table-wrap finance-analysis-table"><table className="finance-cash-table" aria-label="Cash flow data">
            <thead><tr><th scope="col">Period</th><th scope="col" className="align-right">Money in</th><th scope="col" className="align-right">Money out</th><th scope="col" className="align-right">Closing balance</th></tr></thead>
            <tbody>{report.series.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th><td className="align-right finance-cash-income" data-label="Money in">{financeMoney(row.income)}</td>
                <td className="align-right finance-cash-expense" data-label="Money out">{financeMoney(row.expense)}</td><td className="align-right finance-cash-balance" data-label="Closing balance">{financeMoney(row.balance)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><th scope="row">Period totals</th><td className="align-right finance-cash-income" data-label="Money in">{financeMoney(report.money_in)}</td><td className="align-right finance-cash-expense" data-label="Money out">{financeMoney(report.money_out)}</td><td className="align-right finance-cash-balance" data-label="Closing balance">{financeMoney(report.closing_balance)}</td></tr></tfoot>
          </table></div>
          </div>
        </details>}
      </div>}
    </section>
  );
}
