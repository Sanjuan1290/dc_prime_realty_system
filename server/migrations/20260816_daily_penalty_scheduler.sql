-- 2026-08-16 — Restart-safe once-daily penalty scheduler state
--
-- The paid Render web service stays running, so the application keeps the
-- scheduler in-process. This table makes the scheduler restart-safe and
-- prevents duplicate same-day global penalty refreshes.

CREATE TABLE IF NOT EXISTS system_scheduled_job_state (
  job_name VARCHAR(100) NOT NULL,
  last_success_date DATE NULL,
  current_run_date DATE NULL,
  status ENUM('idle','running','completed','failed') NOT NULL DEFAULT 'idle',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  lock_expires_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  last_refreshed_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_name),
  INDEX idx_scheduled_job_status (status, current_run_date),
  INDEX idx_scheduled_job_lock (lock_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO system_scheduled_job_state (
  job_name,
  status
) VALUES (
  'daily_penalty_refresh',
  'idle'
);

-- Read-only verification
SELECT
  job_name,
  last_success_date,
  current_run_date,
  status,
  started_at,
  completed_at,
  lock_expires_at,
  last_refreshed_count,
  last_error
FROM system_scheduled_job_state
WHERE job_name = 'daily_penalty_refresh';
