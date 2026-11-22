import {FiArrowDownLeft, FiArrowRight, FiArrowUpRight, FiBarChart2, FiFileText, FiList, FiShield, FiTrendingUp} from 'react-icons/fi';
import {Notice, Spinner} from './FinanceFeedback.jsx';
import {financeMoney} from './financeFormat.js';
import {financeDate, financePeriodLabel} from './financePeriods.js';

function CashTile({icon: Icon, label, value, hint, tone = ''}) {
  return <div className={`tile finance-metric finance-metric-${tone}`}>
    <div className="finance-metric-heading"><span>{label}</span><Icon aria-hidden="true" /></div>
    <strong>{value == null ? '—' : financeMoney(value)}</strong>
    <small>{hint}</small>
  </div>;
}

export default function FinanceDashboard({
  range, dashboard, loading, canAdmin, canImport, onOpenReports, onOpenTransactions, onOpenImports, onOpenAudit,
}) {
  const shortcuts = [
    {label:'Transactions', hint:'Find payments and review entries.', icon:FiList, action:onOpenTransactions},
    {label:'Reports', hint:'Explore cash flow, charts and date ranges.', icon:FiBarChart2, action:onOpenReports},
    ...(canImport ? [
      {label:'Imports', hint:'Bring in HR and Company Finances payments.', icon:FiFileText, action:onOpenImports},
    ] : []),
    ...(canAdmin ? [
      {label:'Audit Logs', hint:'Review Finance account activity.', icon:FiShield, action:onOpenAudit},
    ] : []),
  ];

  return <section className="page-stack finance-dashboard" aria-label="Finance dashboard">
    <div className="finance-content-heading">
      <div><h2>This month at a glance</h2><p>{financePeriodLabel(range.from, range.to)}</p></div>
    </div>
    {!dashboard && loading && <div className="finance-report-status" role="status"><Spinner label="Loading dashboard…" /></div>}
    {dashboard && <div className="page-stack finance-report-results" aria-busy={loading}>
      <div className="finance-dashboard-summary">
        <CashTile icon={FiTrendingUp} label="Available balance" value={dashboard.closing_balance}
          hint={`As of ${financeDate(dashboard.to)}`} tone="balance" />
        <CashTile icon={FiArrowDownLeft} label="Actual money in" value={dashboard.actual_money_in}
          hint="Income this month, excluding reversed entries" tone="income" />
        <CashTile icon={FiArrowUpRight} label="Actual money out" value={dashboard.actual_money_out}
          hint="Expenses this month, excluding reversed entries" tone="expense" />
      </div>
      {Number(dashboard.closing_balance) < 0 && <Notice type="warning" title="Balance needs attention">
        Recorded expenses exceed the available cash. Open Reports to review the cash flow and Transactions to check the entries.
      </Notice>}
      {dashboard.period_count === 0 && <Notice type="info" title="No transactions this month">
        Your previous balance carries forward. Open Reports to review another period.
      </Notice>}
    </div>}
    <section className="panel finance-quick-nav" aria-label="Finance quick navigation">
      <div className="finance-card-heading"><h2>Quick navigation</h2><p>Open the Finance area you need.</p></div>
      <div className="finance-quick-links">
        {shortcuts.map(({label, hint, icon: Icon, action}) => <button type="button" key={label} onClick={action}>
          <Icon className="finance-shortcut-icon" aria-hidden="true" />
          <span><strong>{label}</strong><small>{hint}</small></span>
          <FiArrowRight aria-hidden="true" />
        </button>)}
      </div>
    </section>
  </section>;
}
