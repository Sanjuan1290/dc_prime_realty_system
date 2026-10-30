# Batch 7 — Independent HR Frontend (staging only)

1. Start from a clean Git branch with Batch 4 workspace scaffolding and Batch 6 backend overlay already applied in the working copy. Do **not** replace the original `client/` or `server/`.
2. Copy the included `apps/hr-client/` into the existing repository. This contains the original Employees, Attendance, Payroll and kiosk screens with their dependency closure, a separate login, navigation, API client and permission checks.
3. In `apps/hr-client/`, copy `.env.example` to `.env.local`; only set `VITE_HR_API_URL=/api/v1` behind the development proxy that targets the isolated HR staging API. `VITE_` variables are public client configuration, not secrets.
4. Run `npm install` from repository root and `npm run check -w @dc-prime/hr-client`, `npm test -w @dc-prime/hr-client`, `npm run build -w @dc-prime/hr-client`.
5. Start HR backend **only** against restored, isolated staging HR database and separately provisioned HR identities. Verify login, role-scoped navigation, Employees, Attendance, Payroll reads. Write access remains OFF by default.
6. Payroll release and signed receipt functionality are deliberately unavailable pending Batches 8–9. HR kiosk remains disabled until its session and write flows pass staging testing.
7. Never use the new HR frontend as the production HR entry point until database restoration, client build, API integration tests and cutover gates pass.

Important: original `client/` and `server/` and Realty database remain authoritative; this overlay changes none of those.
