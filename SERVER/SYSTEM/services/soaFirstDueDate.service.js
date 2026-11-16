const scheduledTypes=new Set(['downpayment','monthly amortization','monthly','advance payment','advance','full payment','full']);
export function locksSoaFirstDueDate(payment={}){
  const status=String(payment.lot_project_payment_status??payment.status??'Verified').trim().toLowerCase();
  if(['cancelled','void','voided','rejected'].includes(status))return false;
  const type=String(payment.lot_project_payment_type??payment.paymentTypeValue??payment.paymentType??payment.type??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  return scheduledTypes.has(type)||type==='down payment';
}

// Re-date the existing installment rows, preserving IDs, cash values and all
// reservation allocations. Never cancel and regenerate a paid schedule.
export function planSoaDueDateUpdates(existing,computed){
  const type=row=>{
    const text=String(row.description||'').toLowerCase();
    if(text.includes('downpayment')||text.includes('down payment'))return 'downpayment';
    if(text.includes('monthly'))return 'monthly';
    if(text.includes('full payment'))return 'full_payment';
    return '';
  };
  const updates=[];
  for(const kind of ['downpayment','monthly','full_payment']){
    const saved=existing.filter(row=>type(row)===kind&&String(row.schedule_status).toLowerCase()!=='cancelled');
    const fresh=computed.filter(row=>type(row)===kind);
    if(saved.length!==fresh.length)throw Object.assign(new Error('The current SOA rows do not match the saved payment terms. Review the account before changing its First Due Date.'),{statusCode:409});
    for(let index=0;index<saved.length;index++){
      const row=saved[index],dueDate=fresh[index].dueDate;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate||''))throw Object.assign(new Error('The new SOA contains an invalid due date.'),{statusCode:400});
      updates.push({id:row.lot_project_payment_schedule_id,dueDate});
    }
  }
  return updates;
}
