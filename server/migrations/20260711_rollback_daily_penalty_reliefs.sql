-- Roll back the daily penalty and penalty-relief feature.
-- Back up the database before running this file.

DROP TABLE IF EXISTS lot_project_penalty_reliefs;

ALTER TABLE lot_project_payment_schedules
  DROP COLUMN penalty_calculated_through,
  DROP COLUMN waived_penalty_amount,
  DROP COLUMN calculated_penalty_amount;

ALTER TABLE lot_project_client_profiles
  DROP COLUMN soa_penalty_calculation_method;
