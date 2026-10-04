-- D&C Prime Realty — Approval/Audit Redesign
-- Batch 2 of 4: operational reviews, immutable events, and internal notifications.
-- Prerequisite: 20261004_batch1_staff_head_auditor_rbac.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS operational_reviews (
  operational_review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_number VARCHAR(40) NULL,
  action_key VARCHAR(120) NOT NULL,
  department ENUM('marketing','sales','accounting','operations','system') NOT NULL,
  lot_project_id INT UNSIGNED NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  entity_label VARCHAR(255) NULL,
  initiated_by_user_id INT UNSIGNED NOT NULL,
  initiated_by_role VARCHAR(80) NOT NULL,
  before_snapshot_json JSON NULL,
  after_snapshot_json JSON NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM(
    'pending_head_review','returned_for_correction','pending_auditor_review',
    'auditor_verified','audit_case_open','correction_required',
    'pending_auditor_recheck','closed'
  ) NOT NULL DEFAULT 'pending_head_review',
  claimed_by_user_id INT UNSIGNED NULL,
  claimed_at DATETIME NULL,
  head_reviewed_by_user_id INT UNSIGNED NULL,
  head_reviewed_at DATETIME NULL,
  auditor_reviewed_by_user_id INT UNSIGNED NULL,
  auditor_reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (operational_review_id),
  UNIQUE KEY uq_operational_review_number (review_number),
  KEY idx_operational_review_queue (department,status,lot_project_id,created_at),
  KEY idx_operational_review_entity (entity_type,entity_id,status),
  KEY idx_operational_review_initiator (initiated_by_user_id,created_at),
  KEY idx_operational_review_project (lot_project_id,status),
  CONSTRAINT fk_operational_review_project FOREIGN KEY (lot_project_id) REFERENCES lot_projects(lot_project_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_operational_review_initiator FOREIGN KEY (initiated_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_operational_review_claimed_by FOREIGN KEY (claimed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_operational_review_head FOREIGN KEY (head_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_operational_review_auditor FOREIGN KEY (auditor_reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS operational_review_events (
  operational_review_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operational_review_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  from_status VARCHAR(60) NULL,
  to_status VARCHAR(60) NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_role VARCHAR(80) NULL,
  message TEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operational_review_event_id),
  KEY idx_operational_review_event_review (operational_review_id,created_at),
  KEY idx_operational_review_event_actor (actor_user_id,created_at),
  CONSTRAINT fk_operational_review_event_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_operational_review_event_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS internal_notifications (
  internal_notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  link VARCHAR(500) NULL,
  operational_review_id BIGINT UNSIGNED NULL,
  audit_case_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (internal_notification_id),
  KEY idx_internal_notification_user (user_id,read_at,created_at),
  KEY idx_internal_notification_review (operational_review_id,created_at),
  CONSTRAINT fk_internal_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_internal_notification_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
