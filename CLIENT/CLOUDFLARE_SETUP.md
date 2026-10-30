# D&C Prime Realty: combined Cloudflare Pages rollout

This is an overlay for the **provided** `DC_PRIME_REALTY` code snapshot. Do not overwrite changes from your newer GitHub commits without reviewing the diffs.

## Cloudflare Pages settings (existing `dc-prime-realty` project)

- Git branch: `main`
- Root directory: `CLIENT` (exact case)
- Framework preset: None
- Build command: `npm run build:all`
- Build output: `dist`
- Build variable: `NODE_VERSION=22` (or a compatible Node 22.x release supported by Vite 8)
- Runtime variables: `SYSTEM_API_ORIGIN=https://dc-prime-realty-system.onrender.com`, `FINANCE_API_ORIGIN=https://dc-prime-realty-finance.onrender.com`, `HR_API_ORIGIN=https://dc-prime-realty-hr.onrender.com` (replace if actual URLs differ)

The build script installs and builds each application independently and assembles their output in `CLIENT/dist`. Build-time Vite API paths are controlled by the script, so do **not** set conflicting `VITE_HR_API_URL` or `VITE_FINANCE_API_URL` variables in Cloudflare.

## API URL mapping

- SYSTEM client: `/api/v1/*` -> SYSTEM Render `/api/v1/*`
- FINANCE client: `/finance-api/api/v1/*` -> FINANCE Render `/api/v1/*`
- HR client: `/hr-api/api/v1/*` -> HR Render `/api/v1/*`

## Important staging safeguards

HR's Render backend must be separately patched for Render `0.0.0.0` + `PORT` and may be intentionally staging-only. HR mutations and kiosk stay disabled. The given HR backend in the source snapshot still rejects production `NODE_ENV` and has `127.0.0.1` binding unless you applied its prior patch. Do not use real employee or customer data during this staging rollout. Finance production approval also requires separate validation.

SYSTEM, HR, and FINANCE frontends use different cookie names, and the Pages proxy filters cookies before forwarding to each server. HR's server-scoped cookie path is rewritten to the `/hr-api` path on responses so browser login works through Pages.

## Smoke tests after deployment

- `/` website and `/properties` website deep link
- `/system` and `/system/portal`, including refresh
- `/finance` login screen
- `/hr` and `/hr/login`, including refresh
- `/api/v1/health` SYSTEM
- `/finance-api/api/v1/health` FINANCE
- `/hr-api/api/v1/health` HR
- Check that each app's network requests go to the correct same-domain API path and never directly to a `.onrender.com` URL.

## Known caveats

This overlay is **not a proof of end-to-end deployment**. All backend services must be live; connection variables must be configured; some legacy SYSTEM absolute links and media references may still require path repairs. The HR frontend may encounter an existing `PayrollRateExplanation` module import/build failure, which must be resolved if it appears in build logs. Run complete UI, auth, upload, and permissions tests before production use.
