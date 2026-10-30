# DC_PRIME_REALTY — Reorganized Source Code (Staging / Development)

This package uses the requested `CLIENT/` and `SERVER/` directories. It reorganizes the **real source** from the October 27 export and overlays from Batches 4–16, rather than substituting empty placeholder apps. It has not been deployed or tested with live TiDB instances. **Not production approved.**

## Applications

| App | Frontend | Backend | TiDB |
| --- | --- | --- | --- |
| WEBSITE | `CLIENT/WEBSITE` | `SERVER/WEBSITE` | none |
| SYSTEM (Realty) | `CLIENT/SYSTEM` | `SERVER/SYSTEM` | `dc_prime_realty_system_db` |
| HR | `CLIENT/HR` | `SERVER/HR` | `dc_prime_hr_db` (guard may require staging variant) |
| FINANCE | `CLIENT/FINANCE` | `SERVER/FINANCE` | `dc_prime_finance_db` |

- WEBSITE is the original marketing site extracted from `client/src/website`, with its own Vite entry and routes. `SERVER/WEBSITE` is an optional Express **static file host** serving the built WEBSITE app; it is not a business API and uses no DB. On Cloudflare Pages, deploy just the client.
- SYSTEM is the original complete Realty application, with public website pages removed from the live router. The public buyer-form frontend remains in SYSTEM, and buyer-form APIs still live in `SERVER/SYSTEM`.
- HR and FINANCE use the actual independent app sources from earlier staging batches.
- SYSTEM server no longer mounts the original `/employees`, `/attendance`, `/employee-payroll` or kiosk routes and does not start the original attendance scheduler. Legacy controllers/services are **retained as source** because Seller Network, historical finance, audits and migration workflows still reference them. Removing these now could cause data loss or runtime errors. HR functionality must be tested on standalone HR service.
- HR signed receipts, payroll release workflows, correction/reversal handling, Seller Network links and production activation were previously blocked on purpose. Reorganizing folders DOES NOT resolve those.

## Prerequisites

- Node.js 22+ and npm 10+.
- Restore the 47 original image/video binaries via your full original Git checkout; `DOCS/MISSING_ORIGINAL_MEDIA.json` lists missing files and original URLs. Two imported images are clearly marked placeholders; replace them with the original assets. Some broken image/video URLs will appear until media is restored.
- Separate TiDB databases, permissions, JWT/cookie signing secrets and deployment origins. Never put secrets in `VITE_` fields. Install dependencies and generate new lockfiles; old lockfiles with outdated paths are intentionally omitted.

## Local setup (repo root)

```bash
npm install
npm run check:layout
npm run dev:website
npm run dev:system
npm run dev:hr
npm run dev:finance
```

Run each command in a **separate terminal**. Also run each backend in a separate terminal:

```bash
npm run start:website   # only AFTER build:website, otherwise unnecessary for Vite dev
npm run start:system
npm run start:hr
npm run start:finance
```

Frontends: WEBSITE 5173, SYSTEM 5174, HR 5175, FINANCE 5177 (default development ports). APIs: WEBSITE static 5101, SYSTEM 5001, HR 5102, FINANCE 5103. Confirm actual PORT/env overrides.

## Recommended deployments

| Service | Provider example | Root path | Build | Start/publish |
| --- | --- | --- | --- | --- |
| WEBSITE frontend | Cloudflare Pages | `CLIENT/WEBSITE` | `npm install && npm run build` | `dist` |
| SYSTEM frontend | Cloudflare Pages | `CLIENT/SYSTEM` | `npm install && npm run build` | `dist` (include `functions/` for API proxy if using it) |
| HR frontend | Cloudflare Pages | `CLIENT/HR` | `npm install && npm run build` | `dist` |
| FINANCE frontend | Cloudflare Pages | `CLIENT/FINANCE` | `npm install && npm run build` | `dist` |
| SYSTEM API | Render Web Service | `SERVER/SYSTEM` | `npm install` | `npm start` |
| HR API | Render Web Service | `SERVER/HR` | `npm install` | `npm start` |
| FINANCE API | Render Web Service | `SERVER/FINANCE` | `npm install` | `npm start` |
| WEBSITE static host (optional) | Render Web Service | repository root | `npm install && npm run build:website` | `npm run start:website` |

The optional WEBSITE server requires the CLIENT/WEBSITE build in the *same deployed filesystem*. For a static frontend host, you do not need SERVER/WEBSITE at all.

If configuring root directory to subfolders, check whether your provider supplies workspace dependencies or runs build commands from monorepo root. `npm install` in each app also works, though it generates separate lockfiles. For repeatable releases, commit the generated lockfiles after dependency resolution and run `npm ci` on subsequent builds.

**Environment:** Each app has `.env.example`; SYSTEM also has `.env.deployment.example`. Configure actual deployment secrets in provider settings, not Git. HR server still contains staging/production safety guards; do not simply switch them off without testing. Read `SERVER/HR/README.md` and the Batch 15 blocker register first.

## Fresh-start TiDB

Use `DATABASES/FRESH_START/00_ALL_THREE_EMPTY_SCHEMAS_144_TABLES.sql` in an **isolated empty TiDB staging environment**. It creates the 108-table Realty staging schema, 28-table HR schema and 8-table Finance schema. It contains no business data and **does not create admin credentials**. Alternative: the individual SQL files plus the Batch 8 Realty add-on, not both paths. See `DATABASES/FRESH_START/README.md`. None of these scripts drops an existing DB.

The 108-table Realty test schema still contains old HR tables, as their dependent finance/Seller Network code has not been fully extracted. Do not remove them before reconciliation and integration fixes.

## Verification before any live use

1. Restore all missing media, install dependencies, regenerate lockfiles, and build each frontend (`npm run build:website`, `build:system`, `build:hr`, `build:finance`).
2. Run `SERVER/SYSTEM` import checks, the HR frontend/server isolation checks and all three backend test suites. Some old source-text tests expect legacy route ownership and need re-scoping after this split.
3. Execute migrations in private TiDB staging; verify constraints, access and database guards; provision authorized test admins.
4. Run browser/API sign-in, protected file access, payroll/SOA/commission and Finance CSV/XLSX import/export tests.
5. Review Batch 15 blockers; do not approve production or data cleanup without evidence.

**Non-goals:** This package does not silently activate payroll releases, finance imports or old cleanup tasks. Original user/financial data is NOT shipped in this ZIP.
