import {FiCheckCircle} from 'react-icons/fi';
import {financeMoney} from './financeFormat.js';
import {financeDate} from './financePeriods.js';

const money=value=>value==null?'—':financeMoney(value);

export default function FinanceActualTotals({report}) {
  return <section className="tile finance-metric finance-metric-actual" aria-label="Actual money in and out">
    <div className="finance-metric-heading"><span>Actual totals</span><FiCheckCircle aria-hidden="true"/></div>
    <dl className="finance-actual-values">
      <div><dt>Money in</dt><dd>{money(report.actual_money_in)}</dd></div>
      <div><dt>Money out</dt><dd>{money(report.actual_money_out)}</dd></div>
    </dl>
  </section>;
}

export function FinanceTotalsNote({report}) {
  const crossesPeriod=report.payroll_correction_money_in!==report.payroll_correction_money_out;
  return <p className="finance-totals-note">
    Money in and money out are gross totals, including payroll undo entries. Actual totals exclude salary releases reversed by {financeDate(report.to)} and their matching undo entries. Each imported payment is counted once.
    {crossesPeriod&&' A correction crosses this date range, so actual money in minus actual money out can differ from net cash change.'}
  </p>;
}
