-- Batch 4 — Financial Transaction Hardening
-- TiDB-compatible, rerunnable migration for an existing database.
-- This migration does NOT drop, truncate, reset, merge, or delete financial data.
--
-- Adds/ensures:
--   1) manual cash-advance deduction idempotency key
--   2) one automatic deduction per cash advance per payroll row
--   3) one release row per commission + release stage
--
-- IMPORTANT:
-- The duplicate-check SELECT statements below should return zero rows.
-- If either returns rows, review the historical financial records before
-- continuing. The UNIQUE index creation is intentionally allowed to fail when
-- duplicate financial history exists instead of deleting/merging it silently.

-- 1) Manual cash-advance deduction idempotency.
ALTER TABLE employee_cash_advance_deductions
  ADD COLUMN IF NOT EXISTS request_key VARCHAR(80) NULL AFTER notes;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_cash_advance_request_key
  ON employee_cash_advance_deductions (employee_cash_advance_id, request_key);

-- 2) Preflight for duplicate automatic payroll deductions.
SELECT
  employee_cash_advance_id,
  employee_payroll_id,
  COUNT(*) AS duplicate_count
FROM employee_cash_advance_deductions
WHERE employee_payroll_id IS NOT NULL
GROUP BY employee_cash_advance_id, employee_payroll_id
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_cash_advance_payroll_deduction
  ON employee_cash_advance_deductions (employee_cash_advance_id, employee_payroll_id);

-- 3) Preflight for duplicate commission release stages.
SELECT
  lot_project_commission_id,
  release_stage,
  COUNT(*) AS duplicate_count
FROM lot_project_commission_releases
GROUP BY lot_project_commission_id, release_stage
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_release_stage
  ON lot_project_commission_releases (lot_project_commission_id, release_stage);

-- Verification: these queries should each return one row when the migration
-- has been applied successfully.
SELECT index_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'employee_cash_advance_deductions'
  AND index_name = 'uq_employee_cash_advance_request_key'
GROUP BY index_name;

SELECT index_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'employee_cash_advance_deductions'
  AND index_name = 'uq_employee_cash_advance_payroll_deduction'
GROUP BY index_name;

SELECT index_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'lot_project_commission_releases'
  AND index_name = 'uq_commission_release_stage'
GROUP BY index_name;