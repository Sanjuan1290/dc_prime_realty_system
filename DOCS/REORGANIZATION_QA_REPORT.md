# DC Prime Realty — Reorganized Codebase QA Summary (30 October 2026)

**Source:** October 27 consolidated code + Batch 4–16 prepared overlays. No live repository integration or deployment. The prior archived staging packages were preserved; this response only changes the extracted working copy.

**Requested structure:** `CLIENT/WEBSITE`, `CLIENT/SYSTEM`, `CLIENT/HR`, `CLIENT/FINANCE`, `SERVER/WEBSITE`, `SERVER/SYSTEM`, `SERVER/HR`, `SERVER/FINANCE`.

## Verified checks

- All 8 app packages and entrypoints present; root npm workspace checks pass.
- Realty backend relative import validation passes (201 scanned source files).
- System frontend Review Center prebuild check passes.
- HR frontend source-isolation check passes (48 files).
- HR backend isolation check passes (43 runtime JS files).
- Syntax checks pass on the four backend entrypoints.
- Selected regression: 12 Realty tests pass, 13 HR backend tests pass, 6 HR frontend tests pass, 59 Finance tests pass.
- One additional Realty test tried to import jsonwebtoken without node_modules; install dependencies before running all legacy tests.
- Fresh-start TiDB combined file: 144 CREATE TABLE, 0 INSERT INTO, 0 DROP TABLE/DATABASE (static scan). Actual TiDB execution is NOT tested.

## Known limitations (material)

1. **NOT yet production-ready.** HR's backend explicitly refuses `NODE_ENV=production`. Finance's server also blocks startup without reviewed flags. Salary release, payroll correction, protected receipts and integrations remain unverified.
2. **Legacy HR dependencies inside Realty remain.** Original controllers/models used by Seller Network, finance, audit and some tests were kept as inactive source. SYSTEM HR endpoint mounts and the legacy attendance scheduler are removed from the SYSTEM entrypoint. This reduces overlap but is not a complete semantic rewrite.
3. **Original images and videos are missing** from source text export. `DOCS/MISSING_ORIGINAL_MEDIA.json` identifies the missing media and maps the expected paths. Neutral placeholders were inserted only to satisfy direct image imports; other files must be restored from the original repository.
4. **Dependency installation, Vite builds, browser checks and TiDB staging execution NOT performed** here, as npm packages, media assets, deployment credentials and TiDB instances were unavailable.
5. **No npm lockfiles in reorganized packages.** Regenerate and commit correct lockfiles after `npm install` to make deploy builds reproducible.
6. Historical test assertions sometimes describe the pre-separation structure and may need re-scoping. They are retained to avoid discarding test coverage.
7. The WEBSITE server is a static host (no database); public buyer-form handling remains under SYSTEM.
8. Two previously known source-to-source dependencies still need architectural completion: Seller Network employee links and payroll-finance salary corrections/reversals.

**Decision:** Staging source handoff: YES. Production release: NO-GO until full system integration acceptance.
