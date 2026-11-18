import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {financeDateTime,financeMoney,financeSourceLabel} from './financeFormat.js';
import regularFont from './reportFonts/ReportSans-Regular.ttf?url';
import boldFont from './reportFonts/ReportSans-Bold.ttf?url';

const fontFamily='ReportSans';
async function pdfFonts(doc){
  await Promise.all([['regular',regularFont,'normal'],['bold',boldFont,'bold']].map(async ([name,url,style])=>{
    const response=await fetch(url);
    if(!response.ok)throw new Error('Could not load the report font.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    const fileName='ReportSans-'+name+'.ttf';
    let data='';
    for(let index=0;index<bytes.length;index+=8192) data+=String.fromCharCode(...bytes.subarray(index,index+8192));
    doc.addFileToVFS(fileName,btoa(data));
    doc.addFont(fileName,fontFamily,style);
  }));
}

const navy=[24,52,80],muted=[76,96,120],line=[220,229,240];

async function chartImage(chart){
  if(!chart)return null;
  const {width,height}=chart.viewBox.baseVal;
  const clone=chart.cloneNode(true);
  clone.setAttribute('width',String(width));
  clone.setAttribute('height',String(height));
  const xml=new XMLSerializer().serializeToString(clone);
  const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();
    image.src=url;
    await image.decode();
    const canvas=document.createElement('canvas');
    canvas.width=width*2;
    canvas.height=height*2;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return {data:canvas.toDataURL('image/png'),ratio:height/width};
  }finally{
    URL.revokeObjectURL(url);
  }
}

export async function downloadFinanceReport({report,summaries,categoryKind,categoryName,charts}){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  const [images]=await Promise.all([Promise.all(charts.map(chartImage)),pdfFonts(doc)]);
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
  const margin=14,contentWidth=width-2*margin;
  const filters=report.filters;
  doc.setProperties({title:'Prime Finance Cash Flow Report',subject:report.from+' to '+report.to});
  doc.setFillColor(...navy);
  doc.rect(0,0,width,31,'F');
  doc.setTextColor(255,255,255);
  doc.setFont(fontFamily,'bold');
  doc.setFontSize(20);
  doc.text('Prime Finance | Cash Flow Report',margin,15);
  doc.setFont(fontFamily,'normal');
  doc.setFontSize(10);
  doc.text(report.from+' to '+report.to,margin,24);
  doc.text('Generated '+financeDateTime(new Date().toISOString())+' (Philippine Time)',width-margin,24,{align:'right'});

  doc.setTextColor(...muted);
  doc.text('Gross totals include all posted transactions within the period.',margin,39);
  const tileCount=summaries.length+1;
  const tileWidth=(contentWidth-(tileCount-1)*3)/tileCount;
  summaries.forEach(([label,key],index)=>{
    const x=margin+index*(tileWidth+3);
    doc.setDrawColor(...line);
    doc.setFillColor(245,248,252);
    doc.roundedRect(x,43,tileWidth,24,2,2,'FD');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(label,x+3,49);
    doc.setFont(fontFamily,'bold');
    doc.setFontSize(13);
    doc.setTextColor(...navy);
    doc.text(financeMoney(report[key]),x+3,57,{maxWidth:tileWidth-5});
    doc.setFont(fontFamily,'normal');
  });
  const actualX=margin+summaries.length*(tileWidth+3);
  doc.setFillColor(...navy);doc.roundedRect(actualX,43,tileWidth,24,2,2,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(9);doc.text('Actual totals',actualX+3,49);
  for(const [index,label,key] of [[0,'Money in','actual_money_in'],[1,'Money out','actual_money_out']]){
    const y=55+index*6;
    doc.setFontSize(8);doc.setFont(fontFamily,'normal');doc.text(label,actualX+3,y);
    doc.setFontSize(11);doc.setFont(fontFamily,'bold');
    doc.text(report[key]==null?'—':financeMoney(report[key]),actualX+tileWidth-3,y,{align:'right',maxWidth:tileWidth-22});
  }
  doc.setFont(fontFamily,'normal');doc.setTextColor(...muted);doc.setFontSize(8);
  const explanation=doc.splitTextToSize('Actual totals exclude salary releases reversed by '+report.to+' and their matching undo entries. Each imported payment is counted once.',contentWidth);
  doc.text(explanation,margin,73);

  const applied=[
    filters.kind==='all'?'All types':filters.kind==='income'?'Income':'Expense',
    filters.source==='all'?'All sources':financeSourceLabel(filters.source),
    categoryName||(filters.category_id?'Category #'+filters.category_id:'All categories'),
  ];
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  const filterLines=doc.splitTextToSize('Report scope - '+applied.join(' | '),contentWidth);
  const scopeTop=80+(explanation.length-1)*3.5;
  doc.text(filterLines,margin,scopeTop);
  const chartTop=scopeTop+6+(filterLines.length-1)*4;
  const half=(contentWidth-6)/2;
  const place=(image,title,x,y,w)=>{
    doc.setFontSize(11);
    doc.setTextColor(...navy);
    doc.setFont(fontFamily,'bold');
    doc.text(title,x,y);
    doc.setFont(fontFamily,'normal');
    if(image){
      doc.addImage(image.data,'PNG',x,y+3,w,w*image.ratio);
      return y+3+w*image.ratio;
    }
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text('No matching data.',x,y+7);
    return y+9;
  };
  const trendsEnd=Math.max(
    place(images[0],'Money In and Out (gross)',margin,chartTop,half),
    place(images[1],'Running Cash Balance (whole ledger)',margin+half+6,chartTop,half),
  );
  if(images[0]){
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text('Money in (green) | Money out (amber)',margin,trendsEnd+2);
  }
  const categoryTitle=categoryKind==='income'?'Top Income Categories (gross)':'Top Expense Categories (gross)';
  const categoryEnd=place(images[2],categoryTitle,margin,trendsEnd+10,Math.min(160,contentWidth));
  const rowData=report.categories.map(row=>[row.name,row.kind==='income'?'Income':'Expense',String(row.count),financeMoney(row.amount)]);
  let startY=categoryEnd+6;
  if(startY>height-32){doc.addPage();startY=margin;}
  autoTable(doc,{
    startY,margin:{left:margin,right:margin,top:margin,bottom:15},theme:'striped',
    head:[['Category','Type','Transactions','Amount']],
    body:rowData.length?rowData:[['No transactions in the selected period.','','','']],
    styles:{font:fontFamily,fontSize:9,cellPadding:3,textColor:navy},
    headStyles:{fillColor:navy,textColor:[255,255,255]},
    columnStyles:{2:{halign:'right'},3:{halign:'right'}},
  });
  const totalPages=doc.getNumberOfPages();
  for(let page=1;page<=totalPages;page++){
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Prime Finance',margin,height-7);
    doc.text(`Page ${page} of ${totalPages}`,width-margin,height-7,{align:'right'});
  }
  doc.save('Prime-Finance-Report-'+report.from+'-to-'+report.to+'.pdf');
}
