-- Batch 1 — Payment & SOA Safety
-- Apply to an existing database before deploying the Batch 1 application files.
-- This migration changes payment-safety structures only. It does not modify users/authentication.

ALTER TABLE lot_project_payments
  ADD COLUMN lot_project_payment_request_key VARCHAR(80) NULL AFTER lot_project_payment_reference_id;

ALTER TABLE lot_project_payments
  ADD UNIQUE KEY uq_lot_project_payment_request_key (lot_project_payment_request_key);
