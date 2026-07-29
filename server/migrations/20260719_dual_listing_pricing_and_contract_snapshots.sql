-- Dual cash/installment listing prices plus immutable reservation pricing snapshots.
-- Run this once against the same MySQL database used by server/.env.

ALTER TABLE lot_project_listings
  ADD COLUMN lot_project_listing_installment_price_per_sqm DECIMAL(12,2) NULL
    AFTER lot_project_listing_price_per_sqm,
  ADD COLUMN lot_project_listing_cash_price_per_sqm DECIMAL(12,2) NULL
    AFTER lot_project_listing_installment_price_per_sqm;

UPDATE lot_project_listings
SET
  lot_project_listing_installment_price_per_sqm = COALESCE(
    lot_project_listing_installment_price_per_sqm,
    lot_project_listing_price_per_sqm
  ),
  lot_project_listing_cash_price_per_sqm = COALESCE(
    lot_project_listing_cash_price_per_sqm,
    lot_project_listing_price_per_sqm
  );

ALTER TABLE lot_project_client_profiles
  ADD COLUMN soa_selected_price_per_sqm DECIMAL(12,2) NULL
    AFTER soa_mode_of_payment,
  ADD COLUMN soa_selected_base_selling_price DECIMAL(14,2) NULL
    AFTER soa_selected_price_per_sqm,
  ADD COLUMN soa_sale_discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00
    AFTER soa_selected_base_selling_price,
  ADD COLUMN soa_sale_discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER soa_sale_discount_percentage,
  ADD COLUMN soa_selected_net_selling_price DECIMAL(14,2) NULL
    AFTER soa_sale_discount_amount,
  ADD COLUMN soa_selected_lmf_amount DECIMAL(14,2) NULL
    AFTER soa_selected_net_selling_price,
  ADD COLUMN soa_selected_tcp DECIMAL(14,2) NULL
    AFTER soa_selected_lmf_amount,
  ADD CONSTRAINT chk_client_sale_discount_percentage
    CHECK (soa_sale_discount_percentage BETWEEN 0 AND 100);

-- Preserve every existing reservation using the contract values that were
-- already stored before this migration. Existing DP discounts remain DP-only.
UPDATE lot_project_client_profiles profile
INNER JOIN lot_project_listings listing
  ON listing.lot_project_listing_id = profile.lot_project_listing_id
SET
  profile.soa_selected_price_per_sqm = COALESCE(
    profile.soa_selected_price_per_sqm,
    listing.lot_project_listing_price_per_sqm
  ),
  profile.soa_selected_base_selling_price = COALESCE(
    profile.soa_selected_base_selling_price,
    listing.lot_project_listing_net_selling_price
  ),
  profile.soa_sale_discount_percentage = 0.00,
  profile.soa_sale_discount_amount = 0.00,
  profile.soa_selected_net_selling_price = COALESCE(
    profile.soa_selected_net_selling_price,
    listing.lot_project_listing_net_selling_price
  ),
  profile.soa_selected_lmf_amount = COALESCE(
    profile.soa_selected_lmf_amount,
    listing.lot_project_listing_lmf_amount
  ),
  profile.soa_selected_tcp = COALESCE(
    profile.soa_selected_tcp,
    listing.lot_project_listing_tcp
  );

ALTER TABLE lot_project_reservation_history
  ADD COLUMN pricing_mode_snapshot ENUM('cash','installment') NULL
    AFTER reserved_at,
  ADD COLUMN price_per_sqm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00
    AFTER pricing_mode_snapshot,
  ADD COLUMN base_selling_price_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER price_per_sqm_snapshot,
  ADD COLUMN net_selling_price_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER base_selling_price_snapshot,
  ADD COLUMN lmf_amount_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER net_selling_price_snapshot,
  ADD COLUMN sale_discount_percentage_snapshot DECIMAL(5,2) NOT NULL DEFAULT 0.00
    AFTER lmf_amount_snapshot,
  ADD COLUMN sale_discount_amount_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER sale_discount_percentage_snapshot,
  ADD COLUMN dp_discount_percentage_snapshot DECIMAL(5,2) NOT NULL DEFAULT 0.00
    AFTER sale_discount_amount_snapshot,
  ADD COLUMN dp_discount_amount_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00
    AFTER dp_discount_percentage_snapshot;

-- Move the old generic discount snapshot into its correct meaning. Before this
-- update, that field was populated from the DP discount percentage but used TCP
-- as its amount base. New generic discount fields now mean sale discount only.
UPDATE lot_project_reservation_history history
INNER JOIN lot_project_listings listing
  ON listing.lot_project_listing_id = history.lot_project_listing_id
LEFT JOIN lot_project_client_profiles profile
  ON profile.lot_project_client_profile_id = history.lot_project_client_profile_id
SET
  history.pricing_mode_snapshot = COALESCE(profile.soa_mode_of_payment, 'installment'),
  history.price_per_sqm_snapshot = COALESCE(profile.soa_selected_price_per_sqm, listing.lot_project_listing_price_per_sqm, 0),
  history.base_selling_price_snapshot = COALESCE(profile.soa_selected_base_selling_price, listing.lot_project_listing_net_selling_price, 0),
  history.net_selling_price_snapshot = COALESCE(profile.soa_selected_net_selling_price, listing.lot_project_listing_net_selling_price, 0),
  history.lmf_amount_snapshot = COALESCE(profile.soa_selected_lmf_amount, listing.lot_project_listing_lmf_amount, 0),
  history.sale_discount_percentage_snapshot = COALESCE(profile.soa_sale_discount_percentage, 0),
  history.sale_discount_amount_snapshot = COALESCE(profile.soa_sale_discount_amount, 0),
  history.dp_discount_percentage_snapshot = COALESCE(profile.soa_dp_discount_percentage, history.discount_percentage_snapshot, 0),
  history.dp_discount_amount_snapshot = ROUND(
    GREATEST(
      (
        (CASE
          WHEN COALESCE(profile.soa_legal_misc_fee_mode, 'include_in_monthly') = 'separate_soa_row'
            THEN GREATEST(COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0)
              - COALESCE(profile.soa_selected_lmf_amount, listing.lot_project_listing_lmf_amount, 0), 0)
          ELSE COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0)
        END) * (COALESCE(profile.soa_downpayment_percentage, 0) / 100)
      )
      - CASE
          WHEN COALESCE(profile.soa_reservation_fee_applied_to_downpayment, 0) = 1
            THEN LEAST(
              COALESCE(profile.soa_reservation_fee, listing.lot_project_listing_reservation_fee, 0),
              (CASE
                WHEN COALESCE(profile.soa_legal_misc_fee_mode, 'include_in_monthly') = 'separate_soa_row'
                  THEN GREATEST(COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0)
                    - COALESCE(profile.soa_selected_lmf_amount, listing.lot_project_listing_lmf_amount, 0), 0)
                ELSE COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp, 0)
              END) * (COALESCE(profile.soa_downpayment_percentage, 0) / 100)
            )
          ELSE 0
        END,
      0
    ) * (COALESCE(profile.soa_dp_discount_percentage, history.discount_percentage_snapshot, 0) / 100),
    2
  ),
  history.discount_percentage_snapshot = COALESCE(profile.soa_sale_discount_percentage, 0),
  history.discount_applied_snapshot = COALESCE(profile.soa_sale_discount_amount, 0);
