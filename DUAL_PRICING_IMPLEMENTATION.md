# Cash and Installment Listing Pricing

## Database

Run this migration before deploying the updated server:

`server/migrations/20260719_dual_listing_pricing_and_contract_snapshots.sql`

The migration:

- adds separate installment and cash prices per square metre;
- copies the old price into both new price fields;
- adds immutable reservation contract snapshots;
- preserves existing reservation contract values;
- separates sale discounts from downpayment discounts;
- repairs the meaning of reservation-history discount snapshots.

## Pricing rules

For the reservation mode selected by the admin:

```text
Base Selling Price = Lot Area × Selected Price per SQM
Sale Discount      = Base Selling Price × Sale Discount %
Net Selling Price  = Base Selling Price − Sale Discount
LMF                 = Base Selling Price × LMF Rate
TCP                 = Net Selling Price + LMF
```

Cash and installment pricing use the same formula but select different prices per SQM.

The payment method does not select the contract price. A cash-priced contract may still be paid by bank transfer, online payment, cheque, or cash.

## Discount separation

- Sale discount reduces the selected property selling price and TCP.
- Downpayment discount still applies only to the gross downpayment schedule.
- Commission uses the selected discounted Net Selling Price and excludes LMF.

## Compatibility

The old `lot_project_listing_price_per_sqm` column remains as the installment/list-price compatibility field. Existing API payloads containing only `pricePerSqm` still fall back to installment pricing.

Existing listings receive the old price for both cash and installment during migration. Existing buyer accounts receive contract snapshots based on their current stored listing values.

## Validation completed

- Server regression suite: 111 tests passed.
- Client production build: passed.
- Server JavaScript syntax checks: passed.
