# Seller Income Range Report

## Added feature

The **Print Proof of Income** modal now has two connected modes:

1. **Single Receipt** — keeps the existing released-stage receipt flow.
2. **Income Range Report** — loads every released commission income entry for a selected date range and prints the full list in one PDF/print job.

The default range is the last 12 months. Quick ranges are available for the current month, current year, and last 12 months.

## Income basis

The report uses `lot_project_commission_releases.actual_release_date` and includes only rows with `release_status = 'Released'`.

Each row includes:

- Release date
- Project and unit
- Buyer
- Direct or override commission type
- Seller role and commission rate
- Release stage and release percentage
- Gross release amount
- Deductions
- Net income
- Existing receipt reference, when present

For a non-agent using a system direct-sales agent, the owner receives the dummy agent's direct income in the report. The owner also receives their own override rows. Parent override rows are not incorrectly assigned to the dummy owner.

## API

```text
GET /api/v1/accredited/:sellerId/income-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

The API returns the seller identity, validated range, summary totals, monthly totals, individual released entries, and report generation time.

Date ranges are inclusive and limited to 10 years.

## Print page

```text
/super_admin/accredited/proof-of-income/range/print
```

The report prints on A4 landscape pages. Long reports are split into multiple pages with page numbers and final totals. The browser print dialog supports printing or saving as PDF.

## Database

No database migration is required. The current schema already contains the release, commission-rate-type, sale-owner, and receipt fields used by the report.

## Validation completed

- 90 server tests passed.
- New income-range tests passed.
- Changed server files passed syntax checks.
- Changed client files passed ESLint.
- Vite production build passed.
- The current database dump contains every table and column used by the report.
