// Capture labels only when a new operation is saved. Historical revisions keep
// their original evidence; an old number stays an ID.
export const capturePaymentSchedule = async (connection, snapshot, projectId) => {
  if (!snapshot || !Number(snapshot.scheduleId) || !Number(projectId)) return snapshot;
  const [rows] = await connection.query(`SELECT description,due_date FROM lot_project_payment_schedules
    WHERE lot_project_payment_schedule_id=? AND lot_project_id=? LIMIT 1`, [Number(snapshot.scheduleId),Number(projectId)]);
  const row = rows[0];
  if (!row) return snapshot;
  return { ...snapshot, scheduleDescription: row.description || null,
    scheduleDueDate: row.due_date instanceof Date ? row.due_date.toISOString().slice(0,10) : row.due_date ? String(row.due_date).slice(0,10) : null };
};
