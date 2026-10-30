# After Batch 16 preparation — Required engineering work to earn a deletion approval

**Do not treat Batch 16 preparation as system separation completion.** Complete these workstreams in reviewed PRs, then repeat Batch 15 acceptance against an actual staging deployment.

| Sequence | Workstream | Acceptance example |
|---|---|---|
| R1 | Current repository + backup baseline | Pinned commit, all assets, clean build and restorable TiDB copy |
| R2 | HR staging schema/data | HR 17-table counts, identities, settings and receipts reconcile |
| R3 | HR standalone API, kiosk, authentication | End-to-end attendance, payroll, release, permissions, protected files |
| R4 | Salary releases, corrections, cash advances | HR outbox and Realty inbox reconcile; changed salary gets approved reversal/correction |
| R5 | Seller Network dependency | Import and undo tested with legacy employees table unavailable |
| R6 | Independent public website | Buyer forms reach Realty, site builds with complete binary assets |
| R7 | Independent Finance ledger/import | Real XLSX/ZIP transfer, dedupe, corrections, grants, signed amount parity |
| R8 | Actual staging cutover and roll-forward/rollback | Exactly one writer and scheduler; no missing financial or audit history |
| R9 | Observation and retention signoff | No remaining active HR consumers in Realty; per-table approved destruction inventory |
| R10 | Separately reviewed destructive migration | Versioned DB migration tested in staging and restoration rehearsed; post-cutover finance/SOA/commissions tests pass |

For R5, the existing `network_member_import_items.linked_employee_ids_json` history should remain readable even when employee IDs belong to HR. For R4, avoid treating a payroll correction as a second new salary expense.

A change to the old database must never run only because a static test has passed. The deletion plan must be based on the schema actually deployed at execution time, including active foreign-key validity and consumers outside the code repository (scheduled integrations, BI exports, manual reports).
