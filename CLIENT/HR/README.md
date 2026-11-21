# HR & Payroll frontend

Live React/Vite application at /hr in the combined Cloudflare Pages build. Set VITE_HR_API_URL=/hr-api/api/v1. Editing and payroll release default to enabled and retain server-enforced permissions. VITE_HR_READ_ONLY=true explicitly switches the UI to read-only. VITE_HR_KIOSK_ENABLED=false hides the attendance kiosk; its server PIN and signed station session remain required.

Pages: employees, attendance records, payroll and permissioned audit history. Payroll can export released payments as Finance transfer ZIP/Excel files. Before authentication, health reads retry within a three-minute cold-start deadline and respect the server's Retry-After interval. Repeated database-startup responses do not exhaust a fixed attempt count. Password submissions are never retried automatically.

Run npm run build and npm test. [Backend configuration](../../SERVER/HR/README.md).
