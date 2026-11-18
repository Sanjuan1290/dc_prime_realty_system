import {useId} from 'react';
import {FiCalendar} from 'react-icons/fi';
import {financeDayCount, financePresetRange, financeRangeOptions} from './financePeriods.js';

export default function FinanceDateFilter({title, range, onChange, disabled}) {
  const titleId = useId();
  const custom = range.preset === 'custom';
  const days = financeDayCount(range.from, range.to);

  const selectRange = event => {
    const preset = event.target.value;
    onChange(preset === 'custom' ? { ...range, preset } : { ...range, ...financePresetRange(preset) });
  };

  return (
    <section className="panel finance-date-filter" aria-labelledby={titleId}>
      <div className="finance-date-copy">
        <h2 id={titleId}><FiCalendar aria-hidden="true" />{title}</h2>
        <p>Month presets cover full calendar months. Choose Custom Range to set exact dates.</p>
      </div>
      <div className="finance-date-fields">
        <div className="finance-filter-field">
          <label className="finance-filter-label" htmlFor={titleId + '-range'}>Range</label>
          <select id={titleId + '-range'} name="preset" value={range.preset} onChange={selectRange} disabled={disabled}>
            {financeRangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="finance-filter-field">
          <label className="finance-filter-label" htmlFor={titleId + '-from'}>From Date</label>
          <input id={titleId + '-from'} name="from" type="date" required value={range.from} max={range.to || undefined}
            disabled={disabled || !custom} onChange={event => onChange({ ...range, from: event.target.value })} />
        </div>
        <div className="finance-filter-field">
          <label className="finance-filter-label" htmlFor={titleId + '-to'}>To Date</label>
          <input id={titleId + '-to'} name="to" type="date" required value={range.to} min={range.from || undefined}
            disabled={disabled || !custom} onChange={event => onChange({ ...range, to: event.target.value })} />
        </div>
      </div>
      {days > 0 && <div className="finance-date-meta">
        <span className="subtle-badge">Selected: {days.toLocaleString('en-PH')} {days === 1 ? 'day' : 'days'}</span>
      </div>}
    </section>
  );
}
