# Finance frontend

Live React/Vite application at /finance in the combined Cloudflare Pages build. Set VITE_FINANCE_API_URL=/finance-api. Finance has its own accounts and session cookie.

Pages: dashboard, transactions, categories, audit history, user invitations, imports and reconciliation. New invited users must choose their own password before entering the app. Administrators choose a salary/Company Finances export, review its payments and confirm. Categories are automatic. Import history provides a reviewed Undo action; uploading the same file again restores payments. Role and password-setup restrictions are also enforced by the API.

The health endpoint is checked before authentication; only health GET requests retry automatically. User-facing states distinguish connection delays, rate limits, provider security blocks and validation errors.

Forms, controls, alerts and keyboard-accessible confirmation dialogs share consistent styling and motion, with responsive history cards and reduced-motion support.

Run npm run build. [Backend and email configuration](../../SERVER/FINANCE/README.md).
