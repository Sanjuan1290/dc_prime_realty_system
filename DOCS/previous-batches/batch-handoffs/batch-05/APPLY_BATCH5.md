# Applying the Batch 5 overlay

1. Keep `client/`, `server/`, Realty database and original deployments untouched.
2. Use a new Git branch, after Batch 4 workspace is merged. Add these overlay files to the repository root (do not replace existing directories wholesale).
3. Read `docs/migrations/batch05/README_BATCH5.md` and run `python apps/hr-server/scripts/batch5/check_batch5.py`.
4. Do not run SQL against production. DBA staging run order: `01`, `02`, `03`, `04`, then read-only `05` and `06`.
5. Mark the batch fully complete only after isolated staging execution, restored baseline, schema checks and DBA sign-off. No historical rows migrate until Batch 9.
