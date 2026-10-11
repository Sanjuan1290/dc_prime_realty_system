# D&C Prime Realty Website Phase 2

Only `client/src/website` was changed for this phase.

## Implemented

- Removed Payment Estimator from website navigation; legacy estimator route redirects to Properties.
- Corrected office/tripping schedule to Monday, Tuesday, Friday-Sunday, 9:00 AM-8:00 PM; Wednesday/Thursday closed.
- Added a website-only tripping scheduler prototype with project/date/time/party selection, mock availability states, browser-local request reference, lookup, email/Facebook handoff, and `.ics` calendar export.
- Added rainy-season safety context to the tripping confirmation experience.
- Restructured Company navigation into About, Our Team, Our Projects and Careers.
- Consolidated team presentation around leadership, departments, property guidance and the existing Site Coordinator profile.
- Added Careers section with separate Employee Opportunities and Accredited Seller paths without inventing unapproved vacancies or commission rates.
- Added ongoing/upcoming project portfolio presentation.
- Added the provided Luntiang Aguinaldo location map to the project page.
- Added office-hours material to the About page.
- Added inquiry intent selection for property, tripping, seller accreditation, careers and general questions.
- Updated website search to include navigation pages.

## Important backend boundary

The scheduler is intentionally frontend-only in this phase. Its availability states are mock preview data and browser-local requests are not guaranteed appointments. A future backend should replace the mock availability provider and local request storage with real slot capacity, booking, lookup, reschedule/cancel and admin-calendar APIs.

