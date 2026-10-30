# Batch 9 acceptance checklist

- [ ] October 27 source SQL restored in an isolated Realty staging instance; backup restore tested.
- [ ] HR schema Batch 5 live DDL validated with FK enforcement enabled.
- [ ] Source database credential SELECT-only and target database account scoped to HR.
- [ ] Batches 6–8 HR backend and frontend integration tests passed with full dependencies.
- [ ] All 17 source/target HR row counts and canonical SHA-256 hashes match.
- [ ] All 24 historic HR actor column references resolved to HR historical identities.
- [ ] Employee links remain `pending`; no Realty login credentials copied.
- [ ] All 10 HR-owned settings values match exactly.
- [ ] HR audit history match counts and sample record snapshots; generic-module audit events manually reviewed.
- [ ] Receipt metadata matches, and actual protected Cloudinary assets independently checked.
- [ ] Payroll released IDs, dates and net amounts independently reconciled by day and total.
- [ ] Prior correction/reversal and salary cash advances independently reviewed.
- [ ] Historical release timezone confirmed before optional outbox seed.
- [ ] Outbox seed and receiver replay tests proven duplicate-safe on staging; delivery still disabled for production.
- [ ] Separate backfill/retry and rollback procedure approved; source remains unchanged.
- [ ] Final live-data freeze and delta-sync plan ready for Batch 10.

**A checklist item remains unchecked unless an operator ran it in real staging and retained a signed report.**
