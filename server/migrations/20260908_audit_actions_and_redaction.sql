-- Adds explicit business-event actions used by the September 2026 reporting,
-- listing-import, and administrative reservation-correction features.
-- Secret redaction is enforced in application code before metadata is persisted.

ALTER TABLE audit_logs
  MODIFY COLUMN action ENUM(
    'create','update','delete','login','logout','send','approve','reject','release',
    'system','view','import','export','correct'
  ) NOT NULL DEFAULT 'system';

-- The archive table is created by 20260715_audit_log_archival.sql and stores the
-- action as VARCHAR(40), so no archive-schema ALTER is required here.
