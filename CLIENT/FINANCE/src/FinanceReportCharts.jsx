import {useEffect, useId, useRef, useState} from 'react';
import {financeMoney} from './financeFormat.js';

const compact = new Intl.NumberFormat('en-PH', {notation: 'compact', maximumFractionDigits: 1});
const periodDate = new Intl.DateTimeFormat('en-PH', {timeZone: 'UTC', month: 'short', day: 'numeric'});
const periodMonth = new Intl.DateTimeFormat('en-PH', {timeZone: 'UTC', month: 'short', year: '2-digit'});
const incomeColor = '#17735e', expenseColor = '#b66b28', balanceColor = '#1c5084';

export function periodLabel(label) {
  if (label.length === 4) return label;
  if (label.length === 7) return periodMonth.format(new Date(label + '-01T00:00Z'));
  return periodDate.format(new Date(label + 'T00:00Z'));
}

function useChart(count) {
  const ref = useRef(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState(null);
  const id = useId();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, Math.floor(entry.contentRect.width))));
    observer.observe(ref.current);
    const dismiss = event => {if (!ref.current?.contains(event.target)) setActive(null);};
    document.addEventListener('pointerdown', dismiss);
    return () => {observer.disconnect();document.removeEventListener('pointerdown', dismiss);};
  }, []);
  useEffect(() => setActive(null), [count]);
  const keyboard = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') return setActive(null);
    if (!count) return;
    setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 :
      Math.min(count - 1, Math.max(0, (index ?? -1) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1))));
  };
  return {ref, width, active, setActive, id, keyboard};
}

