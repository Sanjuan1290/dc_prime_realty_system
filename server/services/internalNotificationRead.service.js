// Mark every currently visible unread notification for one account, not merely
// the first inbox page (which is capped at 100). The visibility SQL is the same
// rule used to list messages and compute the unread counter. This intentionally
// does not write operational_reviews, audit_cases, or any audit event.
//
// Select ids before updating: avoids the TiDB/MySQL UPDATE...JOIN compatibility
// issues and avoids updating the same table selected from in a subquery.
export const markVisibleInternalNotificationsRead = async (connection, actorId, visibility, batchSize = 300) => {
  const id = Number(actorId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('An authenticated user is required.');
  if (!visibility || typeof visibility.join !== 'string' || typeof visibility.sql !== 'string' || !Array.isArray(visibility.params)) {
    throw new Error('Notification visibility is required.');
  }
  const [rows] = await connection.query(
    `SELECT n.internal_notification_id FROM internal_notifications n ${visibility.join} WHERE n.user_id=? AND n.read_at IS NULL AND ${visibility.sql}`,
    [id, ...visibility.params],
  );
  const ids = [...new Set(rows.map((row) => Number(row.internal_notification_id)).filter((value) => Number.isSafeInteger(value) && value > 0))];
  let markedCount = 0;
  const chunkSize = Math.max(1, Math.min(500, Math.trunc(batchSize) || 300));
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const [result] = await connection.query(
      `UPDATE internal_notifications SET read_at=NOW() WHERE user_id=? AND read_at IS NULL AND internal_notification_id IN (${placeholders})`,
      [id, ...chunk],
    );
    markedCount += Number(result.affectedRows || 0);
  }
  return markedCount;
};
