# Post-Action Review + Correction Flow Fix

This package replaces the earlier routine-review locking behavior with the intended non-blocking post-action review and controlled-correction workflow.

## Final workflow

### Staff entry
1. Staff creates/edits the record. The business operation is saved immediately.
2. A Review is queued for the owning Department Head. Normal work may continue.
3. If the same Staff user edits the same record again before review finishes, the same Review number is refreshed to the latest saved values instead of creating stale duplicate Reviews.
4. If the Staff changes the record after the Head already confirmed but before Auditor verification, the same Review is reopened for Head check of the latest values.
5. Head may Confirm or Return for Correction.
6. Returned correction locks only the exact affected record. Original Staff uses **Correct & Resubmit**, and the same Review goes back to the Head.
7. Head may alternatively use **Correct & Confirm** and send the corrected Review directly to Auditor.
8. Auditor independently verifies the final state.

### Department Head entry
1. Head creates/edits the record and the operation saves immediately.
2. Self-review is skipped.
3. The Review goes directly to Auditor.
4. If the Head edits it again before audit, the same Review is refreshed with the latest values.

### Super Admin entry
1. Super Admin creates/edits the record and the operation saves immediately.
2. Department Head review is skipped.
3. The Review goes directly to Auditor as a Super Admin direct entry.
4. If Auditor later confirms a valid finding on a Super Admin-origin entry, the controlled correction is assigned to Super Admin, then returned to Auditor for recheck.

### System Admin
- Ordinary permitted department work follows the owning department review path.
- A normal Auditor-confirmed finding is corrected by System Admin through the exact Audit Case.
- System Admin cannot use an Audit Case for the wrong entity or a Super Admin-origin correction.

### Auditor finding
1. Auditor opens an Audit Case.
2. The exact affected record enters controlled correction mode.
3. Once the finding is confirmed valid:
   - normal origin -> System Admin controlled correction
   - Super Admin direct origin -> Super Admin controlled correction
4. Correcting administrator applies only the authorized correction.
5. Review moves to **Auditor Recheck Pending**.
6. Auditor verifies and closes, or returns the correction for more work.

## Locking rules

Routine post-action queues do NOT lock records:
- `pending_head_review`
- `pending_auditor_review`

Controlled correction states DO lock the exact affected entity:
- `returned_for_correction`
- `audit_case_open`
- `correction_required`
- `pending_auditor_recheck`

## Notifications / UI

- Creator receives a success + queued-check notification.
- Department Head receives a post-action check notification for Staff/System Admin department entries.
- Auditor receives a check notification after Head confirmation, Head direct entry, or Super Admin direct entry.
- Review Center labels routine queues as completed operations with checks pending, not as failed/incomplete transactions.
- Returned Staff correction exposes **Correct & Resubmit**.
- Audit Case UI identifies whether System Admin or Super Admin owns the controlled correction.

## Database

No SQL migration is required. This uses the existing `operational_reviews`, `operational_review_events`, `audit_cases`, and notification schema.

## Verification

Focused review/governance suite:
- 65 / 65 passed

Full reconstructed server suite:
- 817 tests total
- 800 passed
- 17 failed

The remaining 17 failures are outside this workflow change. They include the incomplete reconstructed source/dependency environment (for example a truncated exported `_shared/lotProject.shared.js`) and older policy tests that still expect superseded owner/System Admin rules. Do not use those failures to change the current RBAC policy.

All changed server controller/service files in this package pass `node --check`.
