-- TiDB read-only verification for the exact downpayment amount feature.
-- This script does not modify data and does not use DELIMITER or stored procedures.

-- Expected result: exactly two rows.
SELECT
  column_name,
  column_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'lot_project_client_profiles'
  AND column_name IN (
    'soa_downpayment_input_mode',
    'soa_downpayment_amount'
  )
ORDER BY column_name;

-- Review how existing buyer accounts are distributed between percentage and amount modes.
SELECT
  soa_downpayment_input_mode,
  COUNT(*) AS account_count
FROM lot_project_client_profiles
GROUP BY soa_downpayment_input_mode
ORDER BY soa_downpayment_input_mode;

-- Expected result: zero rows.
-- Finds invalid percentage or exact-amount records.
SELECT
  lot_project_client_profile_id,
  lot_project_id,
  lot_project_listing_id,
  soa_downpayment_input_mode,
  soa_downpayment_percentage,
  soa_downpayment_amount,
  soa_selected_tcp,
  soa_legal_misc_fee_mode,
  soa_legal_misc_fee_amount
FROM lot_project_client_profiles
WHERE
  soa_downpayment_input_mode NOT IN ('percentage', 'amount')
  OR (
    soa_downpayment_input_mode = 'percentage'
    AND (
      soa_downpayment_percentage IS NULL
      OR soa_downpayment_percentage < 0
      OR soa_downpayment_percentage > 100
    )
  )
  OR (
    soa_downpayment_input_mode = 'amount'
    AND (
      soa_downpayment_amount IS NULL
      OR soa_downpayment_amount < 0
      OR soa_selected_tcp IS NULL
      OR soa_downpayment_amount > GREATEST(
        soa_selected_tcp - CASE
          WHEN soa_legal_misc_fee_mode = 'separate_soa_row'
            THEN COALESCE(soa_legal_misc_fee_amount, 0)
          ELSE 0
        END,
        0
      )
    )
  );
