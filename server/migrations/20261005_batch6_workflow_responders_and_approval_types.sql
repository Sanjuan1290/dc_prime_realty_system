-- D&C Prime Realty
-- 2026-10-05 Batch 6: review workflow fixes (plan items 15-23).
-- TiDB-safe / idempotent. Apply after 20261005_batch5_broker_name_and_company_profit_cap.sql.
--
-- 1. operational_reviews.approval_type records how a review reached the Auditor:
--      staff_entry | head_self | head_preapproved | head_confirmed | head_corrected | emergency_super_admin
--    Super Admin emergency changes are no longer recorded as a Head approval,
--    so Audit Cases on them are answered by Super Admin instead of getting stuck.
-- 2. audit_cases.assigned_responder_user_id lets System Admin reassign who must
--    answer a case when the original Head left or lost project access.
-- 3. Backfill: existing Super Admin reviews are re-labelled as emergency changes
--    and their fake "Head reviewer" (the Super Admin) is cleared. This un-sticks
--    any open Audit Case on them. Existing Head self-entries are labelled head_self.

ALTER TABLE operational_reviews
  ADD COLUMN IF NOT EXISTS approval_type VARCHAR(40) NULL AFTER status;

ALTER TABLE audit_cases
  ADD COLUMN IF NOT EXISTS assigned_responder_user_id INT UNSIGNED NULL AFTER opened_by_auditor_user_id;
ALTER TABLE audit_cases
  ADD COLUMN IF NOT EXISTS responder_reassigned_by_user_id INT UNSIGNED NULL AFTER assigned_responder_user_id;
ALTER TABLE audit_cases
  ADD COLUMN IF NOT EXISTS responder_reassigned_at DATETIME NULL AFTER responder_reassigned_by_user_id;

CREATE INDEX IF NOT EXISTS idx_audit_case_assigned_responder ON audit_cases (assigned_responder_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_case_reassigned_by ON audit_cases (responder_reassigned_by_user_id);

-- Foreign keys are added once; re-running fails harmlessly with a duplicate-name
-- error on these two statements only, which can be ignored.
ALTER TABLE audit_cases
  ADD CONSTRAINT fk_audit_case_assigned_responder FOREIGN KEY (assigned_responder_user_id)
  REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE audit_cases
  ADD CONSTRAINT fk_audit_case_reassigned_by FOREIGN KEY (responder_reassigned_by_user_id)
  REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill
UPDATE operational_reviews
SET approval_type = 'emergency_super_admin',
    head_reviewed_by_user_id = NULL,
    head_reviewed_at = NULL
WHERE initiated_by_role = 'super_admin'
  AND approval_type IS NULL;

UPDATE operational_reviews
SET approval_type = 'head_self'
WHERE approval_type IS NULL
  AND initiated_by_role IN ('marketing_head','sales_head','accounting_head','operations_head')
  AND head_reviewed_by_user_id = initiated_by_user_id;
