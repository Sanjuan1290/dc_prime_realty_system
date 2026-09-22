-- TiDB-compatible migration: adds an exact-amount option for reservation downpayments.
-- Existing reservations continue to use percentage mode.
-- Safe to run more than once because TiDB supports ADD COLUMN IF NOT EXISTS.
-- Run these as ordinary ALTER TABLE statements. Do not use DELIMITER or stored procedures.

ALTER TABLE `lot_project_client_profiles`
  ADD COLUMN IF NOT EXISTS `soa_downpayment_input_mode`
    ENUM('percentage','amount') NOT NULL DEFAULT 'percentage'
    AFTER `soa_downpayment_percentage`;

ALTER TABLE `lot_project_client_profiles`
  ADD COLUMN IF NOT EXISTS `soa_downpayment_amount`
    DECIMAL(14,2) NULL
    AFTER `soa_downpayment_input_mode`;
