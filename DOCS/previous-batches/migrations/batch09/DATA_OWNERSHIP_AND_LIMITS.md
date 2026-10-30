# Batch 9 data boundaries

- `employees`, schedules, attendance, payroll, corrections, advances and receipts: HR only.
- `hr_users`: historical actor snapshot identity; NOT an imported Realty authentication account. HR login invites must be provisioned separately.
- `hr_legacy_user_map`: maps only original users referenced by HR or HR audit data; seller and customer accounts irrelevant to HR are not imported.
- `hr_external_realty_user_links`: historical pending employee-to-Realty link references; Seller Network remains owned by Realty.
- `hr_settings`: attendance and department values only; company Real Estate settings remain Realty-owned.
- `hr_audit_logs`: HR-labelled events from live and archive audit. Reviewed generic-module audit rows may need a separate import amendment.
- `employee_payroll_signed_receipts`: database metadata and reference fields only. Cloudinary asset bytes, scan webhook and protected ACL migration are **outside Batch 9**.
- `hr_outbox_events`: history seed is a separate explicitly approved staging operation after HR data reconciliation; delivery off. No payroll correction/reversal protocol in v1.
- `finance_external_salary_entries`: belongs to Realty and is populated only by authenticated, duplicate-safe salary events; it is never bulk-copied from the HR SQL dump.
- Original Realty 17 HR tables remain intact and authoritative until HR production cutover in Batch 10.
