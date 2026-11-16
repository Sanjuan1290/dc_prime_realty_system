// Keep aligned with the independently deployed Realty API policy.
export function locksSoaFirstDueDate(payment={}){
  const status=String(payment.lot_project_payment_status??payment.status??'Verified').trim().toLowerCase();
  if(['cancelled','void','voided','rejected'].includes(status))return false;
  const type=String(payment.lot_project_payment_type??payment.paymentTypeValue??payment.paymentType??payment.type??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  return ['downpayment','down payment','monthly amortization','monthly','advance payment','advance','full payment','full'].includes(type);
}
