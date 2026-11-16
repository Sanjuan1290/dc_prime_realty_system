const cents=value=>{
  const s=String(value??'0'),negative=s.startsWith('-'),[whole,fraction='']=s.replace(/^[+-]/,'').split('.');
  const amount=BigInt(whole||0)*100n+BigInt(fraction.padEnd(2,'0').slice(0,2));return negative?-amount:amount;
};
const decimal=value=>`${value<0n?'-':''}${(value<0n?-value:value)/100n}.${String((value<0n?-value:value)%100n).padStart(2,'0')}`;
export const financeMoney=value=>{const amount=cents(value),positive=amount<0n?-amount:amount;return `${amount<0n?'-':''}₱${new Intl.NumberFormat('en-PH').format(positive/100n)}.${String(positive%100n).padStart(2,'0')}`};
export const sumPayments=(items,kind)=>decimal(items.filter(item=>['new','restore'].includes(item.decision)&&item.kind===kind).reduce((total,item)=>total+cents(item.amount),0n));

export const financeActionLabel=action=>({
 'transaction.posted':'Transaction posted','transaction.corrected':'Transaction corrected','transaction.voided':'Transaction voided',
 'finance.import.preview':'File reviewed','finance.import.committed':'Import completed','finance.import.undone':'Import undone',
 'finance.import.payment_restored':'Payment restored','category.created_by_import':'Category created during import','category.reactivated_by_import':'Category reactivated during import',
 'category.created':'Category created','category.status_changed':'Category status changed','user.created':'User invited','user.invitation.sent':'Invitation sent','user.invitation.renewed':'Invitation renewed','user.password.changed':'Password changed'
}[action]||String(action||'Activity').replaceAll(/[._]/g,' ').replace(/^./,letter=>letter.toUpperCase()));
