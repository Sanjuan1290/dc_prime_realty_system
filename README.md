# Commission Rate Display Precision Update — 2026-10-04

This patch changes commission-related percentage displays to four decimal places without changing monetary formatting or unrelated percentages.

Examples:
- 9% -> 9.0000%
- 8% -> 8.0000%
- 4% -> 4.0000%
- 1.6% -> 1.6000%
- 1.2656% -> 1.2656%
- 1.1344% -> 1.1344%

Updated surfaces include:
- Automatic Hierarchy Commission Preview
- Seller / Network rate picker during reservation
- Saved Commission Distribution
- Commission Release Details
- Commission Release Final Double-Check
- Accredited Seller income / receipt screens
- Server-provided seller commission rate labels
- Unit commission adjustment validation / verification messages

Currency remains two decimal places. Payment progress percentages, interest rates, LMF rates, release milestones, and other non-commission percentages are unchanged.

Database migration: none required. The existing Network/Company Profit migration already stores commission rates as DECIMAL(7,4).

Validation:
- 3/3 new precision-specific tests passed.
- Reservation preview reuse + unit commission adjustment regression tests passed.
- Commission historical release tests passed.
- One separate commission recalculation test file cannot load in this reconstructed environment because bcrypt is not installed; it fails before executing assertions.
