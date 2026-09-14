-- 2026-08-18 — Backfill historical "Contacted" payment-notification actions into Audit Logs.
-- Future Contacted clicks are written to audit_logs directly by notifications.controller.js.
-- This migration makes existing contacted notification-log rows visible in Audit Logs too.

USE `dc_prime_realty_system_db`;

INSERT INTO audit_logs (
  actor_user_id,
  actor_name,
  actor_email,
  actor_role,
  action,
  module,
  entity_type,
  entity_id,
  entity_label,
  title,
  description,
  metadata_json,
  ip_address,
  user_agent,
  audit_log_created_at
)
SELECT
  notification_log.sent_by_user_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', actor.first_name, actor.middle_name, actor.last_name)), ''),
    actor.email,
    'System'
  ) AS actor_name,
  actor.email AS actor_email,
  actor.role AS actor_role,
  'update' AS action,
  'Notifications' AS module,
  'lot_project_notification_log' AS entity_type,
  CAST(notification_log.notification_log_id AS CHAR) AS entity_id,
  CONCAT(
    COALESCE(project.lot_project_name, 'Project'),
    ' ',
    COALESCE(listing.lot_project_listing_unit_id, 'Unit'),
    ' — ',
    COALESCE(profile.buyer_full_name, 'Buyer')
  ) AS entity_label,
  'Marked payment notification as contacted' AS title,
  CONCAT(
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ', actor.first_name, actor.middle_name, actor.last_name)), ''),
      actor.email,
      'A user'
    ),
    ' marked the ',
    REPLACE(notification_log.notification_type, '_', ' '),
    ' payment notification as contacted for ',
    COALESCE(profile.buyer_full_name, 'the buyer'),
    ' on ',
    COALESCE(project.lot_project_name, 'the project'),
    ' ',
    COALESCE(listing.lot_project_listing_unit_id, 'the unit'),
    '.'
  ) AS description,
  JSON_OBJECT(
    'notificationLogId', notification_log.notification_log_id,
    'paymentScheduleId', notification_log.lot_project_payment_schedule_id,
    'projectId', notification_log.lot_project_id,
    'listingId', notification_log.lot_project_listing_id,
    'clientProfileId', notification_log.lot_project_client_profile_id,
    'accountId', notification_log.lot_project_account_id,
    'notificationType', notification_log.notification_type,
    'buyerEmail', notification_log.recipient_email,
    'backfilled', TRUE
  ) AS metadata_json,
  NULL AS ip_address,
  NULL AS user_agent,
  COALESCE(notification_log.sent_at, notification_log.created_at, NOW()) AS audit_log_created_at
FROM lot_project_notification_logs notification_log
LEFT JOIN users actor
  ON actor.id = notification_log.sent_by_user_id
LEFT JOIN lot_projects project
  ON project.lot_project_id = notification_log.lot_project_id
LEFT JOIN lot_project_listings listing
  ON listing.lot_project_listing_id = notification_log.lot_project_listing_id
LEFT JOIN lot_project_client_profiles profile
  ON profile.lot_project_client_profile_id = notification_log.lot_project_client_profile_id
LEFT JOIN audit_logs existing_audit
  ON existing_audit.module = 'Notifications'
 AND existing_audit.entity_type = 'lot_project_notification_log'
 AND existing_audit.entity_id = CAST(notification_log.notification_log_id AS CHAR)
 AND existing_audit.title = 'Marked payment notification as contacted'
WHERE notification_log.send_status = 'contacted'
  AND existing_audit.audit_log_id IS NULL;

SELECT ROW_COUNT() AS contacted_audit_rows_backfilled;
