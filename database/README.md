# Database setup

## Fresh database

Import the current clean dump first. It keeps the table structures and the configured seed records.

## Existing database migrations

Run migrations in this order when they have not already been applied:

```text
server/migrations/20260715_audit_log_archival.sql
server/migrations/20260717_dashboard_reservation_history.sql
server/migrations/20260718_direct_agent_overrides.sql
server/migrations/20260718_direct_agent_overrides_repair.sql
server/migrations/20260719_dual_listing_pricing_and_contract_snapshots.sql
server/migrations/20260719_role_based_seller_rates.sql
```

`20260719_role_based_seller_rates.sql` changes the meaning of seller project rates:

- Agent: sales commission rate
- Manager, Broker, and Broker Network Manager: override commission rate

The migration does not delete historical reservations or commission records. Review the diagnostic query returned at the end and correct any old reporting relationships that do not follow BNM → Broker → Manager → Agent.
