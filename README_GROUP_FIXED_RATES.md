# D&C Prime Realty — Fixed Realty Rates Update

This package is based on `d&cPrimeCodes(163).txt` and `Dump20260720 (4)(1).sql`.

## Commission model

Commission rates are stored once for every Realty + Project combination:

- BNM override rate
- Broker override rate
- Manager override rate
- Agent sales rate

The four role rates must equal the project pool exactly. Individual seller accounts do not store editable commission rates. Every seller inherits the rate assigned to their role in the Realty's selected project.

Example:

- Pool: 8%
- BNM: 1%
- Broker: 1%
- Manager: 1%
- Agent: 5%

## Main changes

- New Realty and Edit Realty forms configure the pool and all four fixed role rates per selected project.
- User creation and editing no longer ask for seller commission rates.
- Realty Details shows one fixed rate structure instead of repeated member/path rates.
- Accredited Sellers no longer shows individual seller rates.
- Reservation agent options use the Realty's fixed Agent rate.
- Reservation commission creation maps the fixed rate by seller role through Agent → Manager → Broker → BNM.
- Historical commission rows are preserved as snapshots.
- Old individual rate endpoints are removed from the router.
- Legacy individual seller/direct/relationship rate rows are marked inactive by the migration.

## Database update

Back up the database, then run:

```sql
SOURCE server/migrations/20260720_group_fixed_project_commission_rates.sql;
```

Or open and execute the whole migration in MySQL Workbench.

The migration adds these columns to `seller_group_lot_project_rates`:

```text
bnm_override_rate
broker_override_rate
manager_override_rate
agent_rate
```

It derives the current fixed Agent rate as the remaining pool after the BNM, Broker, and Manager rates. For the supplied current database, both projects become 8% = 1% + 1% + 1% + 5%.

For a fresh import, use:

```text
database/Dump20260720_CURRENT_163_GROUP_FIXED.sql
```

## Run

Server:

```bash
cd server
npm ci
npm test
npm run dev
```

Client:

```bash
cd client
npm ci
npm run build
npm run dev
```

Client `.env`:

```env
VITE_API_URL=http://localhost:5001/api/v1
```

Cloudinary credentials remain server-side only.

## Validation completed

- 170 server tests passed.
- Client production build passed.
- Existing Account History, Documents, secure Cloudinary, cancellation retention, and error-boundary fixes remain in the package.
