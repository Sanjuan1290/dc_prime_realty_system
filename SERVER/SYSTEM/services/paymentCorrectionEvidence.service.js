// Capture allocation facts before rebuilding them in a controlled correction.
export const capturePaymentAllocationEvidence = async (connection,paymentId,projectId) => {
 const [rows]=await connection.query(`SELECT a.lot_project_payment_schedule_id,a.applied_amount,
  s.due_amount,s.interest_amount,s.discount_amount,s.penalty_amount,s.amount_paid,s.schedule_status
  FROM lot_project_payment_allocations a INNER JOIN lot_project_payment_schedules s
   ON s.lot_project_payment_schedule_id=a.lot_project_payment_schedule_id
  WHERE a.lot_project_payment_id=? AND s.lot_project_id=? ORDER BY a.lot_project_payment_allocation_id`,[paymentId,projectId]);
 return rows;
};
