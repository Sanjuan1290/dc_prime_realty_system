import {useId, useState} from 'react';
import {FiArrowDownLeft, FiArrowRight, FiArrowUpRight, FiBarChart2, FiDollarSign} from 'react-icons/fi';
import FinanceDateFilter from './FinanceDateFilter.jsx';
import {Notice, Spinner} from './FinanceFeedback.jsx';
import {FinanceTrendChart} from './FinanceReportCharts.jsx';
import {financeMoney} from './financeFormat.js';
import {financeBucketLabel, financeDate, financeDayCount, financePeriodLabel} from './financePeriods.js';

const countFormat = new Intl.NumberFormat('en-PH');

function CashTile({icon: Icon, label, value, hint, tone = ''}) {
  return (
    <div className={`tile finance-metric finance-metric-${tone}`}>
      <div className="finance-metric-heading"><span>{label}</span><Icon aria-hidden="true" /></div>
      <strong>{financeMoney(value)}</strong>
      <small>{hint}</small>
    </div>
  );
}

export default function FinanceDashboard({
  range, onRangeChange, dashboard, transactions, loading, onOpenReports, onOpenTransactions, onViewTransaction,
}) {
  const [draft, setDraft] = useState(range);
  const categoriesId = useId();
  const hasDraft = draft.preset !== range.preset || draft.from !== range.from || draft.to !== range.to;
  const canApply = hasDraft && financeDayCount(draft.from, draft.to) > 0;
  const topCategories = dashboard?.categories.slice(0, 4) ?? [];

  return (
    <section className="page-stack finance-dashboard">
      <form className="finance-filter-form" onSubmit={event => {
        event.preventDefault();
        if (canApply) onRangeChange(draft);
      }}>
        <FinanceDateFilter title="Dashboard Date Filter" range={draft} onChange={setDraft} />
        {hasDraft && <div className="finance-filter-actions">
          <button className="btn primary" disabled={loading || !canApply}>Apply dates</button>
        </div>}
      </form>

      {!dashboard && loading && <div className="finance-report-status" role="status"><Spinner label="Loading dashboard…" /></div>}
      {dashboard && <div className={'page-stack finance-report-results' + (loading ? ' is-loading' : '')} aria-busy={loading}>
        <div className="finance-content-heading">
          <div><h2>Cash overview</h2><p>{financePeriodLabel(dashboard.from, dashboard.to)}</p></div>
          <button type="button" className="btn" onClick={onOpenReports}>
            <FiBarChart2 aria-hidden="true" /> Open Reports
          </button>
        </div>
        <div className="finance-dashboard-summary">
          <CashTile icon={FiDollarSign} label="Closing balance" value={dashboard.closing_balance}
            hint={'As of ' + financeDate(dashboard.to)} tone="balance" />
          <CashTile icon={FiArrowDownLeft} label="Money in" value={dashboard.money_in} hint="Posted income" tone="income" />
          <CashTile icon={FiArrowUpRight} label="Money out" value={dashboard.money_out} hint="Posted expenses" tone="expense" />
          <CashTile icon={FiBarChart2} label="Net cash change" value={dashboard.net_change} hint="Money in minus money out"
            tone={Number(dashboard.net_change) < 0 ? 'expense' : 'net'} />
        </div>
        <dl className="finance-overview-strip">
          <div><dt>Opening balance</dt><dd>{financeMoney(dashboard.opening_balance)}</dd></div>
          <div><dt>Posted transactions in this period</dt><dd>{countFormat.format(dashboard.period_count)}</dd></div>
        </dl>

        {dashboard.period_count === 0 ? (
          <Notice type="info" title="No posted transactions in this period">
            Your opening balance carries forward. Choose another date range to see more activity.
          </Notice>
        ) : (
          <>
            <div className="finance-dashboard-insights">
              <section className="panel finance-chart-panel">
                <div className="finance-card-heading"><h2>Cash flow</h2><p>{financeBucketLabel(dashboard.bucket_size)} money in and out</p></div>
                <div className="chart-legend"><span className="chart-income">Money in</span><span className="chart-expense">Money out</span></div>
                <div className="finance-chart-scroll"><FinanceTrendChart series={dashboard.series} /></div>
              </section>
              <section className="panel finance-chart-panel">
                <div className="finance-card-heading"><h2>Top categories</h2><p>Largest totals in the selected period</p></div>
                <ul className="finance-top-categories">
                  {topCategories.map(category => <li key={category.kind + '/' + category.id} tabIndex={0} aria-describedby={`${categoriesId}-${category.kind}-${category.id}`}>
                    <div className="finance-category-total">
                      <span>{category.name}</span><strong>{financeMoney(category.amount)}</strong>
                    </div>
                    <div className={`finance-category-meter ${category.kind}`} aria-hidden="true">
                      <span style={{width: `${100 * Number(category.amount) / Number(topCategories[0].amount)}%`}} />
                    </div>
                    <span className="finance-category-kind">{category.kind === 'income' ? 'Income' : 'Expense'}</span>
                    <span role="tooltip" id={`${categoriesId}-${category.kind}-${category.id}`} className="finance-category-hover-tip">{category.name} · {financeMoney(category.amount)} · {countFormat.format(category.count)} {category.count === 1 ? 'transaction' : 'transactions'}</span>
                  </li>)}
                </ul>
              </section>
            </div>
            <section className="panel finance-chart-panel">
              <div className="finance-content-heading">
                <div className="finance-card-heading"><h2>Recent transactions</h2><p>Latest posted entries in this period</p></div>
                <button type="button" className="btn" onClick={onOpenTransactions}>View transactions <FiArrowRight aria-hidden="true" /></button>
              </div>
              <div className="table-wrap finance-analysis-table">
                <table aria-label="Recent posted transactions">
                  <thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Type</th><th className="align-right">Amount</th></tr></thead>
                  <tbody>{transactions.map(row => (
                    <tr key={row.id}>
                      <td>{financeDate(row.transaction_date)}</td>
                      <td><button type="button" className="text-btn" onClick={() => onViewTransaction(row.id)}>{row.description}</button></td>
                      <td>{row.category_name}</td><td><span className={'pill ' + row.kind}>{row.kind}</span></td>
                      <td className="align-right">{financeMoney((row.kind === 'expense' ? '-' : '') + row.amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {transactions.length === 0 && <p className="muted">No recent entries to display.</p>}
            </section>
          </>
        )}
      </div>}
    </section>
  );
}
