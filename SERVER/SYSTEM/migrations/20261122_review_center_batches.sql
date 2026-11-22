-- Additive relationships only. Existing reviews, cases and snapshots are retained.
ALTER TABLE lot_project_listing_bulk_batches
 ADD COLUMN operational_review_id BIGINT UNSIGNED NULL,
 ADD COLUMN changed_field_count INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN submission_key VARCHAR(64) NULL,
 ADD UNIQUE KEY uq_listing_bulk_review (operational_review_id),
 ADD UNIQUE KEY uq_listing_bulk_submission (lot_project_id,changed_by_user_id,submission_key),
 ADD CONSTRAINT fk_listing_bulk_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT;
ALTER TABLE lot_project_listing_bulk_rows
 ADD COLUMN review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
 ADD COLUMN reviewed_by_user_id INT UNSIGNED NULL,
 ADD COLUMN reviewed_at DATETIME NULL,
 ADD COLUMN review_note TEXT NULL,
 ADD COLUMN operational_review_id BIGINT UNSIGNED NULL,
 ADD COLUMN audit_case_id BIGINT UNSIGNED NULL,
 ADD UNIQUE KEY uq_listing_bulk_row_review (operational_review_id),
 ADD UNIQUE KEY uq_listing_bulk_row_case (audit_case_id),
 ADD KEY idx_listing_bulk_review_queue (batch_id,review_status,row_id),
 ADD CONSTRAINT fk_listing_bulk_row_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_listing_bulk_row_case FOREIGN KEY (audit_case_id) REFERENCES audit_cases(audit_case_id) ON DELETE RESTRICT;
ALTER TABLE protected_change_requests MODIFY COLUMN status ENUM('pending','approved','rejected','used','expired','cancelled','returned') NOT NULL DEFAULT 'pending';
