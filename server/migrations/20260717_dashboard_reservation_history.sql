CREATE TABLE IF NOT EXISTS lot_project_reservation_history (
  lot_project_reservation_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  buyer_name_snapshot VARCHAR(255) NULL,
  reservation_status ENUM('active','pending_for_cancellation','cancelled') NOT NULL DEFAULT 'active',
  reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tcp_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount_percentage_snapshot DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  discount_applied_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cancelled_at DATETIME NULL,
  cancellation_type ENUM('refunded','discontinued') NULL,
  cancellation_reason TEXT NULL,
  cancelled_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cash_collected_at_cancellation DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by_user_id INT UNSIGNED NULL,
  cancelled_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_reservation_history_id),
  KEY idx_reservation_history_project_reserved (lot_project_id, reserved_at),
  KEY idx_reservation_history_project_cancelled (lot_project_id, cancelled_at),
  KEY idx_reservation_history_listing_status (lot_project_listing_id, reservation_status),
  CONSTRAINT fk_reservation_history_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_history_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_history_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_history_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reservation_history_cancelled_by
    FOREIGN KEY (cancelled_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill one historical reservation for each currently reserved/cancelled unit.
-- New reservations create a new row, so re-reservations remain separate events.
INSERT INTO lot_project_reservation_history (
  lot_project_id,
  lot_project_listing_id,
  lot_project_client_profile_id,
  unit_id_snapshot,
  buyer_name_snapshot,
  reservation_status,
  reserved_at,
  tcp_snapshot,
  discount_percentage_snapshot,
  cancelled_at,
  cancellation_type,
  cancelled_value,
  cash_collected_at_cancellation
)
SELECT
  l.lot_project_id,
  l.lot_project_listing_id,
  cp.lot_project_client_profile_id,
  l.lot_project_listing_unit_id,
  cp.buyer_full_name,
  CASE
    WHEN l.lot_project_listing_status = 'cancelled' THEN 'cancelled'
    WHEN l.lot_project_listing_status = 'pending_for_cancellation' THEN 'pending_for_cancellation'
    ELSE 'active'
  END,
  COALESCE(cp.lot_project_client_profile_created_at, l.lot_project_listing_created_at),
  l.lot_project_listing_tcp,
  COALESCE(cp.soa_dp_discount_percentage, 0),
  CASE WHEN l.lot_project_listing_status = 'cancelled' THEN l.lot_project_listing_updated_at ELSE NULL END,
  l.lot_project_listing_cancellation_type,
  CASE WHEN l.lot_project_listing_status = 'cancelled' THEN l.lot_project_listing_tcp ELSE 0 END,
  CASE
    WHEN l.lot_project_listing_status = 'cancelled' THEN COALESCE((
      SELECT SUM(p.lot_project_payment_amount)
      FROM lot_project_payments p
      WHERE p.lot_project_listing_id = l.lot_project_listing_id
        AND p.lot_project_payment_status = 'Verified'
    ), 0)
    ELSE 0
  END
FROM lot_project_listings l
LEFT JOIN lot_project_client_profiles cp
  ON cp.lot_project_listing_id = l.lot_project_listing_id
WHERE l.lot_project_listing_status IN ('sold', 'pending_for_cancellation', 'cancelled')
  AND NOT EXISTS (
    SELECT 1
    FROM lot_project_reservation_history rh
    WHERE rh.lot_project_listing_id = l.lot_project_listing_id
  );
