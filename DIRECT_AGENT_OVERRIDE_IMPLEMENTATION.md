# Direct Agent and Override Commission Update

## Deployment order

1. Back up the production database.
2. Run `server/migrations/20260718_direct_agent_overrides.sql` once.
3. Deploy the updated server.
4. Deploy the updated client.
5. Open each Seller Group, choose every active project, and review the path cards.
6. Configure missing direct rates and parent overrides before creating new reservations.

## New commission rules

- New reservations can assign only active agents.
- Managers, brokers, and BNMs can make a sale through their non-login direct-sales agent.
- New reservations always store `sale_channel = distributed` for backward-compatible database reporting.
- Agents receive a project direct rate.
- A parent receives an override from the direct child relationship configured for the project.
- The sum of the agent direct rate and parent overrides cannot exceed the group project pool.
- Existing commission rows remain historical snapshots. Rate changes apply to new reservations unless an allowed manual recalculation is completed.

## Main pages

- Seller Groups list: `/super_admin/users/seller_group` or `/admin/users/seller_group`
- Group project configuration: `/super_admin/users/seller_group/:groupId?project=:projectId`
- The reservation modal loads agents and the hierarchy preview from live API endpoints.

## New API endpoints

- `GET /seller-groups/:groupId/projects/:projectId`
- `PATCH /seller-groups/:groupId/projects/:projectId/pool`
- `PATCH /seller-groups/:groupId/projects/:projectId/agents/:agentId/direct-rate`
- `PATCH /seller-groups/:groupId/projects/:projectId/children/:childId/override`
- `POST /seller-groups/:groupId/direct-sales-agents/:ownerId`
- `PATCH /seller-groups/:groupId/direct-sales-agents/:dummyId/status`
- `GET /projects/lot-projects/:projectSlug/reservation-agents`
- `GET /projects/lot-projects/:projectSlug/commission-preview`

## Validation completed

- Server test suite: 83 tests passed.
- Client production build: passed.
- Changed server JavaScript syntax checks: passed.

