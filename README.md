# D&C Prime Realty System

Complete React, Node.js, Express, and TiDB/MySQL-compatible project for the D&C Prime Realty System Admin and Lot Project workspaces.

## Main changes in this package

### Cancelled buyer accounts are retained

Returning a settled cancelled unit to **Available** now closes and detaches the buyer account instead of deleting it.

The system keeps:

- Buyer and co-buyer profiles
- Reservation history and cancellation settlement
- Payments, payment allocations, payment schedules, and payment logs
- SOA statements and notification history
- Submitted documents and document approval history
- Commissions, milestone releases, receipts, and deductions
- Buyer-form records

A unit can have several buyer accounts over time. The current listing points to one active account, while earlier accounts remain in **Account History**.

### Cancellation commission rules

Commission milestones use the commissionable amount retained after the buyer refund:

```text
Commissionable retained percentage
= commissionable retained amount / original commission base × 100
```

Example: 45% retained marks the 20% and 40% milestones as **Earned on Cancellation**. Later milestones become **Forfeited on Cancellation**. Released stages remain released.

Current commission, payment, SOA, and document totals are grouped by buyer account/client profile, so a previous buyer cannot affect the next buyer of the same unit.

### Verified permanent account deletion

A cancelled, detached buyer account can still be permanently removed by a Super Admin.

The purge requires:

1. Current Super Admin password
2. A deletion reason
3. Exact typed confirmation such as `DELETE ACC-2026-000001`
4. A six-digit code sent to the Super Admin email
5. A valid, unexpired verification request with attempts remaining

The purge is blocked while the account is active, attached to the unit, unsettled, awaiting a refund, or has unpaid earned commission stages.

The purge removes only the selected account's records and protected Cloudinary assets. It writes an append-only purge event and audit entry containing the actor, reason, counts, verification reference, and manifest hash.

Normal listing deletion cannot bypass this flow. A listing can only be deleted when it has never had buyer-account history.

### Protected Cloudinary documents

The client no longer uses an unsigned upload preset. Upload parameters are signed by the server and files use Cloudinary's `authenticated` delivery type.

Folder format for new protected uploads:

```text
{root}/protected/{project_storage_code}/{listing_storage_code}/{account_reference}/documents/{document_code}/files
{root}/protected/{project_storage_code}/{listing_storage_code}/{account_reference}/payments/{payment_storage_code}/proofs
```

Examples:

```text
dc_prime/protected/PRJ-LA-001/LST-000042/ACC-2026-000018/documents/DOC-ITB/files
dc_prime/protected/PRJ-LA-001/LST-000042/ACC-2026-000018/payments/PAY-2026-000061/proofs
```

The storage codes are permanent once created. Project names, Unit IDs, buyer names, and document display names may change without moving the protected Cloudinary folders. Document codes are chosen when a Document Library item is created and are locked afterward.

Canonical stored file names remain readable in Cloudinary while the original upload filename is retained separately in the database, for example:

```text
DOC-ITB__ACC-2026-000018__V01.pdf
DOC-GOV-ID__ACC-2026-000018__V01-02.jpg
PAY-2026-000061__PROOF-01.png
```

The browser cannot choose another buyer's folder. The server verifies the uploaded asset, folder, authenticated delivery type, format, and size before saving it. Document viewers request short-lived access URLs from the API.

Supported files:

- PDF
- JPG/JPEG
- PNG
- Maximum 15 MB per file

### Other included updates

- Payment reminder emails with attached SOA PDFs
- Refunded and discontinued amounts on Lot Project and System dashboards
- Unit document compliance defaults to All Projects and counts fully completed accounts correctly
- Price List modal with editable Straight Payment Months
- Audit log export and archive verification
- Role-based seller hierarchy and commission rates
- Remember Me and password-reset code flow

The unfinished House & Lot creation UI is hidden from the active admin workflow until that module is completed.


## September 6, 2026 clean employee/attendance revision

