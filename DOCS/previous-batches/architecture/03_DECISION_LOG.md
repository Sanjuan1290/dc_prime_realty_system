# Batch 3 — Decision Register

**Status:** Proposed defaults for implementation planning. No code has been changed. This document separates design recommendations from approval still required.

| ID | Decision | Proposed default | Why / source dependency | State |
|---|---|---|---|---|
| D01 | Repo organization | One npm-workspaces monorepo, seven independently deployable apps | Current combined client/server and future independent deployments | Drafted |
| D02 | Database naming | Keep existing `dc_prime_realty_system_db`; create `dc_prime_hr_db`, `dc_prime_finance_db` | Avoid unrelated rename; 105-table baseline | Drafted |
| D03 | Login | Independent auth/session/permissions per app; HR account onboarding by invitation/reset | 20 HR FK refs to legacy `users` | Drafted |
| D04 | Employee ↔ seller | HR owns mapping; no automatic employee linking during Realty Excel import | Existing import writes `employees` by matching email | Drafted — business workflow approval needed |
| D05 | Undo mapped seller | Fail closed, prohibit physical deletion for a Realty account that has ever been mapped to HR; allow reviewed deactivation | Cross-DB race and audit safety | Drafted — confirm with owners |
| D06 | Salary transfer | HR transactional outbox → authenticated Realty receiver + idempotent local cash projection | Current Realty finance directly selects released `employee_payrolls` | Drafted |
| D07 | Salary correction | Only cash movements change consolidated cash. Corrections require explicit compensating entries | Avoid duplicate or fictional income | Drafted — confirm payroll policy |
| D08 | Cash advances | Do not create finance effects until approved source and cash dates are defined; retain reconciliation warning/history | Finance diagnostic reads `employee_cash_advances` | Pending functional review |
| D09 | Finance Management | Separate manual ledger + validated file import from Realty, no direct DB access or parallel HR salary feed | Avoid two independent salary sources | Drafted |
| D10 | Public website | Static React frontend, public buyer forms still call Realty API | Current combined `App.jsx` and buyer form router | Drafted |
| D11 | Audit and notifications | Preserve historical Realty evidence; selective HR copy; future logs service-owned | Mixed audit and review history | Drafted — retention review needed |
| D12 | Signed receipts | HR owns access, Cloudinary callback authenticated/routed by owner | Current webhook touches employee payroll receipts | Drafted |
| D13 | Background jobs | Attendance job HR only; property penalty Realty only | Currently both started in `server/server.js` | Drafted |
| D14 | Deployment and domains | Independent origins, audience/cookie scopes, secrets, credentials and backups | Avoid cross-application credential reuse | Drafted — actual hosts not inventoried |
| D15 | Batch 4 gate | No production migration until restored DB and clean checkout baseline validated | Batch 1/2 live checks open | BLOCKED pending infrastructure evidence |

### Confirm with system owner before implementing high-impact behavior

1. Is physical deletion of previously HR-linked Realty accounts acceptable, or should these always be deactivated? **Recommended: deactivation only.**
2. How are cash advances paid and reconciled in your approved payroll rules? Avoid inferring salary expense from advance requests.
3. What is the procedure for an incorrectly recorded salary release or recovered salary overpayment? **Recommended: record actual movements and traceable corrections, never edit a posted cash entry silently.**
4. What period of source audit/receipt retention is required by your business/legal obligations? **No deletion period selected in this document.**
5. Which exact staging database instance, repository commit, deployed hostnames and Cloudinary metadata convention will be used? **Not verified from the export.**

**Design can guide implementation planning before answers, but the corresponding behavior must not be switched on in production until approved.**
