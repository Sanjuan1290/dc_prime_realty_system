const cents=value=>{
  const s=String(value??'0'),negative=s.startsWith('-'),[whole,fraction='']=s.replace(/^[+-]/,'').split('.');
  const amount=BigInt(whole||0)*100n+BigInt(fraction.padEnd(2,'0').slice(0,2));return negative?-amount:amount;
};
const decimal=value=>`${value<0n?'-':''}${(value<0n?-value:value)/100n}.${String((value<0n?-value:value)%100n).padStart(2,'0')}`;
export const financeMoney=value=>{const amount=cents(value),positive=amount<0n?-amount:amount;return `${amount<0n?'-':''}₱${new Intl.NumberFormat('en-PH').format(positive/100n)}.${String(positive%100n).padStart(2,'0')}`};
export const sumPayments=(items,kind)=>decimal(items.filter(item=>['new','restore'].includes(item.decision)&&item.kind===kind).reduce((total,item)=>total+cents(item.amount),0n));

export const financeActions={
 'transaction.posted':'Transaction posted','transaction.corrected':'Transaction corrected','transaction.voided':'Transaction voided',
 'finance.import.preview':'File reviewed','finance.import.committed':'Import completed','finance.import.undone':'Import undone',
 'finance.import.payment_restored':'Payment restored','category.created_by_import':'Category created during import','category.reactivated_by_import':'Category reactivated during import',
 'category.created':'Category created','category.status_changed':'Category status changed','user.created':'User invited','user.invitation.sent':'Invitation sent','user.invitation.renewed':'Invitation renewed','user.password.changed':'Password changed',
 'user.access_changed':'User access changed','category.deleted':'Category deleted',
 'user.password.reset':'Password reset completed'
};
export const financeActionLabel=action=>(financeActions[action]||String(action||'Activity').replaceAll(/[._]/g,' ').replace(/^./,letter=>letter.toUpperCase()));

const manilaDate=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Asia/Manila',day:'numeric',month:'short',year:'numeric',
});
const manilaTime=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit',hour12:true,
});
export function financeDateTime(value,{local=false}={}){
  if(!value) return '—';
  const text=String(value).replace(' ','T');
  const iso=/(Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+(local?'+08:00':'Z');
  const date=new Date(iso);
  return Number.isNaN(date.getTime())?'—':manilaDate.format(date)+', '+manilaTime.format(date);
}
export const financeSourceLabel=value=>({hr:'HR & Payroll',realty:'Company Finances',manual:'Manual entry'}[value]||String(value||'—'));
