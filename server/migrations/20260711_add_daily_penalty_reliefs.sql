-- Daily penalty terms are stored per buyer reservation.
-- Project-level default penalty columns remain for backward compatibility but are no longer used by the UI/API.

ALTER TABLE lot_project_client_profiles
  ADD COLUMN soa_penalty_calculation_method ENUM('none','monthly_started','daily') NOT NULL DEFAULT 'none'
    AFTER soa_penalty_grace_days;

UPDATE lot_project_client_profiles
SET soa_penalty_calculation_method = CASE
  WHEN COALESCE(soa_penalty_rate_percent, 0) > 0 THEN 'monthly_started'
  ELSE 'none'
END;

ALTER TABLE lot_project_payment_schedules
  ADD COLUMN calculated_penalty_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER penalty_amount,
  ADD COLUMN waived_penalty_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER calculated_penalty_amount,
  ADD COLUMN penalty_calculated_through DATE NULL AFTER waived_penalty_amount;

UPDATE lot_project_payment_schedules
SET calculated_penalty_amount = penalty_amount,
    waived_penalty_amount = 0.00
WHERE penalty_amount > 0;

CREATE TABLE lot_project_penalty_reliefs (
  penalty_relief_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_payment_schedule_id INT UNSIGNED NOT NULL,
  relief_type ENUM('penalty_free_extension','full_waiver','partial_waiver','restoration') NOT NULL,
  promised_payment_date DATE NULL,
  relief_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  restores_penalty_relief_id INT UNSIGNED NULL,
  status ENUM('active','honored','partially_honored','broken','expired','cancelled','restored') NOT NULL DEFAULT 'active',
  reason VARCHAR(255) NOT NULL,
  internal_notes TEXT NULL,
  approved_by_user_id INT UNSIGNED NOT NULL,
  honored_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (penalty_relief_id),
  KEY idx_penalty_relief_schedule (lot_project_payment_schedule_id),
  KEY idx_penalty_relief_listing (lot_project_listing_id),
  KEY idx_penalty_relief_status (status),
  KEY idx_penalty_relief_restores (restores_penalty_relief_id),
  CONSTRAINT fk_penalty_relief_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_penalty_relief_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_penalty_relief_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_penalty_relief_schedule
    FOREIGN KEY (lot_project_payment_schedule_id) REFERENCES lot_project_payment_schedules (lot_project_payment_schedule_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_penalty_relief_user
    FOREIGN KEY (approved_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_penalty_relief_restores
    FOREIGN KEY (restores_penalty_relief_id) REFERENCES lot_project_penalty_reliefs (penalty_relief_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_penalty_relief_amount CHECK (relief_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
