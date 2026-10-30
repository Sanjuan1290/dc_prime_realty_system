-- D&C Prime Realty / Batch 5 / 27 October 2026
-- NEW HR STAGING DATABASE ONLY. No ALTER, UPDATE or DROP on source database.
-- Stop if target DB exists; do not apply to existing Realty database.

CREATE DATABASE `dc_prime_hr_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