function ChartTooltip({id, title, values, width, x, y = 8}) {
  const tooltipWidth = Math.min(232, Math.max(0, width - 16));
  return <div id={id} role="tooltip" className="finance-chart-tooltip"
    style={{width: tooltipWidth, left: Math.max(8, Math.min(x - tooltipWidth / 2, width - tooltipWidth - 8)), top: y}}>
    <strong>{title}</strong>
    <dl>{values.map(([label, value, color]) => <div key={label}><dt><span style={{background: color}}/>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>;
}

export function FinanceTrendChart({series, balance = false, openingBalance = '0.00'}) {
  const {ref, width, active, setActive, id, keyboard} = useChart(series.length + (balance ? 1 : 0));
  const height = width < 420 ? 232 : 252, left = width < 420 ? 57 : 66, right = 18, top = 18, bottom = 35;
  const plotWidth = Math.max(1, width - left - right), plotHeight = height - top - bottom;
  const values = balance ? [Number(openingBalance), ...series.map(row => Number(row.balance))] :
    series.flatMap(row => [Number(row.income), Number(row.expense)]);
  const min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
  const y = value => top + plotHeight - (value - min) / range * plotHeight;
  const step = plotWidth / Math.max(1, series.length);
  const x = index => left + step * (index + (balance ? 1 : 0.5));
  const ticks = max === min ? [0] : Array.from({length: 5}, (_, i) => min + range * i / 4);
  const labelStep = Math.max(1, Math.ceil(series.length / (width < 420 ? 3 : 6)));
  const barWidth = Math.min(20, step * 0.34);
  const line = balance ? [[left, y(Number(openingBalance))], ...series.map((row, index) => [x(index), y(Number(row.balance))])] : [];
  const linePoints = line.map(point => point.join(',')).join(' ');
  const selectedIndex = balance ? active - 1 : active;
  const row = active === null ? null : balance && active === 0 ? {label: 'Opening balance', balance: openingBalance} : series[selectedIndex];
  const showPoint = event => {
    if (!series.length) return;
    const position = event.clientX - ref.current.getBoundingClientRect().left - left;
    setActive(Math.min(series.length - (balance ? 0 : 1), Math.max(0, balance ? Math.round(position / step) : Math.floor(position / step))));
  };
  const name = balance ? 'Running cash balance over the report period' : 'Money in and money out by period';
  return <div ref={ref} className="finance-interactive-chart" role="group" aria-label={name + '. Hover, tap, or use arrow keys for values.'}
    tabIndex={series.length ? 0 : undefined} aria-describedby={row ? id : undefined}
    onPointerMove={event => {if (event.pointerType === 'mouse') showPoint(event);}} onPointerDown={showPoint}
    onPointerLeave={event => {if (event.pointerType === 'mouse') setActive(null);}} onFocus={() => setActive(series.length ? 0 : null)} onBlur={() => setActive(null)} onKeyDown={keyboard}>
    <svg xmlns="http://www.w3.org/2000/svg" className="finance-plot" viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={name} fontFamily="Arial, sans-serif" fontSize="12">
      {row && <rect x={left + step * Math.max(0, selectedIndex)} y={top} width={step} height={plotHeight} fill="#edf3f9"/>}
      {ticks.map(value => <g key={value}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#dce5ef"/>
        <text x={left - 8} y={y(value) + 4} fill="#506780" textAnchor="end">₱{compact.format(value)}</text>
      </g>)}
      {balance ? <>
        <polygon points={`${left},${y(0)} ${linePoints} ${line.at(-1)[0]},${y(0)}`} fill="#eaf2fa"/>
        <polyline points={linePoints} fill="none" stroke={balanceColor} strokeWidth="3" strokeLinejoin="round"/>
        {active === 0 && <circle cx={left} cy={y(Number(openingBalance))} r="5" fill={balanceColor} stroke="#fff" strokeWidth="2"/>}
        {series.map((item, index) => <circle key={item.label} cx={x(index)} cy={y(Number(item.balance))}
          r={selectedIndex === index ? 5 : series.length > 48 ? 2 : 3.5} fill={balanceColor} stroke={selectedIndex === index ? '#fff' : balanceColor} strokeWidth="2"/>)}
      </> : series.map((item, index) => <g key={item.label}>
        {[['income', incomeColor, x(index) - barWidth - 1], ['expense', expenseColor, x(index) + 1]].map(([key, color, position]) =>
          <rect key={key} x={position} y={y(Number(item[key]))} width={barWidth} height={Math.max(0, y(0) - y(Number(item[key])))} rx="1.5" fill={color} opacity={active === null || active === index ? 1 : 0.55}/>)}
      </g>)}
      {series.map((item, index) => index % labelStep === 0 && <text key={item.label} x={x(index)} y={height - 9}
        textAnchor={x(index) > width - 45 ? 'end' : 'middle'} fill="#506780">{periodLabel(item.label)}</text>)}
    </svg>
    {row && <ChartTooltip id={id} width={width} x={balance && active === 0 ? left : x(selectedIndex)} title={row.label}
      y={Math.max(8, Math.min(height - 108, y(balance ? Number(row.balance) : Math.max(Number(row.income), Number(row.expense))) - 94))}
      values={balance ? [['Closing balance', financeMoney(row.balance), balanceColor]] :
        [['Money in', financeMoney(row.income), incomeColor], ['Money out', financeMoney(row.expense), expenseColor]]}/>}
  </div>;
}

export function FinanceCategoryChart({categories, kind}) {
  const rows = categories.filter(row => row.kind === kind).slice(0, 6);
  const {ref, width, active, setActive, id, keyboard} = useChart(rows.length);
  const narrow = width < 540, rowHeight = narrow ? 72 : 38;
  const left = narrow ? 2 : Math.min(208, width * 0.3), body = narrow ? Math.max(1, width - 4) : Math.max(1, width - left - 146);
  const max = Math.max(0, ...rows.map(row => Number(row.amount))) || 1;
  const color = kind === 'income' ? incomeColor : expenseColor;
  const row = rows[active];
  const showRow = event => {
    const bounds = ref.current.getBoundingClientRect();
    setActive(Math.min(rows.length - 1, Math.max(0, Math.floor((event.clientY - bounds.top - 8) / rowHeight))));
  };
  return <div ref={ref} className="finance-interactive-chart" role="group" aria-label={`Top ${kind} categories. Hover, tap, or use arrow keys for values.`}
    tabIndex={rows.length ? 0 : undefined} aria-describedby={row ? id : undefined} onFocus={() => setActive(rows.length ? 0 : null)}
    onPointerMove={event => {if (event.pointerType === 'mouse') showRow(event);}} onPointerDown={showRow}
    onPointerLeave={event => {if (event.pointerType === 'mouse') setActive(null);}} onBlur={() => setActive(null)} onKeyDown={keyboard}>
    {!rows.length ? <p className="finance-chart-empty">No {kind === 'income' ? 'income' : 'expense'} categories in this period.</p> :
      <svg xmlns="http://www.w3.org/2000/svg" className="finance-plot" viewBox={`0 0 ${width} ${rows.length * rowHeight + 16}`}
        fontFamily="Arial, sans-serif" fontSize="12" role="img" aria-label={`Top ${kind} categories by amount`}>
        {rows.map((item, index) => {
          const y = 12 + index * rowHeight;
          const limit = narrow ? Math.max(8, Math.floor((width - 8) / 8)) : 27;
          const label = item.name.length > limit ? item.name.slice(0, limit - 1) + '…' : item.name;
          return <g key={item.id}>
            <text x="2" y={y + 14} fill="#253b53">{label}</text>
            <rect x={left} y={narrow ? y + 43 : y} width={body} height={narrow ? 12 : 21} fill="#eaf0f6" rx="4"/>
            <rect x={left} y={narrow ? y + 43 : y} width={body * Number(item.amount) / max} height={narrow ? 12 : 21} fill={color} rx="4" opacity={active === null || active === index ? 1 : 0.55}/>
            <text x={narrow ? 2 : width - 2} y={y + (narrow ? 33 : 14)} textAnchor={narrow ? 'start' : 'end'} fill="#253b53">{financeMoney(item.amount)}</text>
          </g>;
        })}
      </svg>}
    {row && <ChartTooltip id={id} title={row.name} width={width} x={width * 0.6} y={Math.max(4, active * rowHeight - 70)}
      values={[[kind === 'income' ? 'Income' : 'Expense', financeMoney(row.amount), color], ['Transactions', String(row.count), '#667b91']]}/>}
  </div>;
}
