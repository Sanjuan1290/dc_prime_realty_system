-- Administrative reservation corrections are deliberately kept separate from
-- cancellation/account history. They preserve the business audit trail while
-- allowing a genuinely mis-keyed unit to be corrected without manufacturing a
-- cancellation, refund, or discontinued sale.

CREATE TABLE IF NOT EXISTS lot_project_reservation_corrections (
  lot_project_reservation_correction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_reservation_history_id BIGINT UNSIGNED NULL,
  source_listing_id INT UNSIGNED NOT NULL,
  source_unit_id_snapshot VARCHAR(50) NOT NULL,
  destination_listing_id INT UNSIGNED NOT NULL,
  destination_unit_id_snapshot VARCHAR(50) NOT NULL,
  account_reference_snapshot VARCHAR(80) NULL,
  buyer_name_snapshot VARCHAR(255) NULL,
  before_snapshot JSON NOT NULL,
  after_snapshot JSON NOT NULL,
  correction_reason VARCHAR(500) NOT NULL,
  corrected_by_user_id INT UNSIGNED NULL,
  corrected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_reservation_correction_id),
  KEY idx_reservation_correction_project (lot_project_id, corrected_at),
  KEY idx_reservation_correction_account (lot_project_account_id, corrected_at),
  KEY idx_reservation_correction_source (source_listing_id, corrected_at),
  KEY idx_reservation_correction_destination (destination_listing_id, corrected_at),
  CONSTRAINT fk_reservation_correction_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_history
    FOREIGN KEY (lot_project_reservation_history_id) REFERENCES lot_project_reservation_history (lot_project_reservation_history_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_source_listing
    FOREIGN KEY (source_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_destination_listing
    FOREIGN KEY (destination_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_correction_user
    FOREIGN KEY (corrected_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
