import {financeMoney} from './financeFormat.js';

const compact=new Intl.NumberFormat('en-PH',{notation:'compact',maximumFractionDigits:1});
const periodDate=new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',month:'short',day:'numeric'});
const periodMonth=new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',month:'short',year:'2-digit'});
const incomeColor='#17735e',expenseColor='#b66b28',balanceColor='#1c5084';

export function periodLabel(label){
  if(label.length===4) return label;
  if(label.length===7) return periodMonth.format(new Date(label+'-01T00:00Z'));
  return periodDate.format(new Date(label+'T00:00Z'));
}

export function FinanceTrendChart({series,balance=false,openingBalance}){
  const width=720,height=238,left=66,right=20,top=16,bottom=33;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const values=balance?[Number(openingBalance),...series.map(row=>Number(row.balance))]:
    series.flatMap(row=>[Number(row.income),Number(row.expense)]);
  const min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;
  const y=value=>top+plotHeight-(value-min)/range*plotHeight;
  const step=plotWidth/Math.max(1,series.length);
  const x=index=>left+step*(index+(balance?1:0.5));
  const ticks=max===min?[0]:Array.from({length:5},(_,i)=>min+range*i/4);
  const labelStep=Math.max(1,Math.ceil(series.length/6));
  const barWidth=Math.min(20,step*.34);
  const line=balance?[[left,y(Number(openingBalance))],...series.map((row,index)=>[x(index),y(Number(row.balance))])]:[];
  const linePoints=line.map(point=>point.join(',')).join(' ');
  return <svg xmlns="http://www.w3.org/2000/svg" className="finance-plot" viewBox={`0 0 ${width} ${height}`}
    role="img" aria-label={balance?'Running cash balance over the report period':'Money in and money out by period'}
    fontFamily="Arial, sans-serif" fontSize="13">
    {ticks.map(value=><g key={value}>
      <line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#dce5ef"/>
      <text x={left-9} y={y(value)+4} fill="#506780" textAnchor="end">₱{compact.format(value)}</text>
    </g>)}
    {balance
      ?<><polygon points={`${left},${y(0)} ${linePoints} ${line.at(-1)[0]},${y(0)}`} fill="#eaf2fa"/>
        <polyline points={linePoints} fill="none" stroke={balanceColor} strokeWidth="3" strokeLinejoin="round"/>
        {series.map((row,index)=><circle key={row.label} cx={x(index)} cy={y(Number(row.balance))} r={series.length>48?2:3.5} fill={balanceColor}>
          <title>{row.label} · {financeMoney(row.balance)}</title></circle>)}</>
      :series.map((row,index)=><g key={row.label}>
        {[['income',incomeColor,'Money in',x(index)-barWidth-1],['expense',expenseColor,'Money out',x(index)+1]].map(([key,color,label,position])=>
          <rect key={key} x={position} y={y(Number(row[key]))} width={barWidth} height={y(0)-y(Number(row[key]))} rx="1.5" fill={color}>
            <title>{row.label} · {label} {financeMoney(row[key])}</title></rect>)}
      </g>)}
    {series.map((row,index)=>index%labelStep===0&&<text key={row.label}
      x={x(index)} y={height-9} textAnchor={x(index)>width-45?'end':'middle'} fill="#506780">{periodLabel(row.label)}</text>)}
  </svg>;
}

export function FinanceCategoryChart({categories,kind}){
  const rows=categories.filter(row=>row.kind===kind).slice(0,6);
  if(!rows.length) return <p className="finance-chart-empty">No {kind==='income'?'income':'expense'} categories match these filters.</p>;
  const width=720,left=208,body=376,rowHeight=35,max=Math.max(...rows.map(row=>Number(row.amount)));
  const color=kind==='income'?incomeColor:expenseColor;
  return <svg xmlns="http://www.w3.org/2000/svg" className="finance-plot"
    viewBox={`0 0 ${width} ${rows.length*rowHeight+16}`} fontFamily="Arial, sans-serif" fontSize="13"
    role="img" aria-label={`Top ${kind} categories by amount`}>
    {rows.map((row,index)=>{
      const y=12+index*rowHeight;
      const label=row.name.length>29?row.name.slice(0,27)+'…':row.name;
      return <g key={row.id}>
        <text x="2" y={y+15} fill="#253b53">{label}<title>{row.name}</title></text>
        <rect x={left} y={y} width={body} height="21" fill="#eaf0f6" rx="4"/>
        <rect x={left} y={y} width={body*Number(row.amount)/max} height="21" fill={color} rx="4">
          <title>{row.name} · {financeMoney(row.amount)}</title></rect>
        <text x={width-3} y={y+15} textAnchor="end" fill="#253b53">{financeMoney(row.amount)}</text>
      </g>;
    })}
  </svg>;
}
