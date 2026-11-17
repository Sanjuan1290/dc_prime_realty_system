# Payroll history date checks — 16 November 2026

The screenshots show a recorded hire date of **16 November 2026**, while the selected payroll and manually entered attendance cover **1–15 November 2026**. Payroll reads salary and rest-day history effective within that period. Initial records starting on 16 November do not cover 1–15 November, even though the current employee profile shows a salary and Tuesday/Thursday rest days.

The employee's actual hire date has not been assumed or changed in production. A clarification was requested from the user.

## Corrective workflow

- If the actual hire date was on or before 1 November, use **Employees → Edit → Hire Date** to enter that actual date and a correction reason. The existing audited correction moves the initial salary and rest-day history together. It preserves attendance, employee code and barcode. Recalculate existing drafts afterward.
- If 16 November is the actual hire date, use the **16–End of Month** payroll period. Attendance entered before that date needs to be checked for accuracy.
- Ordinary rest-day changes still take effect when saved. Current rest days are not silently applied to an earlier period that has no matching historical schedule.
- Hire-date changes remain blocked when the employee has finalized or released payroll. Those records require the existing reviewed correction process.

## Changes prepared locally

- Payroll readiness identifies a hire date after the selected period and displays the actual dates with the correction options. It no longer reports unrelated missing-salary/rest-day messages for that case.
- The same check runs during draft generation, including direct API requests, before any payroll period or draft rows are written for that employee.
- The dialog distinguishes employees outside the selected period from employees needing payroll setup changes.
- Genuine historical rest-day gaps retain a warning that names the selected dates and explains that current settings may start later.
- Saving an employee or compensation change invalidates the payroll readiness cache. The next check reloads effective history.
- The hire-date correction form explains how the original salary and rest-day start dates move together.

This fix needs the HR backend and HR frontend deployed. It introduces no new migration or environment setting. The earlier CSV-only transfer work remains in the workspace unchanged.

## Verification

All checks passed using synthetic employees in the guarded local MySQL instance. No production employee or payroll was accessed or modified.

- **1,867 unit tests** across the applications, including three new employment-period regression tests.
- **6 API scenarios:** the reported November date mismatch, direct pre-hire generation rejection, audited date correction with salary/rest-day history and attendance preservation, successful corrected-period generation, finalized-payroll protection, a genuine historical schedule gap, and preparation of a separate browser fixture.
- **3 browser scenarios:** the accurate date message, explicit employee correction with a reason, and a refreshed payroll check showing the corrected employee as ready. Desktop and mobile layouts were inspected; no uncaught browser errors occurred.
- All four app builds, HR runtime isolation, HR frontend isolation and Git whitespace checks passed.

In the reproduction, 11 manually entered working days and Tuesday/Thursday rest days were retained. Correcting the synthetic hire date from 16 November to 1 November moved both initial histories to 1 November; payroll then recognized the salary and rest-day coverage. A separate test confirmed that a current schedule starting on 16 November does not fill an actual historical gap for 1–15 November.

Browser evidence is under `QA_REPORTS/evidence/payroll-history-dates/`. To reproduce after starting the guarded QA database and local services:

```powershell
node --test tools/qa/payroll-history-dates.e2e.test.mjs
node tools/qa/payroll-history-dates-browser.mjs
```

Run the API scenarios first; they prepare a fresh synthetic employee for the browser correction flow.
