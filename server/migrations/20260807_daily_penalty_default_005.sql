-- 2026-08-07 — New reservation daily penalty default
-- New reservations use 0.05% per overdue day by default.
-- Historical buyer profiles are intentionally not rewritten.

ALTER TABLE lot_project_client_profiles
  MODIFY COLUMN soa_penalty_rate_percent DECIMAL(5,2) NOT NULL DEFAULT '0.05';

ALTER TABLE lot_project_settings
  MODIFY COLUMN default_penalty_rate_percent DECIMAL(5,2) NOT NULL DEFAULT '0.05';