This full-codebase package already includes the new production flow discussed for D&C Prime Realty:

- **Admin / Super Admin user creation:** no temporary-password field. The server generates a secure random temporary password, emails it through Resend, stores only the bcrypt hash, and forces the existing Change Password screen on first login.
- **Credential regeneration:** Admin/Super Admin credentials can be regenerated and emailed; successful regeneration increments `auth_version` so old sessions stop working.
- **Employees:** simplified to employee name, unique Barcode Code, generated/printable Code 128 barcode, configurable department (including IT), Full Time / Probationary / Part Time, and Active / Inactive status. The Employees page does not scan barcodes.
- **Attendance:** the laptop/desktop webcam, tablet, or phone camera is the primary barcode scanner for Time In and Time Out. It uses native BarcodeDetector where available and a built-in Code 128 decoder fallback where it is not. Manual and USB/Bluetooth scanner input remain available. Time Out requires Time In, duplicate scans are blocked, and Admin can correct Time In/Time Out with reasons and audit logging.
- **Automatic Time Out:** defaults to **8:00 PM Asia/Manila** and is editable in System Settings. Automatic records are clearly marked and do not overwrite a real/admin/event Time Out.
- **Day classification:** Regular Day, Double Pay Day, Regular Holiday, and Special Holiday.
- **Company Events:** event date/range, location, participant selection, Full Day / Custom Time / Attendance Record Only, and optional double-pay/holiday classification.
- **Super Admin:** Employees and Attendance use the real modules instead of the previous `On Going...` placeholders.
- **Retired HR/payroll code removed:** Cash Advances, payroll screens, salary-release/logbook components, old attendance modal, employee schedules/payroll UI, related frontend permissions, old server handlers, and stale double-check models were removed from the active codebase.

### Database migration for this revision

Run this migration against the existing TiDB database before deploying the new code:

```text
server/migrations/20260906_simplified_employee_attendance.sql
```

The migration is intentionally non-destructive to historical database tables. Retired payroll/cash-advance tables may still exist in an upgraded database, but this codebase no longer exposes or calls those modules.

## Database setup

Use your existing `dc_prime_realty_system_db` database and run any migrations that have not yet been applied. For this revision, the required new migration is:

```text
server/migrations/20260906_simplified_employee_attendance.sql
```

Back up the TiDB database before applying migrations.

## Server setup

```bash
cd server
cp .env.example .env
npm ci
npm run dev
```

Required server environment values include:

```env
PORT=5001
CORS_ORIGIN=http://localhost:5173

DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=dc_prime_realty_system_db

JWT_SECRET=
NODE_ENV=development

RESEND_API_KEY=
EMAIL_FROM=D&C Prime Realty <noreply@example.com>
EMAIL_REQUEST_TIMEOUT_MS=15000
PUBLIC_APP_URL=http://localhost:5173
COMPANY_NAME=D&C Prime Realty

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=dc_prime
```

All account-invitation and password-reset emails use the existing Resend HTTPS email service. Verify the sending domain and configure `RESEND_API_KEY` plus `EMAIL_FROM`.

## Client setup

```bash
cd client
cp .env.example .env
npm ci
npm run dev
```

Client environment:

```env
VITE_API_URL=http://localhost:5001/api/v1
```

## Validation performed for this package

- Server JavaScript syntax check: **180 files passed**.
- Client relative-import resolution: **208 source files, no missing relative imports**.
- Server relative-import resolution: **no missing relative imports**.
- Focused source-level regression suite for routing, user credentials, Employees, Attendance, and explicit double-check architecture: **22/22 passed**.
- `node_modules` is intentionally not packaged; run `npm ci` in `client` and `server` on the target machine.

## Attendance calendar revision

Attendance day management is now calendar-based. Select any date in the monthly Attendance Calendar to review or change its Day Type. Company Event is no longer a standalone button/section; it is selected from Date Details and opens the participant/event setup when needed. Past dates remain editable, and Attendance History follows the currently selected calendar date.
