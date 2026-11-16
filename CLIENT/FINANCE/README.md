# Finance frontend

Live React/Vite application at /finance in the combined Cloudflare Pages build. Set VITE_FINANCE_API_URL=/finance-api. Finance has its own accounts and session cookie.

Pages: dashboard, transactions, categories, audit history, user invitations, imports and reconciliation. New invited users must choose their own password before entering the app. Administrators map source categories, preview salary/Company Finances exports, then confirm imports. Role and password-setup restrictions are also enforced by the API.

The health endpoint is checked before authentication; only health GET requests retry automatically. User-facing states distinguish connection delays, rate limits, provider security blocks and validation errors.

Run npm run build. [Backend and email configuration](../../SERVER/FINANCE/README.md).
