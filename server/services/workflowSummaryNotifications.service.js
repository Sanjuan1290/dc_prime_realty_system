/**
 * Fail-isolated unread notification counts for the Review Center summary.
 * Primary review queues must remain available even if notification SQL fails.
 * On failure an explicit unavailable flag is returned instead of a fake zero.
 */
export const countWorkflowSummaryNotifications = async ({
  connection,
  actorId,
  visibility,
  actionTypes = [],
  onError = () => {},
}) => {
  try {
    const [notificationRows] = await connection.query(
      `SELECT COUNT(*) unread FROM internal_notifications n ${visibility.join} WHERE n.user_id=? AND n.read_at IS NULL AND ${visibility.sql}`,
      [actorId, ...visibility.params]
    );
    const unreadNotifications = Number(notificationRows?.[0]?.unread || 0);
    let unreadActionNotifications = 0;
    if (actionTypes.length) {
      const [actionNotificationRows] = await connection.query(
        `SELECT COUNT(*) unread FROM internal_notifications n ${visibility.join} WHERE n.user_id=? AND n.read_at IS NULL AND n.notification_type IN (${actionTypes.map(() => '?').join(',')}) AND ${visibility.sql}`,
        [actorId, ...actionTypes, ...visibility.params]
      );
      unreadActionNotifications = Number(actionNotificationRows?.[0]?.unread || 0);
    }
    return { unreadNotifications, unreadActionNotifications, notificationCountsAvailable: true };
  } catch (error) {
    onError(error);
    return { unreadNotifications: 0, unreadActionNotifications: 0, notificationCountsAvailable: false };
  }
};
