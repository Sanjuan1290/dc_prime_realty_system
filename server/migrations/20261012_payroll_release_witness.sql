-- Record the witness on each individual salary release acknowledgment.
-- Apply once to TiDB BEFORE deploying the payroll release backend update.
-- Non-destructive: no existing salaries, snapshots, or receipt amounts are modified.
ALTER TABLE `employee_payrolls`
  ADD COLUMN IF NOT EXISTS `release_witness_name` VARCHAR(180) NULL AFTER `release_reference`;

