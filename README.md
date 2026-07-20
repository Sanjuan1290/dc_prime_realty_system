# D&C Prime Realty System

Complete React, Node.js, Express, and MySQL project for the System Admin and Lot Project workspaces.

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

Folder format:

```text
{root}/{project}/listing_{listing_id}_{unit}/{account_reference}_{buyer}/{document}/{uuid}
```

The browser cannot choose another buyer's folder. The server verifies the uploaded asset, folder, type, format, and size before saving it. Document viewers request short-lived access URLs from the API.

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

The House & Lot placeholder module was not changed.

## Database setup

### Fresh database

Import:

```text
database/Dump20260720_complete.sql
```

This contains the current database dump followed by the account-retention, verified-purge, commission-status, and secure-document migration.

### Existing database

Back up the database first. Then run the migrations that your database has not yet received. For a database already matching `Dump20260720_current.sql`, run only:

```text
server/migrations/20260720_account_retention_secure_purge_cloudinary.sql
```

See `database/README.md` for the full migration order.

## Server setup

```bash
cd server
cp .env.example .env
npm ci
npm run dev
```

Required server environment values:

```env
PORT=5001
CORS_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=dc_prime_realty

JWT_SECRET=
AUDIT_DELETE_CODE_SECRET=
DESTRUCTIVE_ACTION_CODE_SECRET=
DESTRUCTIVE_ACTION_CODE_EXPIRY_MINUTES=10
DESTRUCTIVE_ACTION_MAX_ATTEMPTS=5

NODE_ENV=development

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
EMAIL_LOGO_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=dc_prime

PUBLIC_APP_URL=http://localhost:5173
COMPANY_NAME=D&C Prime Realty
```

Use different long random values for `JWT_SECRET`, `AUDIT_DELETE_CODE_SECRET`, and `DESTRUCTIVE_ACTION_CODE_SECRET`.

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

Do not add a Cloudinary API secret or unsigned upload preset to the client.

## Migrating existing Cloudinary buyer documents

The migration script is dry-run only unless `--apply` is supplied.

```bash
cd server
npm run migrate:cloudinary-documents
```

Review the output, then apply:

```bash
npm run migrate:cloudinary-documents -- --apply
```

Optional controls:

```bash
npm run migrate:cloudinary-documents -- --limit=25
npm run migrate:cloudinary-documents -- --apply --skip-archives
```

The script converts live and archived buyer-document assets to authenticated delivery, moves them to account-specific folders, and updates the stored metadata. It performs database updates incrementally so the process can be rerun.

After the applied migration is verified in your Cloudinary account:

1. Open Cloudinary Console.
2. Go to **Settings → Upload → Upload presets**.
3. Disable or delete `dc_prime_unsigned`.
4. Redeploy the client without `VITE_CLOUDINARY_UPLOAD_PRESET`.
5. Confirm that an old unsigned upload request fails.

The actual remote Cloudinary conversion was not run while building this package because live Cloudinary credentials and network access were not available. Run the dry-run and applied migration in your deployment environment.

## Validation completed

- Server: **162 tests passed**
- Client: Vite production build completed
- Server JavaScript syntax checks completed

The Vite build reports a chunk-size warning for some existing large pages. It does not stop the build.
