-- 2026-08-19 — External Realty agent receipt status and next-release hold control.
--
-- This does NOT store a receipt file. It stores only whether the External Realty
-- has reported the released agent commission receipt as Submitted or Unsubmitted.
--
-- Business rule:
-- 1. Every newly released External Group milestone starts as Unsubmitted.
-- 2. If the immediately following unreleased milestone becomes eligible while
--    the previous released milestone is still Unsubmitted, that next milestone
--    is automatically placed On Hold.
-- 3. Marking the previous receipt Submitted automatically re-evaluates only a
--    hold created by this receipt rule. Independent/manual holds stay intact.
-- 4. Already released financial history is never reversed or recalculated.

USE `dc_prime_realty_system_db`;

ALTER TABLE lot_project_commission_releases
  ADD COLUMN external_agent_receipt_status ENUM('unsubmitted','submitted') NULL AFTER historical_release_note,
  ADD COLUMN external_receipt_hold_source_release_id INT UNSIGNED NULL AFTER external_agent_receipt_status,
  ADD INDEX idx_commission_release_external_receipt_status (external_agent_receipt_status),
  ADD INDEX idx_commission_release_receipt_hold_source (external_receipt_hold_source_release_id);

-- Existing released External Group milestones start conservatively as
-- Unsubmitted so admins can explicitly mark the known submitted receipts.
UPDATE lot_project_commission_releases release_row
INNER JOIN lot_project_commissions commission
  ON commission.lot_project_commission_id = release_row.lot_project_commission_id
SET release_row.external_agent_receipt_status = 'unsubmitted'
WHERE commission.commission_role = 'external_group'
  AND release_row.release_status = 'Released'
  AND release_row.external_agent_receipt_status IS NULL;

-- Preserve the simple Submitted/Unsubmitted assurance status if a buyer account
-- is later copied into the immutable cancelled-sale financial archive.
ALTER TABLE lot_project_archived_commission_releases
  ADD COLUMN external_agent_receipt_status VARCHAR(20) NULL AFTER historical_release_note;

-- Verification: External Group released rows should now be either Submitted or
-- Unsubmitted. Unreleased rows and in-house commission rows may remain NULL.
SELECT
  commission.lot_project_commission_id,
  commission.commission_role,
  release_row.lot_project_commission_release_id,
  release_row.release_stage,
  release_row.release_status,
  release_row.external_agent_receipt_status,
  release_row.external_receipt_hold_source_release_id
FROM lot_project_commission_releases release_row
INNER JOIN lot_project_commissions commission
  ON commission.lot_project_commission_id = release_row.lot_project_commission_id
WHERE commission.commission_role = 'external_group'
ORDER BY commission.lot_project_commission_id DESC,
         FIELD(release_row.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention');
