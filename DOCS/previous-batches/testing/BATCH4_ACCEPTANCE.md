# Batch 4 — Acceptance and Remaining Gates

## Can be checked from this add-only scaffold

- [x] Root npm workspace manifest with `client`, `server`, `apps/*`, `packages/*`.
- [x] Seven named application placeholders and two reserved shared packages.
- [x] Separate future-app environment templates with blank secrets.
- [x] Validation command that fails if legacy folders are absent.
- [x] Legacy npm commands are preserved through root convenience scripts.
- [x] No additional application schedulers, routers, DB pools, or live endpoints were created.
- [x] Architecture documents and staging checklist included.

## Cannot be verified from supplied text export alone

- [ ] Full Git checkout at a known commit, including the 47 binary assets referenced in the export.
- [ ] Actual clean `npm ci`, existing test suites, client lint, prebuild, and Vite build.
- [ ] Source restore in isolated TiDB/MySQL with per-table counts and representative balances.
- [ ] Correct hostnames/Cloudflare/Render/provider deployment settings.
- [ ] Separate staging DB credentials, restricted grants and verified ownership.
- [ ] End-to-end CORS, cookies, sessions, CSRF and public buyer-form behavior.
- [ ] Actual Cloudinary/protected receipt access and webhook callback validation.
- [ ] Cutover/rollback process and one-active-scheduler check.

**Result:** Batch 4 scaffold is prepared, but Batch 4 is **NOT cleared for staging/production deployment**. Do not start Batch 5 schema migration against production while Batch 1 restore and these gates remain unresolved.
